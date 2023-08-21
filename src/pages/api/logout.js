import { middlewareAuth, getConfig, saveConfig } from "@/functions";

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = await getConfig();
  config.sessions = config.sessions.filter(
    (session) => session.username !== req.user
  );

  await saveConfig(config);
  res.status(200).json({ message: "success" })
}
