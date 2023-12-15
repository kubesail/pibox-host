import { promisify } from 'util'
import { exec } from 'child_process'
import { readFile } from 'fs/promises'
import { CONFIG_FILE_PATH } from '@/constants'
import { getSystemSerial, getConfig } from '@/functions'

export default async function handler(req, res) {
  // Run lsblk command with the --json option
  // TODO once setup is complete, don't show let this route run again.
  let version = null

  const config = await getConfig()
  const serial = await getSystemSerial()

  try {
    const pkgPath = process.cwd() + '/package.json'
    const pkg = await readFile(pkgPath, 'utf8')
    version = JSON.parse(pkg).version
  } catch (err) {
    console.error(`Error reading package.json: ${err}`)
  }

  const hasConfig = config !== null
  res.status(200).json({
    model: 'PiBox 2-Bay SSD',
    serial: serial,
    publicKey: 'AAAABBBB',
    version: version,
    setupComplete: global.DISKS_INITIALIZED ? (global.DISKS_UNLOCKED ? hasConfig : true) : false, // if drives are locked then assume setup is complete
    newHddAvailable: !global.DISKS_INITIALIZED,
    unlocked: global.DISKS_UNLOCKED,
    mounted: global.LVM_MOUNTED,
  })
}
