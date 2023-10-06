import { setTimeout } from "timers/promises";

export default async function handler(req, res) {
  await setTimeout(3000);
  res.status(200).json({ expanded: true });
}
