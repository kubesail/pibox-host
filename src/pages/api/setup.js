import {
  createUser,
  setSystemPassword,
  saveOwner,
  saveConfig,
  execAsync,
  getSystemSerial,
  execAndLog,
  sha256HexDigest,
  setSambaPassword,
  startHomeScreen,
  writeScreen,
} from '@/functions'
import { stat, mkdir, writeFile, unlink } from 'fs/promises'
import { PIBOX_UNENCRYPTED_CONFIG_DIR, SETUP_COMPLETE_CHECK_FILEPATH, UPDATE_IN_PROGRESS_CHECK_FILEPATH } from '@/constants'
import { setTimeout as setTimeoutPromise } from 'timers/promises'

export default async function handler(req, res) {
  try {
    await stat(SETUP_COMPLETE_CHECK_FILEPATH)
    return res.status(400).json({ error: 'Initial setup already completed' })
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  try {
    await stat(UPDATE_IN_PROGRESS_CHECK_FILEPATH)
    return res.status(400).json({ error: 'Please wait until initial update is complete' })
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  // This blocks other / accidental setup requests until this one is complete
  await mkdir(PIBOX_UNENCRYPTED_CONFIG_DIR, { recursive: true })
  await writeFile(SETUP_COMPLETE_CHECK_FILEPATH, '')
  return initialSetup(req, res)
}

async function initialSetup(req, res) {
  if (req.method !== 'POST') {
    await unlink(SETUP_COMPLETE_CHECK_FILEPATH)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let { fullName, password, sessionKey, sessionName, sessionPlatform, disks, mirrored } = req.body

  if (!fullName || !password) {
    await unlink(SETUP_COMPLETE_CHECK_FILEPATH)
    return res.status(400).json({ error: 'Missing full name or password' })
  }

  const firstName = fullName.split(' ')[0]
  const username = firstName.toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!sessionKey || !sessionName || !sessionPlatform) {
    await unlink(SETUP_COMPLETE_CHECK_FILEPATH)
    return res.status(400).json({ error: 'Missing session key, name, or platform' })
  }

  // for each disk, disk.name should be a valid /dev/ path, like "sda", "sdb", etc.
  disks = disks.filter((disk) => /^sd[a-z]$/.test(disk.name)).map((disk) => ({ ...disk, path: `/dev/${disk.name}` }))
  if (!disks || !Array.isArray(disks) || disks.length < 1) {
    await unlink(SETUP_COMPLETE_CHECK_FILEPATH)
    return res.status(400).json({ error: 'One or more disks are required to complete setup' })
  }
  for (const disk of disks) {
    try {
      await stat(disk.path)
    } catch (err) {
      await unlink(SETUP_COMPLETE_CHECK_FILEPATH)
      return res.status(400).json({ error: `Disk ${disk.path} does not exist` })
    }
  }

  if (mirrored && disks.length !== 2) {
    await unlink(SETUP_COMPLETE_CHECK_FILEPATH)
    return res.status(400).json({ error: 'Mirroring requires 2 disks' })
  }

  try {
    await execAsync(`deluser --remove-home pi`) // delete default pi user
  } catch (err) {
    if (!err.stderr.includes('does not exist')) {
      console.log('Error deleting pi user:', err)
    }
  }

  await writeScreen([
    { color: '3C89C7', size: 34, y: 55, content: 'Setup In\nProgress...' },
    { color: 'CCC', size: 26, y: 145, content: 'Please wait while\ndisks are being\nencrypted' },
  ])

  try {
    await createUser(username, fullName)
    await setSystemPassword(username, password)
    // give owner user privileges
    await execAsync(`adduser ${username} sudo`)
    setTimeoutPromise(1000)
    await execAsync(`usermod -aG sambagroup ${username}`)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  try {
    await setSambaPassword(username, password)
  } catch (err) {
    console.error(`Error setting SAMBA password: ${err}`)
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
    groups: [],
  }

  // Enable encryption on each disk
  const drivePassword = sha256HexDigest(password) // sanitize password for LUKS input via CLI
  for (const disk of disks) {
    console.log(`Enabling encryption for disk ${disk.name}`)
    // IMPORTANT silent exec here to avoid leaking password to logs
    try {
      await execAsync(`echo "${drivePassword}" | cryptsetup luksFormat /dev/${disk.name}`)
    } catch (err) {
      return res.status(500).json({ error: `Error encrypting drive ${disk.name}.` })
    }
    console.log(`Unlocking disk ${disk.name}`)
    disk.unlockedName = `encrypted_${disk.name}`
    disk.unlockedPath = `/dev/mapper/${disk.unlockedName}`
    // IMPORTANT silent exec here to avoid leaking password to logs
    try {
      await execAsync(`echo "${drivePassword}" | cryptsetup luksOpen /dev/${disk.name} ${disk.unlockedName}`)
    } catch (err) {
      return res.status(500).json({ error: `Error unlocking drive ${disk.name}.` })
    }
    try {
      await execAndLog('disks:' + disk.name, `pvcreate ${disk.unlockedPath}`)
    } catch (err) {
      return res.status(500).json({ error: `Error setting up drive ${disk.unlockedName}: ${err}` })
    }
  }

  console.log(`Creating LVM volume group and logical volume: ${disks.map((disk) => disk.unlockedPath).join(' ')}`)

  try {
    const mirrorArgs = mirrored ? '--type raid1 --mirrors 1' : ''
    await execAndLog('disks:global', `vgcreate pibox_vg ${disks.map((disk) => disk.unlockedPath).join(' ')}`)
    await execAndLog('disks:global', `lvcreate ${mirrorArgs} -l 100%FREE -n pibox_lv pibox_vg`)
    await execAndLog('disks:global', `mkfs.ext4 -E lazy_itable_init=1,lazy_journal_init=1 /dev/pibox_vg/pibox_lv`)
    await execAndLog('disks:global', `mkdir -p /pibox`)
  } catch (err) {
    return res.status(500).json({ error: `Error preparing LVM: ${err}` })
  }

  try {
    await execAndLog('disks:global', `mount /dev/pibox_vg/pibox_lv /pibox`)
    await execAndLog('disks:global', `mkdir -p /pibox/files`)
  } catch (err) {
    errors.push(`Error mounting logical volume: ${err}`)
  }

  global.ALL_DISKS_ENCRYPTED = true
  global.ALL_DISKS_UNLOCKED = true

  await saveOwner(username)
  await saveConfig(config)
  execAsync('sync')
  startHomeScreen()
  res.status(200).json({ success: true })
}
