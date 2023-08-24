import {
  createUser,
  setSystemPassword,
  getConfig,
  saveConfig,
  execAsync,
  getSystemSerial,
} from "@/functions";

export default async function handler(req, res) {
  const config = await getConfig();
  if (config) {
    return res.status(400).json({ error: "Initial setup already completed" });
  }
  return initialSetup(req, res);
}

async function initialSetup(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let { fullName, password, sessionKey, sessionName, sessionPlatform, disks } =
    req.body;

  if (!fullName || !password) {
    return res.status(400).json({ error: "Missing full name or password" });
  }

  const firstName = fullName.split(" ")[0];
  const username = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!sessionKey || !sessionName || !sessionPlatform) {
    return res
      .status(400)
      .json({ error: "Missing session key, name, or platform" });
  }

  if (!disks || !Array.isArray(disks) || disks.length < 1) {
    return res
      .status(400)
      .json({ error: "One or more disks are required to complete setup" });
  }

  try {
    await execAsync(`deluser --remove-home pi`); // delete default pi user
  } catch (err) {
    console.error(`Error deleting pi user: ${err}`);
    if (!err.stderr.includes("does not exist")) {
      throw err;
    }
  }

  try {
    await createUser(username, fullName);
    await setSystemPassword(username, password);
    // give owner user sudo privileges
    await execAsync(`adduser ${username} sudo`);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // TODO set drive passwords using sedutil-cli
  // create drive password key and encrypt it with owner's sessionKey and password

  // TODO configure disks in RAIDt
  // import & run createRAID1Array() from functions

  const pluralName = firstName + (firstName.endsWith("s") ? "'" : "'s");
  const serial = await getSystemSerial();

  const config = {
    owner: username,
    deviceName: `${pluralName} PiBox (${serial.slice(-5)})`,
    sessions: [
      {
        user: username,
        key: sessionKey,
        name: sessionName,
        platform: sessionPlatform,
      },
    ],
  };

  await saveConfig(config);
  res.status(200).json({ success: true });
}
