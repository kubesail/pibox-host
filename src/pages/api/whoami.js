import { promisify } from "util";
import { exec } from "child_process";
import { readFile } from "fs/promises";
import { middlewareAuth } from "@/functions";
const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { stdout, stderr } = await execAsync(`sudo -u ${req.user} whoami`);
    const passwordSet =
      (await readFile("/etc/shadow", "utf8"))
        .split("\n")
        .map((line) => {
          const [username, hash] = line.split(":");
          return { username, hash };
        })
        .find((user) => user.username === req.user)?.hash !== "!";

    res.status(200).json({
      piboxConfigUser: req.user,
      linuxUser: stdout.trim(),
      passwordSet,
    });
  } catch (err) {
    console.error(`Error looking up user: ${err}`);
    res
      .status(500)
      .json({ error: "Error looking up user", piboxConfigUser: req.user });
  }
}
