import { readFile } from "fs/promises";
import { createUser, setSystemPassword, middlewareAuth } from "@/functions";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return listUsers(req, res);
  } else if (req.method === "POST") {
    if (!(await middlewareAuth(req, res))) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!req.isOwner) {
      return res.status(400).json({ error: "Only the owner can reset setup" });
    }

    let { username, fullName, password } = req.body;

    if (!fullName || !password) {
      return res.status(400).json({ error: "Missing full name or password" });
    }

    if (!username) {
      const firstName = fullName.split(" ")[0];
      username = username || firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    try {
      await createUser(username, fullName);
    } catch (err) {
      // console.log(err);
      if (err.message.includes("already exists")) {
        await createUser(
          username + Math.floor(Math.random() * 10000),
          fullName
        );
      } else {
        console.error(`Error creating user: ${err}`);
      }
    }

    try {
      await setSystemPassword(username, password);
    } catch (err) {
      console.error(`Error setting user's password: ${err}`);
      return res.status(400).json({ error: err.message });
    }
    return res.status(201).json({ message: "User created" });
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
      const [username, _password, _uid, _gid, fullName, _home, shell] =
        user.split(":");
      return { username, fullName, shell };
    })
    .filter(
      (user) =>
        ["/bin/bash", "/bin/zsh"].includes(user.shell) &&
        user.username !== "root"
    )
    .map((user) => {
      return {
        fullName: user.fullName,
        username: user.username,
      };
    });

  // console.log(users);
  res.status(200).json(users);
}
