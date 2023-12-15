const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { exec } = require('child_process')
const execAsync = require('util').promisify(exec)
const http = require('http')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 80

// Always initialized to false, require the user to unlock the disk on boot
global.LVM_MOUNTED = false
global.DISKS_INITIALIZED = false
global.DISKS_UNLOCKED = false

// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

async function start() {
  console.log('Starting PiBox Host')
  await getDiskStatus()
  app.prepare().then(async () => {
    createServer((req, res) => {
      handle(req, res)
    }).listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
  })
}
start()

async function getDiskStatus() {
  let disks
  try {
    const { stdout } = await execAsync(`lsblk -J`)
    disks = JSON.parse(stdout)
      .blockdevices.map((disk) => ({ name: disk.name }))
      .filter((disk) => disk.name.startsWith('sd'))
  } catch (err) {
    console.error(`Could not list block devices: ${err}`)
    process.exit(1)
  }
  for (const disk of disks) {
    const { encrypted, unlocked } = await getLuksData(disk)
    disk.encrypted = encrypted
    disk.unlocked = unlocked
  }
  // if all disks are unlocked, mount the LVM
  if (disks.every((disk) => disk.unlocked === true)) {
    global.DISKS_UNLOCKED = true
    global.LVM_MOUNTED = true
    try {
      await execAsync('mount /dev/pibox_vg/pibox_lv /pibox')
    } catch (err) {
      console.error(`Error mounting logical volume: ${err}`)
    }
  }

  if (disks.every((disk) => disk.encrypted === true)) {
    global.DISKS_INITIALIZED = true
  }

  if (global.DISKS_INITIALIZED === false) {
    await writeScreen({ content: 'Welcome to PiBox', color: '3C89C7', background: '000000', size: 36, y: 70 })
    await writeScreen({ content: 'Please use app\n to begin setup', color: 'ccc', size: 28, y: 160 })
  } else if (!global.DISKS_UNLOCKED || !global.LVM_MOUNTED) {
    await writeScreen({ content: 'Disks Locked', color: '3C89C7', background: '000000', size: 36, y: 55 })
    await writeScreen({ content: 'Please login\n as owner\n to unlock', color: 'ccc', size: 28, y: 150 })
  } else {
    // nothing to do here, pibox-host must have been restarted while system still powered on
  }

  console.log(`Disk Status [${disks.map((drive) => drive.name).join(',')}]`)
  console.log('  All initialized (encrypted): ', global.DISKS_INITIALIZED)
  console.log('  All Unlocked: ', global.DISKS_UNLOCKED)
  console.log('  LVM Mounted: ', global.LVM_MOUNTED)
}

async function writeScreen(options) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams(options).toString()
    const req = http.request({ socketPath: '/var/run/pibox/framebuffer.sock', path: `/text?${params}`, method: 'POST' })
    req.write(params)
    setTimeout(() => resolve(), 200)
  })
}

async function getLuksData(device) {
  try {
    const { stdout: isLuks } = await execAsync(`cryptsetup isLuks /dev/${device.name}`)
    console.log(`isLuks: ${isLuks}`)
    let unlocked = false
    try {
      const { stdout: luksStatus } = await execAsync(`cryptsetup status encrypted_${device.name}`)
      unlocked = luksStatus.includes(`/dev/mapper/encrypted_${device.name} is active`)
    } catch (err) {
      console.error(`luksStatus error: ${err}`)
    }
    return { encrypted: true, unlocked: unlocked }
  } catch (error) {
    return { encrypted: null, unlocked: null }
  }
}
