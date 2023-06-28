import { promisify } from "util";
import { exec } from "child_process";
import { readFile, writeFile, mkdir, stat, readdir } from "fs/promises";
import fs from "fs";
import { middlewareAuth, setPassword } from "@/functions";
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
  // console.log({ slug: req.query.slug });

  // try {
  //   // read all files and folders in the user's home directory
  // } catch (err) {
  //   console.error(`Error listing files: ${err}`);
  //   return res.status(400).json({ error: err.message });
  // }

  const files = await readdir(`/files/${slug}`);
  // filter out hidden files and folders
  const filteredFiles = files.filter((file) => !file.startsWith("."));
  // get the stats for each file and folder
  const filesWithStats = await Promise.all(
    filteredFiles.map(async (file) => {
      const stats = await stat(`/files/${slug}/${file}`);
      const isDirectory = stats.isDirectory();
      return {
        name: file,
        isDirectory: isDirectory,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        subItemCount: isDirectory
          ? fs.readdirSync(`/files/${slug}/${file}`).length
          : 0,
      };
    })
  );
  res.json(filesWithStats);

  return res.status(400).send(slug || "<NO SLUG>");

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
