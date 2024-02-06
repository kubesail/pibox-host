const { createServer } = require('http')
const { createServer: createHttpsServer } = require('https')
const next = require('next')
const { mkdir, readFile, writeFile } = require('fs/promises')
const { exec, spawn } = require('child_process')
const promisify = require('util').promisify
const fs = require('fs')

const execAsync = promisify(exec)

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const HTTP_PORT = process.env.HTTP_PORT || 80
const HTTPS_PORT = process.env.HTTPS_PORT || 443
const KEY_PATH = process.env.KEY_PATH || '/etc/ssl/private'
const PRIVATE_KEY_PATH = `${KEY_PATH}/pibox.local.key`
const CERTIFICATE_PATH = `${KEY_PATH}/pibox.local.crt`

// Always initialized to false, require the user to unlock the disk on boot
global.ALL_DISKS_ENCRYPTED = false
global.ALL_DISKS_UNLOCKED = false
global.HOME_SCREEN_LOOP_RUNNING = false

// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port: HTTP_PORT })
const handle = app.getRequestHandler()

async function start() {
  console.log('Starting PiBox Host')
  await startFramebuffer()
  app.prepare().then(async () => {
    createServer((req, res) => {
      handle(req, res)
    }).listen(HTTP_PORT, async () => {
      console.log(`> Ready on http://${hostname}:${HTTP_PORT}`)
      await diskLockingStatus()
      await initActiveUsers()
      await autoUpdatePreSetup()
    })
    const httpsOpts = await getOrCreateKeys()
    createHttpsServer(httpsOpts, (req, res) => {
      handle(req, res)
    }).listen(HTTPS_PORT, async () => {
      console.log(`> Ready on https://${hostname}:${HTTPS_PORT}`)
    })
  })
}
start()

async function diskLockingStatus() {
  await fetch('http://localhost/api/util/disk-locking-status')
}

async function initActiveUsers() {
  await fetch('http://localhost/api/util/init-active-users')
}

async function autoUpdatePreSetup() {
  await fetch('http://localhost/api/util/auto-update-pre-setup', {
    method: 'POST',
    body: JSON.stringify({ version: 'latest' }),
  })
}

async function getKeys() {
  global.PUBLIC_CERTIFICATE = fs.readFileSync(CERTIFICATE_PATH)
  return {
    key: fs.readFileSync(PRIVATE_KEY_PATH),
    cert: global.PUBLIC_CERTIFICATE,
  }
}

async function getOrCreateKeys() {
  try {
    return await getKeys()
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    console.log('SSL Keyfiles not found. Generating now...')
    await mkdir(KEY_PATH, { recursive: true })
    const keyCmd = `openssl genpkey -algorithm RSA -out ${PRIVATE_KEY_PATH}`
    const certCmd = `openssl req -new -x509 -sha256 -key ${PRIVATE_KEY_PATH} -out ${CERTIFICATE_PATH} -days 36500 -subj "/CN=pibox.local"`
    await execAsync(keyCmd)
    await execAsync(certCmd)
    return await getKeys()
  }
}

async function startFramebuffer() {
  try {
    // Check that SPI is enabled
    let bootConfigLines = (await readFile('/boot/config.txt', 'utf8')).split('\n')
    let requiresReboot = false
    bootConfigLines = bootConfigLines.map((line) => {
      if (line === 'dtparam=spi=off' || line === '#dtparam=spi=on' || line === '#dtparam=spi=off') {
        requiresReboot = true
        line = 'dtparam=spi=on'
      }
      if (line === 'dtoverlay=drm-minipitft13,rotate=0,fps=60') line = '' // remove old TFT driver
      return line
    })
    if (requiresReboot) {
      console.log('Enabling SPI, rebooting...')
      await writeFile('/boot/config.txt', bootConfigLines.join('\n'))
      await execAsync('reboot now')
      process.exit()
    }

    // Start framebuffer
    const childProcess = spawn('./pibox-framebuffer', [], { stdio: 'inherit' })
    childProcess.on('error', (err) => console.log('Error starting framebuffer:', err))
  } catch (err) {
    console.log('Could not start framebuffer, skipping...', err)
  }
}
