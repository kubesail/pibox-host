import {
  createUser,
  setSystemPassword,
  saveOwner,
  saveConfig,
  execAsync,
  getSystemSerial,
  execAndLog,
  sanitizeForLuks,
} from '@/functions'
import { stat, open, mkdir, writeFile } from 'fs/promises'
import { PIBOX_UNENCRYPTED_CONFIG_DIR, SETUP_COMPLETE_CHECK_FILEPATH } from '@/constants'

export default async function handler(req, res) {
  try {
    await stat(SETUP_COMPLETE_CHECK_FILEPATH)
    return res.status(400).json({ error: 'Initial setup already completed' })
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
  // This blocks other / accidental setup requests until this one is complete
  await mkdir(PIBOX_UNENCRYPTED_CONFIG_DIR, { recursive: true })
  await writeFile(SETUP_COMPLETE_CHECK_FILEPATH, '')
  return initialSetup(req, res)
}

async function initialSetup(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let { fullName, password, sessionKey, sessionName, sessionPlatform, disks, mirrored } = req.body

  if (!fullName || !password) {
    return res.status(400).json({ error: 'Missing full name or password' })
  }

  const firstName = fullName.split(' ')[0]
  const username = firstName.toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!sessionKey || !sessionName || !sessionPlatform) {
    return res.status(400).json({ error: 'Missing session key, name, or platform' })
  }

  // for each disk, disk.name should be a valid /dev/ path, like "sda", "sdb", etc.
  disks = disks.filter((disk) => /^sd[a-z]$/.test(disk.name)).map((disk) => ({ ...disk, path: `/dev/${disk.name}` }))
  if (!disks || !Array.isArray(disks) || disks.length < 1) {
    return res.status(400).json({ error: 'One or more disks are required to complete setup' })
  }
  for (const disk of disks) {
    try {
      await stat(disk.path)
    } catch (err) {
      return res.status(400).json({ error: `Disk ${disk.path} does not exist` })
    }
  }

  if (mirrored && disks.length !== 2) {
    return res.status(400).json({ error: 'Mirroring requires 2 disks' })
  }

  try {
    await execAsync(`deluser --remove-home pi`) // delete default pi user
  } catch (err) {
    if (!err.stderr.includes('does not exist')) {
      throw err
    }
  }

  try {
    await createUser(username, fullName)
    await setSystemPassword(username, password)
    // give owner user sudo privileges
    await execAsync(`adduser ${username} sudo`)
    await execAsync(`usermod -aG sambagroup ${username}`)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  const pluralName = firstName + (firstName.endsWith('s') ? "'" : "'s")
  const serial = await getSystemSerial()

  const config = {
    owner: username,
    deviceName: `${pluralName} PiBox (${serial.slice(-4)})`,
    sessions: [
      {
        user: username,
        key: sessionKey,
        name: sessionName,
        platform: sessionPlatform,
      },
    ],
    shares: [],
  }

  // Enable encryption on each disk
  const luksPassword = sanitizeForLuks(password)
  for (const disk of disks) {
    console.log(`Enabling encryption for disk ${disk.name}`)
    await execAsync(`echo "${luksPassword}" | sudo cryptsetup luksFormat /dev/${disk.name}`)
    console.log(`Unlocking disk ${disk.name}`)
    disk.unlockedName = `encrypted_${disk.name}`
    disk.unlockedPath = `/dev/mapper/${disk.unlockedName}`
    await execAsync(`echo "${luksPassword}" | sudo cryptsetup luksOpen /dev/${disk.name} ${disk.unlockedName}`)
    try {
      await execAndLog(disk.name, `pvcreate ${disk.unlockedPath}`)
    } catch (err) {
      return res.status(500).json({ error: `Error setting up drive ${disk.unlockedName}: ${err}` })
    }
  }

  try {
    const mirrorArgs = mirrored ? '--type raid1 --mirrors 1' : ''
    await execAndLog('GLOBAL', `vgcreate pibox_vg ${disks.map((disk) => disk.unlockedPath).join(' ')}`)
    await execAndLog('GLOBAL', `lvcreate ${mirrorArgs} -l 100%FREE -n pibox_lv pibox_vg`)
    await execAndLog('GLOBAL', `mkfs.ext4 -E lazy_itable_init=1,lazy_journal_init=1 /dev/pibox_vg/pibox_lv`)
    await execAndLog('GLOBAL', `mkdir -p /pibox`)
  } catch (err) {
    return res.status(500).json({ error: `Error preparing LVM: ${err}` })
  }

  try {
    await execAndLog('GLOBAL', `mount /dev/pibox_vg/pibox_lv /pibox`)
    await execAndLog('GLOBAL', `mkdir -p /pibox/files`)
  } catch (err) {
    errors.push(`Error mounting logical volume: ${err}`)
  }

  global.ALL_DISKS_ENCRYPTED = true
  global.ALL_DISKS_UNLOCKED = true

  await saveOwner(username)
  await saveConfig(config)
  res.status(200).json({ success: true })
}
