import { middlewareAuth, getConfig } from "@/functions";

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return;
  }

  const config = await getConfig();
  const sessions = config.sessions.filter(
    (session) => session.user === req.user
  );
  res.status(200).json(sessions);
}
