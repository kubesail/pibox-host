import { readFile } from 'fs/promises'
import { getSystemSerial, checkSetupComplete } from '@/functions'

export default async function handler(req, res) {
  // Run lsblk command with the --json option
  // TODO once setup is complete, don't show let this route run again.
  let version = null

  const serial = await getSystemSerial()

  try {
    const pkgPath = process.cwd() + '/package.json'
    const pkg = await readFile(pkgPath, 'utf8')
    version = JSON.parse(pkg).version
  } catch (err) {
    console.error(`Error reading package.json: ${err}`)
  }

  const setupComplete = await checkSetupComplete()

  res.status(200).json({
    model: 'PiBox 2-Bay SSD',
    serial: serial,
    version: version,
    publicKey: global.PUBLIC_CERTIFICATE?.toString() || '',
    setupComplete,
    newHddAvailable: setupComplete && !global.ALL_DISKS_ENCRYPTED,
    unlocked: global.ALL_DISKS_UNLOCKED,
  })
}
