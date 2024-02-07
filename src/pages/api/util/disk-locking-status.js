import { writeScreen, startHomeScreen, execAsync, checkSetupComplete, getLuksData } from '@/functions'
import c from 'chalk'

export default async function handler(req, res) {
  let disks
  try {
    const { stdout } = await execAsync(`lsblk -J`)
    disks = JSON.parse(stdout)
      .blockdevices.map((disk) => ({ name: disk.name }))
      .filter((disk) => disk.name.startsWith('sd'))
  } catch (err) {
    console.error(`Could not list block devices: ${err}`)
    throw err
  }
  for (const disk of disks) {
    const { encrypted, unlocked } = await getLuksData(disk)
    disk.encrypted = encrypted
    disk.unlocked = unlocked
  }
  // if all disks are unlocked, mount the LVM
  global.ALL_DISKS_UNLOCKED = disks.length > 0 && disks.every((disk) => disk.unlocked === true)
  global.ALL_DISKS_ENCRYPTED = disks.length > 0 && disks.every((disk) => disk.encrypted === true)

  if (global.ALL_DISKS_UNLOCKED) {
    try {
      await execAsync('mount /dev/pibox_vg/pibox_lv /pibox')
    } catch (err) {
      console.error(`Error mounting logical volume: ${err}`)
    }
  }

  const setupComplete = await checkSetupComplete()
  console.log({ setupComplete })
  if (!setupComplete) {
    await writeScreen([
      { content: 'Welcome to\nPiBox!', color: '3C89C7', size: 32, y: 50 },
      { content: 'Please use app\nto begin setup', color: 'ccc', size: 26, y: 140 },
      { content: `v${global.VERSION}`, color: '999', size: 16, y: 220 },
    ])
  } else if (!global.ALL_DISKS_UNLOCKED) {
    await writeScreen([
      { content: 'Disks Locked', color: '3C89C7', size: 32, y: 95 },
      { content: 'Please login as\nowner to unlock', color: 'ccc', size: 26, y: 150 },
    ])
  } else if (!global.ALL_DISKS_ENCRYPTED) {
    await writeScreen([
      { content: 'New Disk\nAdded', color: '3C89C7', size: 34, y: 70 },
      { content: 'Expand storage\nwithin app', color: 'ccc', size: 26, y: 165 },
    ])
  } else {
    startHomeScreen()
  }

  console.log(c.cyan(`Disk Status`))
  console.log(`  All Encrypted: ${global.ALL_DISKS_ENCRYPTED} - All Unlocked: ${global.ALL_DISKS_UNLOCKED}`)
  console.log(`  ---`)
  for (const disk of disks) {
    console.log(`  ${disk.name} - Encrypted: ${disk.encrypted} - Unlocked: ${disk.unlocked}`)
  }

  res.status(200).json(disks)
}
