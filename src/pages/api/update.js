const https = require("https");
const fs = require("fs");
import { readFile, writeFile, readdir, rm, mkdir } from "fs/promises";
import { join } from "path";
import { middlewareAuth, getConfig, saveConfig } from "@/functions";
import { exec } from "child_process";
import { promisify } from "util";
export const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!req.isOwner) {
    return res.status(400).json({ message: "Only the owner can update" });
  }

  if (req.method === "GET") {
    return checkForUpdates(req, res);
  } else if (req.method === "POST") {
    return update(req, res);
  }
}

async function checkForUpdates(req, res) {
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  const ghResponse = await fetch(
    "https://api.github.com/repos/kubesail/pibox-host/releases"
  );
  const releases = await ghResponse.json();
  const latestRelease = releases[0];
  const latestVersion = latestRelease.tag_name;
  const currentVersion = `v${version}`;
  return res.status(200).json({
    currentVersion,
    latestVersion,
    updateAvailable: latestVersion !== currentVersion,
    changelog: latestRelease.body,
  });
}

async function update(req, res) {
  // remove all other folders in /opt/pibox-host that are not current version

  const allVersions = await readdir("/opt/pibox-host", { withFileTypes: true });
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  const currentVersion = `v${version}`;
  for (const dirEnt of allVersions) {
    if (!dirEnt.isDirectory()) continue;
    if (dirEnt.name === currentVersion) continue;
    const path = join(dirEnt.path, dirEnt.name);
    console.log(`Removing old version ${path}`);
    await rm(path, { recursive: true, force: true });
  }

  const ghResponse = await fetch(
    "https://api.github.com/repos/kubesail/pibox-host/releases"
  );
  const releases = await ghResponse.json();
  const latestRelease = releases[0];
  const latestVersion = latestRelease.assets.find(
    (asset) => asset.name === `pibox-host-${latestRelease.tag_name}.tar.gz`
  );
  const downloadSize = latestVersion.size;
  // save download size to config file
  let config = await getConfig();
  config.downloadInProgress = true;
  config.downloadSize = downloadSize;
  config.downloadPath = `/opt/pibox-host/${latestRelease.tag_name}.tar.gz`;
  await saveConfig(config);

  // Download new version
  const { version: newVersion } = req.body;
  console.log(`Downloading new version ${newVersion}`);
  const url = `https://github.com/kubesail/pibox-host/releases/download/${newVersion}/pibox-host-${newVersion}.tar.gz`;
  const destinationPath = `/opt/pibox-host/${newVersion}.tar.gz`;
  try {
    const result = await downloadFile(url, destinationPath);
    console.log(result);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: "Update failed" });
  }

  // untar update
  const newPath = `/opt/pibox-host/${newVersion}`;
  // mkdir newPath
  await mkdir(newPath, { recursive: true });
  await execAsync(`tar -xzf ${destinationPath} -C ${newPath}`);
  await rm(destinationPath);

  console.log(`Updating service file to point to ${newVersion}`);
  // update pibox-host service file
  const serviceFile = await readFile(
    `/opt/pibox-host/${newVersion}/pibox-host.service`,
    "utf8"
  );
  const newServiceFile = serviceFile.replace(/PIBOX_HOST_VERSION/g, newVersion);
  await writeFile("/etc/systemd/system/pibox-host.service", newServiceFile);

  // restart pibox-host service
  await execAsync("systemctl daemon-reload");
  await execAsync("systemctl restart pibox-host");

  config = await getConfig();
  config.downloadInProgress = false;
  config.downloadSize = 0;
  await saveConfig(config);

  return res.status(200).json({ message: "Update complete" });
}

function downloadFile(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destinationPath);

    function download(url) {
      https
        .get(url, (response) => {
          if (response.statusCode === 200) {
            response.pipe(fileStream);
            response.on("end", () => {
              fileStream.close();
              resolve(`File "${destinationPath}" has been downloaded.`);
            });
          } else if (
            response.statusCode === 301 ||
            response.statusCode === 302
          ) {
            // Handle redirection
            if (response.headers.location) {
              download(response.headers.location); // Make a new request to the redirected URL
            } else {
              reject(
                `Received a 3XX status code, but no 'Location' header found.`
              );
            }
          } else {
            fileStream.close();
            fs.unlinkSync(destinationPath); // Delete the partially downloaded file on error
            reject(
              `Failed to download file. Status code: ${response.statusCode}`
            );
          }
        })
        .on("error", (err) => {
          fs.unlinkSync(destinationPath); // Delete the partially downloaded file on error
          reject(`Error: ${err.message}`);
        });
    }

    download(url);
  });
}
