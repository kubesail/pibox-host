import { promisify } from "util";
import { exec } from "child_process";
import { readFile, writeFile, mkdir } from "fs/promises";
import { middlewareAuth, createUser, setPassword } from "@/functions";
import { setTimeout } from "timers/promises";
const execAsync = promisify(exec);

const CONFIG_FILE_PATH = "/root/.pibox/config.json";

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return;
  }

  if (req.isOwner !== true) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "POST") {
    if (!req.body.username || !req.body.password) {
      return res.status(400).json({ error: "Missing username or password" });
    }
    try {
      await createUser(req.body.username);
      await setTimeout(1000); // PAM error if we don't wait
      await setPassword(req.body.username, req.body.password);
    } catch (err) {
      console.error(`Error creating user: ${err}`);
      return res.status(400).json({ error: err.message });
    }
    return res.status(201).json({ message: "User created" });
  } else if (req.method === "GET") {
    return listUsers(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

async function listUsers(req, res) {
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
