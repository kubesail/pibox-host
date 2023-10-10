import { middlewareAuth } from '@/functions';
import { getConfig, saveConfig } from '@/functions';

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

  const config = await getConfig();
  let updated = false;
  config.shares = config.shares.map((share) => {
    if (share.path === req.body.path) {
      share.users = req.body.users;
      updated = true;
    }
    return share;
  });

  if (!updated) {
    config.shares.push({
      path: req.body.path,
      users: req.body.users,
    });
  }

  await saveConfig(config);

  res.status(200).json({ message: 'Permissions updated' });
}
