import { readFile } from 'fs/promises'
import { getSystemSerial, checkSetupComplete } from '@/functions'

export default async function handler(req, res) {
  // Run lsblk command with the --json option
  // TODO once setup is complete, don't show let this route run again.
  const serial = await getSystemSerial()
  const setupComplete = await checkSetupComplete()

  res.status(200).json({
    model: 'PiBox 2-Bay SSD',
    serial: serial,
    version: global.VERSION,
    publicKey: global.PUBLIC_CERTIFICATE?.toString() || '',
    setupComplete,
    newHddAvailable: setupComplete && !global.ALL_DISKS_ENCRYPTED,
    unlocked: global.ALL_DISKS_UNLOCKED,
  })
}
