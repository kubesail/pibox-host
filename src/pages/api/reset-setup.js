import { unlink } from "fs/promises";
import { middlewareAuth, execAsync } from "@/functions";
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

  const errors = [];
  try {
    await unlink(CONFIG_FILE_PATH);
  } catch (err) {
    errors.push("Error deleting setup config file");
  }
  
  try {
    // remove linux user and home directory (--remove-home)
    await execAsync(`deluser --remove-home ${req.user}`);
  } catch (err) {
    errors.push(`Error deleting user: ${err}`);
  }

  if (errors.length) {
    return res.status(500).json({ error: errors.join(", ") });
  }
  return res.status(200).json({ message: "Setup reset" });
}
