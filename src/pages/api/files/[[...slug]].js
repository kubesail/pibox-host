import { promisify } from "util";
import { exec } from "child_process";
import { readFile, writeFile, mkdir, stat, readdir } from "fs/promises";
import fs from "fs";
import { middlewareAuth, setPassword } from "@/functions";
import { fileTypeFromFile } from "file-type";
import { bytesToHuman } from "@/functions";
const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return;
  }

  //TODO check correct user permissions here
  if (req.isOwner !== true) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const slug = req.query.slug ? req.query.slug.join("/") : "";
  console.log({ slug });

  const filePath = `/files/${slug}`;
  const stats = await stat(filePath);
  const isDirectory = stats.isDirectory();
  if (!isDirectory) {
    console.log("not a directory");
    const mimeType = await fileTypeFromFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeType ? mimeType.mime : "application/octet-stream",
      "Content-Length": stats.size,
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const files = await readdir(filePath);
  // filter out hidden files and folders
  const filteredFiles = files.filter((file) => !file.startsWith("."));
  // get the stats for each file and folder
  const filesWithStats = await Promise.all(
    filteredFiles.map(async (file) => {
      const filePath = `/files/${slug}/${file}`;
      const stats = await stat(filePath);
      const isDirectory = stats.isDirectory();
      let mimeType = null;
      if (!isDirectory) {
        mimeType = await fileTypeFromFile(filePath);
      }
      console.log({ mimeType });
      const res = {
        name: file,
        dir: isDirectory,
        mtime: stats.mtime,
        ctime: stats.ctime,
      };
      if (isDirectory) {
        res.subItemCount = fs.readdirSync(filePath).length;
      } else {
        res.size = bytesToHuman(stats.size);
        res.mime = mimeType ? mimeType.mime : null;
      }
      return res;
    })
  );
  return res.json(filesWithStats);

  // if (req.method === "DELETE") {
  //   const username = req.query.username;
  //   try {
  //     await execAsync(`userdel -r ${username}`);
  //   } catch (err) {
  //     console.error(`Error deleting user: ${err}`);
  //     if (err.stderr.includes("does not exist")) {
  //       return res
  //         .status(404)
  //         .json({ error: `User ${username} does not exist` });
  //     }
  //   }
  //   return res.status(200).json({ message: "User deleted" });
  // } else if (req.method === "PUT") {
  //   if (!req.body.password) {
  //     return res.status(400).json({ error: "Missing password" });
  //   }
  //   try {
  //     await setPassword(req.query.username, req.body.password);
  //     return res.status(200).json({ message: "Password updated" });
  //   } catch (err) {
  //     console.error(`Error setting password: ${err}`);
  //     return res.status(400).json({ error: err.message });
  //   }
  // } else {
  //   return res.status(405).json({ error: "Method not allowed" });
  // }
}
