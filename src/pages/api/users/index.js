import { promisify } from "util";
import { exec } from "child_process";
import { readFile, writeFile, mkdir } from "fs/promises";
import { middlewareAuth } from "@/functions";
const execAsync = promisify(exec);

const CONFIG_FILE_PATH = "/root/.pibox/config.json";

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return;
  }

  if (req.isOwner !== true) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let users;
  try {
    users = await readFile("/etc/passwd", "utf8");
  } catch (err) {
    console.error(`Error getting users: ${err}`);
    return res.status(500).json({ error: "Error getting users" });
  }

  // parse passwd file

  users = users
    .split("\n")
    .map((user) => {
      const [username, _password, _uid, _gid, _gecos, _home, shell] =
        user.split(":");
      return { username, shell };
    })
    .filter((user) => user.shell === "/bin/bash" && user.username !== "root")
    .map((user) => {
      return {
        username: user.username,
      };
    });

  // console.log(users);
  res.status(200).json(users);
}
