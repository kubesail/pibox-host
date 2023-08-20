import { readFile } from "fs/promises";
import { createUser, setSystemPassword } from "@/functions";

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

    if (!req.body.username || !req.body.password) {
      return res.status(400).json({ error: "Missing username or password" });
    }
    try {
      await createUser(req.body.username);
      await setSystemPassword(req.body.username, req.body.password);
    } catch (err) {
      console.error(`Error creating user: ${err}`);
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
      const [username, _password, _uid, _gid, _gecos, _home, shell] =
        user.split(":");
      return { username, shell };
    })
    .filter(
      (user) =>
        ["/bin/bash", "/bin/zsh"].includes(user.shell) &&
        user.username !== "root"
    )
    .map((user) => {
      return {
        username: user.username,
      };
    });

  // console.log(users);
  res.status(200).json(users);
}
