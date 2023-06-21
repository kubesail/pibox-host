import { promisify } from "util";
import { exec } from "child_process";
import { readFile, writeFile, mkdir } from "fs/promises";
const execAsync = promisify(exec);
import { createUser } from "@/functions";
import bcrypt from "bcrypt";
import { CONFIG_FILE_PATH } from "@/constants";

export default async function handler(req, res) {
  let existingConfig;
  try {
    existingConfig = await readFile(CONFIG_FILE_PATH, "utf8");
  } catch (err) {
    return initialSetup(req, res);
  }
  res.status(400).json({ error: "Initial setup already completed" });
}

async function initialSetup(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let { user, password, deviceKey, deviceName, devicePlatform, disks } =
    req.body;

  if (!user || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  if (!deviceKey || !deviceName || !devicePlatform) {
    return res
      .status(400)
      .json({ error: "Missing device key, name, or platform" });
  }

  if (!disks || !Array.isArray(disks) || disks.length < 1) {
    return res
      .status(400)
      .json({ error: "One or more disks are required to complete setup" });
  }

  user = user.toLowerCase();
  try {
    await createUser(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // TODO give owner user sudo privileges

  // TODO set drive passwords using sedutil-cli
  // create drive password key and encrypt it with owner's deviceKey and password

  // TODO configure disks in RAID
  // import & run createRAID1Array() from functions

  try {
    password = await bcrypt.hash(password, 12);
  } catch (err) {
    console.error("Error hashing passord", err);
    return res
      .status(500)
      .json({ error: "Unable to hash password. Setup is not complete" });
  }

  const config = {
    owner: user,
    password,
    devices: [
      {
        user: user,
        key: deviceKey,
        name: deviceName,
        platform: devicePlatform,
      },
    ],
  };
  mkdir("/root/.pibox", { recursive: true });
  await writeFile(CONFIG_FILE_PATH, JSON.stringify(config));
  res.status(200).json({ success: true });
}
