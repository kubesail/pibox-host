import { middlewareAuth, execAndLog } from '@/functions'
import { getConfig, saveConfig, saveSambaConfig, sha256HexDigest } from '@/functions'
import { stat, writeFile } from 'fs/promises'
import { PIBOX_FILES_PREFIX } from '@/constants'
import { createDiffieHellmanGroup } from 'crypto'

async function createGroup(groupName, users) {
  await execAndLog('global:samba', `groupadd ${groupName}`)
  for (const user of users) {
    await execAndLog('global:samba', `usermod -a -G ${groupName} ${user}`)
  }
}

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!req.isOwner) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let path = req.body.path
  const users = req.body.users
  if (!path) {
    return res.status(400).json({ error: 'Missing path' })
  }

  if (!Array.isArray(users)) {
    return res.status(400).json({ error: 'Missing users' })
  }

  path =
    path
      .split('/')
      .filter((p) => p)
      .join('/') + '/'
  // check that path exists
  try {
    await stat(PIBOX_FILES_PREFIX + path)
  } catch {
    return res.status(400).json({ error: 'Path does not exist' })
  }

  const config = await getConfig()
  config.groups = config.groups || []
  let updatedExistingShare = false

  let share = config.shares.find((share) => share.path === path)
  if (!share) {
    const existingNames = config.shares.map((share) => share.name)
    const nameBase = path
      .split('/')
      .filter((p) => p)
      .pop()
      .replace(/[<>:"\/\\|?*\[\]]/g, '')
    let i = 1
    let name = nameBase
    while (existingNames.includes(name)) {
      name = `${nameBase} (${i})`
      i++
    }
    config.shares.push({ name, path })
    share = config.shares[config.shares.length - 1]
  }

  share.users = users
  share.groupName = 'samba-' + sha256HexDigest(users.sort().join(',')).substring(0, 16) // 31 char limit for total group name
  if (!config.groups.find((group) => group.groupName === share.groupName)) {
    createGroup(share.groupName, users) // Async function, but we don't need to await it. Group creation can happen out of request cycle
    config.groups.push({ groupName: share.groupName, users: users })
  }

  await saveConfig()
  await saveSambaConfig()
  await execAndLog('global:samba', 'systemctl restart smbd')
  res.status(200).json({ message: 'Permissions updated' })
}
