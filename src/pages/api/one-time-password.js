import { getConfig, saveConfig, middlewareAuth } from '@/functions';
import { nanoid } from 'nanoid';

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.isOwner) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user } = req.body;
  if (!user) {
    return res.status(400).json({ error: 'Missing user' });
  }
  const oneTimePassword = nanoid();
  const config = await getConfig();
  config.oneTimePasswords = config.oneTimePasswords || [];
  config.oneTimePasswords.push({
    user,
    oneTimePassword,
    date: new Date(),
  });
  await saveConfig(config);

  // TODO if owner, then use pass password to sedutil to unlock both drives and mount them

  res.status(200).json({ qrCode: `https://app.getpibox.com/otp/${oneTimePassword}` });
}
