import { setTimeout } from 'timers/promises'

export default async function handler(req, res) {
  const { disks, mirrored } = req.body
  await expandDisks(disks, mirrored)
  res.status(200).json({ expanded: true })
}

async function expandDisks(disks, mirrored) {
  // TODO find disks that are already set up
  // ( copy from pibox-host/src/pages/api/util/disk-locking-status.js )

  // const disksToExpand = disks.filter((disk) => !disk.expanded)
  if (disksToExpand.length === 0) return
  for (const disk of disksToExpand) {
    // format, encrypt, and add to LVM
    await formatDisk(disk)
    await encryptDisk(disk)
    await addDiskToLvm(disk)

    if (!mirror) {
      // expand filesystem
      await expandFilesystem(disk)
    }
  }
}
