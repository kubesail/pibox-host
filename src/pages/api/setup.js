import {
  createUser,
  setSystemPassword,
  getConfig,
  saveConfig,
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

  let { user, password, sessionKey, sessionName, sessionPlatform, disks } =
    req.body;

  if (!user || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

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

  user = user.toLowerCase();
  try {
    await createUser(user);
    await setSystemPassword(user, password);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // TODO give owner user sudo privileges

  // TODO set drive passwords using sedutil-cli
  // create drive password key and encrypt it with owner's sessionKey and password

  // TODO configure disks in RAID
  // import & run createRAID1Array() from functions

  const config = {
    owner: user,
    sessions: [
      {
        user: user,
        key: sessionKey,
        name: sessionName,
        platform: sessionPlatform,
      },
    ],
  };

  await saveConfig(config);
  res.status(200).json({ success: true });
}
