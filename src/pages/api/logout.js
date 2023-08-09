import { middlewareAuth, getConfig, saveConfig } from "@/functions";

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const config = await getConfig();
  config.sessions = config.sessions.filter(
    
  await saveConfig(config);
}
