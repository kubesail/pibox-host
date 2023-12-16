const { createServer } = require('http')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 80

// Always initialized to false, require the user to unlock the disk on boot
global.ALL_DISKS_ENCRYPTED = false
global.ALL_DISKS_UNLOCKED = false
global.HOME_SCREEN_LOOP_RUNNING = false

// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

async function start() {
  console.log('Starting PiBox Host')
  app.prepare().then(async () => {
    createServer((req, res) => {
      handle(req, res)
    }).listen(port, async () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      await diskLockingStatus()
      await autoUpdatePreSetup()
    })
  })
}
start()

async function diskLockingStatus() {
  await fetch('http://localhost/api/util/disk-locking-status')
}

async function autoUpdatePreSetup() {
  await fetch('http://localhost/api/util/auto-update-pre-setup', {
    method: 'POST',
    body: JSON.stringify({ version: 'latest' }),
  })
}
