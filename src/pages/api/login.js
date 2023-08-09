import { readFile } from "fs/promises";
import { getConfig, saveConfig, checkSystemPassword } from "@/functions";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let { user, password, sessionKey, sessionName, sessionPlatform } = req.body;

  if (!user || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  if (!sessionKey || !sessionName || !sessionPlatform) {
    return res
      .status(400)
      .json({ error: "Missing session key, name, or platform" });
  }

  // read /etc/shadow
  let etcShadowUser;
  try {
    const etcShadow = await readFile("/etc/shadow", "utf8");
    etcShadowUser = etcShadow
      .split("\n")
      .map((user) => {
        const [username, passwordHash] = user.split(":");
        return { username, passwordHash };
      })
      .find((userObj) => userObj.username === user);
  } catch (err) {
    console.error(`Error getting users: ${err}`);
    return res.status(500).json({ error: "Error getting users" });
  }

  if (!etcShadowUser) {
    return res.status(400).json({ error: "User not found" });
  }

  const validLogin = await checkSystemPassword(
    password,
    etcShadowUser.passwordHash
  );

  if (!validLogin) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const config = await getConfig();
  config.sessions.push({
    user: user,
    key: sessionKey,
    name: sessionName,
    platform: sessionPlatform,
  });
  await saveConfig(config);

  res.status(200).json({ message: "Login successful" });
}
