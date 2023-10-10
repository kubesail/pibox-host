import { middlewareAuth } from '@/functions';
import { getConfig, saveConfig } from '@/functions';
import { stat } from 'fs/promises';
import { PIBOX_FILES_PREFIX } from '@/constants';

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

  let path = req.body.path;
  const users = req.body.users;
  if (!path) {
    return res.status(400).json({ error: 'Missing path' });
  }

  if (!Array.isArray(users) || users.length < 1) {
    return res.status(400).json({ error: 'Missing users' });
  }

  path =
    path
      .split('/')
      .filter((p) => p)
      .join('/') + '/';
  // check that path exists
  try {
    await stat(PIBOX_FILES_PREFIX + path);
  } catch {
    return res.status(400).json({ error: 'Path does not exist' });
  }

  const config = await getConfig();
  let updated = false;
  config.shares = config.shares.map((share) => {
    if (share.path === path) {
      share.users = users;
      updated = true;
    }
    return share;
  });

  if (!updated) {
    const existingNames = config.shares.map((share) => share.name);
    const nameBase = path
      .split('/')
      .filter((p) => p)
      .pop();
    let i = 1;
    let name = nameBase;
    while (existingNames.includes(name)) {
      name = `${nameBase} (${i})`;
      i++;
    }
    config.shares.push({ name, path, users });
  }

  await saveConfig(config);

  res.status(200).json({ message: 'Permissions updated' });
}
