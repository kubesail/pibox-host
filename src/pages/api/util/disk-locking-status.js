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
  if (!setupComplete) {
    await writeScreen({ content: 'Welcome to PiBox!', color: '3C89C7', background: '000000', size: 36, y: 70 })
    await writeScreen({ content: 'Please use app\n to begin setup', color: 'ccc', size: 28, y: 170 })
  } else if (!global.ALL_DISKS_UNLOCKED) {
    await writeScreen({ content: 'Disks Locked', color: '3C89C7', background: '000000', size: 36, y: 55 })
    await writeScreen({ content: 'Please login\n as owner\n to unlock', color: 'ccc', size: 28, y: 150 })
  } else if (!global.ALL_DISKS_ENCRYPTED) {
    await writeScreen({ content: 'New Disk Added', color: '3C89C7', background: '000000', size: 36, y: 70 })
    await writeScreen({ content: 'Continue setup\n on app', color: 'ccc', size: 28, y: 165 })
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
