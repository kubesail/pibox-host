import { promisify } from "util";
import { exec } from "child_process";
import { unlink } from "fs/promises";
const execAsync = promisify(exec);
import { middlewareAuth } from "@/functions";
import bcrypt from "bcrypt";
import { CONFIG_FILE_PATH } from "@/constants";

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!req.isOwner) {
    return res.status(400).json({ error: "Only the owner can reset setup" });
  }

  if (
    req.body.YES_I_KNOW_WHAT_IM_DOING_AND_UNDERSTAND_THIS_WILL_DELETE_DATA !==
    true
  ) {
    return res.status(400).json({ error: "Missing confirmation" });
  }

  try {
    await unlink(CONFIG_FILE_PATH);
  } catch (err) {
    return res.status(500).json({ error: "Error deleting setup config file" });
  }
  return res.status(200).json({ message: "Setup reset" });
}
