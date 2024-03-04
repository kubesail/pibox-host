import { setTimeout } from 'timers/promises'
import { execAsync, execAndLog, getLuksData } from '@/functions'
import c from 'chalk'

export default async function handler(req, res) {
  const { mirrored } = req.body
  let disks = []
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

  const unlockedDisks = disks.filter((disk) => disk.unlocked)
  if (unlockedDisks.length === 0) {
    return res.status(500).json({ error: 'Please unlock existing disk first' })
  }

  const disksToExpand = disks.filter((disk) => !disk.encrypted)
  if (disksToExpand.length === 0) {
    return res.status(500).json({ error: 'No disks found to expand' })
  }

  if (!global.TEMP_LUKS_PASSWORD) {
    return res.status(400).json({
      error: 'No temporary LUKS password stored. Please try rebooting your PiBox or unlocking your disks first',
    })
  }
  const luksPassword = global.TEMP_LUKS_PASSWORD
  global.TEMP_LUKS_PASSWORD = null

  for (const disk of disksToExpand) {
    // Enable encryption on each disk
    console.log(`Enabling encryption for disk ${disk.name}`)
    await execAndLog('disks:' + disk.name, `echo "${luksPassword}" | cryptsetup luksFormat /dev/${disk.name}`)
    console.log(`Unlocking disk ${disk.name}`)
    disk.unlockedName = `encrypted_${disk.name}`
    disk.unlockedPath = `/dev/mapper/${disk.unlockedName}`
    await execAndLog(
      'disks:' + disk.name,
      `echo "${luksPassword}" | cryptsetup luksOpen /dev/${disk.name} ${disk.unlockedName}`
    )
    try {
      await execAndLog('disks:' + disk.name, `pvcreate ${disk.unlockedPath}`)
    } catch (err) {
      return res.status(500).json({ error: `Error setting up drive ${disk.unlockedName}: ${err}` })
    }

    await execAndLog('disks:global', `vgextend pibox_vg ${disksToExpand.map((disk) => disk.unlockedPath).join(' ')}`)
  }

  if (mirrored) {
    await execAndLog('disks:global', `lvconvert --type raid1 --mirrors 1 pibox_vg/pibox_lv`)
  } else {
    await execAndLog('disks:global', `lvextend -l +100%FREE pibox_vg/pibox_lv`)
    await execAndLog('disks:global', `resize2fs /dev/pibox_vg/pibox_lv`)
  }
  res.status(200).json({ expanded: true })
}
