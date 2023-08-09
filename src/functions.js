import { promisify } from "util";
import { exec, spawn } from "child_process";
import { readFile, writeFile, mkdir } from "fs/promises";
import { CONFIG_FILE_PATH } from "@/constants";

export const execAsync = promisify(exec);

export function bytesToHuman(sizeInBytes) {
  if (sizeInBytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1000));
  return (sizeInBytes / Math.pow(1000, i)).toFixed(0) * 1 + " " + sizes[i];
}

export async function createUser(user) {
  user = user.toLowerCase();
  // check that user is a valid unix username
  if (!user.match(/^[a-z0-9_-]{0,30}$/)) {
    throw new Error(
      "Invalid username. Usernames must be less than 30 characters and consist of only alphanumeric characters, dashes, or underscores"
    );
  }

  // check that the new user doesn't already exist
  let users;
  try {
    users = await execAsync("grep -E '/bin/bash' /etc/passwd");
    users = users.stdout.split("\n").map((user) => {
      const [username] = user.split(":");
      return username;
    });
  } catch (err) {
    console.error(`Error listing users: ${err}`);
    throw new Error("Error listing users");
  }

  if (users.find((u) => u === user)) {
    console.error(`User ${user} already exists`);
    throw new Error("User already exists");
  } else {
    execAsync(`useradd -m -s /bin/bash ${user}`);
  }
}

export async function middlewareAuth(req, res) {
  // https://github.com/vercel/next.js/discussions/34179
  // TODO when Next.js supports Node runtimes in middlewares, move this function into a middleware for all routes
  // export const config = {
  //   matcher: [
  //     /*
  //      * Match all API routes except:
  //      */
  //     "/api/((?!disks|setup).*)",
  //   ],
  // };

  const [_scheme, deviceKey] = (req.headers?.authorization || "").split(" ");
  if (!deviceKey) {
    res.status(401).json({
      error:
        "Restricted route. Please include a device key in your authorization header. Example format: 'Authorization: bearer XXXXX'",
    });
    return false;
  }

  let config;
  try {
    const configFile = await readFile("/root/.pibox/config.json", "utf8");
    config = JSON.parse(configFile);
  } catch (err) {
    console.log("Error reading config file", err);
    res.status(401).json({
      error: "Unauthorized",
    });
    return false;
  }

  const sessions = config.sessions.find((session) => session.key === deviceKey);
  if (!sessions) {
    res.status(401).json({
      error: "Unauthorized",
    });
    return false;
  }
  req.user = sessions.user;
  req.deviceKey = sessions.key;
  req.deviceName = sessions.name;
  req.devicePlatform = sessions.platform;
  req.isOwner = config.owner === sessions.user;
  console.log("Authorized request from", req.user, req.url, sessions.name);
  return true;
}

function createRAID1Array() {
  // const { execSync } = require('child_process');
  // const drive1 = 'sda';
  // const drive2 = 'sdb';
  // // Format the drives
  // console.log('Formatting drives...');
  // execSync(`sudo parted /dev/${drive1} mklabel gpt`);
  // execSync(`sudo parted /dev/${drive2} mklabel gpt`);
  // // Create RAID 1 (mirror) array
  // console.log('Creating RAID 1 (mirror) array...');
  // execSync(`sudo mdadm --create --verbose /dev/md0 --level=1 --raid-devices=2 /dev/${drive1} /dev/${drive2}`);
  // // Wait for the array to sync
  // console.log('Waiting for the array to sync (this may take a while)...');
  // execSync('sudo mdadm --wait /dev/md0');
  // console.log('RAID 1 (mirror) array created successfully!');
}

export async function getConfig() {
  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_FILE_PATH, "utf8"));
  } catch (err) {
    config = null;
  }
  return config;
}

export async function saveConfig(config) {
  mkdir("/root/.pibox", { recursive: true });
  await writeFile(CONFIG_FILE_PATH, JSON.stringify(config));
}

export async function checkSystemPassword(password, hashedPassword) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    const subprocess = spawn("/bin/mkpasswd", [password, hashedPassword]);
    subprocess.stdout.on("data", (data) => (stdout += data));
    subprocess.stderr.on("data", (data) => (stderr += data));
    subprocess.on("close", (exitCode) => {
      if (exitCode !== 0) {
        // mkpassword exits with code 2 if a full hashed password is provided the password is incorrect
        return resolve(false);
      }
      resolve(stdout.trim() === hashedPassword);
    });
  });
}

export async function setSystemPassword(username, password) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    const subprocess = spawn("/bin/mkpasswd", [password]);
    subprocess.stdout.on("data", (data) => (stdout += data));
    subprocess.stderr.on("data", (data) => (stderr += data));
    subprocess.on("close", async (exitCode) => {
      if (exitCode !== 0) {
        console.error(`Error setting password: ${stderr}`);
        return reject(new Error("Error setting password"));
      }
      const hash = stdout.trim();
      let etcShadow = await readFile("/etc/shadow", "utf8");
      etcShadow = etcShadow
        .split("\n")
        .map((line) => {
          const parts = line.split(":");
          if (username !== parts[0]) return line;
          parts[1] = hash;
          return parts.join(":");
        })
        .join("\n");
      await writeFile("/etc/shadow", etcShadow);
      resolve();
    });
  });
}

export async function getSystemSerial() {
  let serial = null;
  try {
    const { stdout, stderr } = await execAsync("ip link show eth0");
    const macAddressRegex = /ether\s+([^\s]+)/;
    serial = stdout.match(macAddressRegex)[1]?.replace(/:/g, "");
  } catch (err) {
    console.error(`Error retrieving serial (eth0 mac): ${err}`);
  }
  return serial;
}
