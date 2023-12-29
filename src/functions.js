import http from 'http'
import https from 'https'
import fs from 'fs'
import { promisify } from 'util'
import { exec, spawn } from 'child_process'
import { readFile, writeFile, readdir, rm, mkdir, stat } from 'fs/promises'
import { OWNER_FILE_PATH, CONFIG_FILE_PATH, SETUP_COMPLETE_CHECK_FILEPATH } from '@/constants'
import { createHash } from 'crypto'
import { join } from 'path'
import { createCanvas } from 'canvas'
import randomColor from 'randomcolor'
import c from 'chalk'
import { setTimeout as setTimeoutPromise } from 'timers/promises'

export const execAsync = promisify(exec)
const PRESET_COLORS = '#1BBE4D,#D96CFF,#FF7896,#F9F871,#5C83FF'.split(',')

export async function drawHomeScreen() {
  const start = performance.now()
  const width = 240
  const height = 240

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  if (!global.storage || global.storage.lastChecked < Date.now() - 1000 * 60 * 1) {
    const { stdout: dfOutput } = await execAsync('df /pibox')
    const lines = dfOutput.split('\n')
    const data = lines[1].split(/\s+/)
    global.storage = {}
    global.storage.usedSpace = data[2]
    global.storage.totalSpace = data[1]
    global.storage.percentageUsed = parseInt(data[4], 10)
    global.storage.lastChecked = Date.now()
  }

  function bytesToHuman(sizeInBytes) {
    if (sizeInBytes === 0) return '0 TB'
    const sizeInTerabytes = sizeInBytes / Math.pow(1000, 4)
    return sizeInTerabytes.toFixed(1) + ' TB'
  }

  function drawStorageInfo() {
    // Draw the "screen" of the storage with a border radius
    drawRoundedRect(ctx, 20, 85, 200, 55, 10, '#555')

    // Draw the "progress" on the storage with a border radius
    let progressWidth = (200 * global.storage.percentageUsed) / 100
    progressWidth = Math.max(progressWidth, 11)
    drawRoundedRect(ctx, 20, 85, progressWidth, 55, 10, '#3c89c7')

    const usedSpaceHuman = bytesToHuman(global.storage.usedSpace * 1024)
    const totalSpaceHuman = bytesToHuman(global.storage.totalSpace * 1024)

    // Add the text
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = '#fff'
    ctx.fillText(`${global.storage.percentageUsed}%      ${usedSpaceHuman} / ${totalSpaceHuman}`, 25, 165)
  }

  // Function to draw a rounded rectangle
  function drawRoundedRect(ctx, x, y, width, height, radius, fillColor) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    if (fillColor) {
      ctx.fillStyle = fillColor
      ctx.fill()
    }
  }

  // Function to draw a green checkmark icon with a rounded rectangle background
  function drawCheckmarkIcon(ctx, x, y, size, backgroundColor, checkmarkColor) {
    // Draw the rounded rectangle background
    drawRoundedRect(ctx, x, y, size, size, 5, backgroundColor)
    // Draw the checkmark
    ctx.strokeStyle = checkmarkColor
    ctx.lineWidth = 1
    // Start the path for the checkmark
    ctx.beginPath()
    const checkStartX = x + size * 0.28
    const checkStartY = y + size * 0.55
    const checkMidX = x + size * 0.42
    const checkMidY = y + size * 0.7
    const checkEndX = x + size * 0.72
    const checkEndY = y + size * 0.4
    // Move to the start of the checkmark
    ctx.moveTo(checkStartX, checkStartY)
    // Draw line to the middle of the checkmark
    ctx.lineTo(checkMidX, checkMidY)
    // Draw line to the end of the checkmark
    ctx.lineTo(checkEndX, checkEndY)
    // Stroke the path
    ctx.lineWidth = 5
    ctx.stroke()
    ctx.lineWidth = 1
  }

  // Draw the background of the "screen"
  ctx.fillStyle = '#333'
  ctx.fillRect(0, 0, width, height)

  // Draw checkmark icon
  const iconSize = 40 // Size of the icon background
  drawCheckmarkIcon(ctx, 25, 25, iconSize, '#0f0', '#000') // x, y, size, background color, checkmark color

  // Call the function to draw the storage information
  drawStorageInfo()

  // Add the text
  ctx.font = 'bold 30px Arial'
  ctx.fillStyle = '#fff'
  ctx.fillText('Secure', 75, 55)

  // Function to draw user icon
  function drawUserIcon(x, y, color, isActive) {
    ctx.fillStyle = color
    ctx.strokeStyle = color
    // Draw head
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2, true) // head
    if (isActive) {
      ctx.fill()
    } else {
      ctx.stroke()
    }

    // Draw body with rounded shoulders
    const shoulderWidth = 13
    const bodyHeight = 22
    const shoulderRadius = 5 // Radius for the shoulder corners

    ctx.beginPath()
    ctx.moveTo(x - shoulderWidth, y + bodyHeight) // Start at bottom left
    ctx.lineTo(x - shoulderWidth, y + 15 + shoulderRadius) // Left side
    ctx.arcTo(x - shoulderWidth, y + 15, x - shoulderWidth + shoulderRadius, y + 15, shoulderRadius) // Bottom left rounded corner
    ctx.lineTo(x, y + 15) // Bottom
    ctx.arcTo(x + shoulderWidth, y + 15, x + shoulderWidth, y + 15 + shoulderRadius, shoulderRadius) // Bottom right rounded corner
    ctx.lineTo(x + shoulderWidth, y + bodyHeight + 1) // Right side
    ctx.lineTo(x - shoulderWidth, y + bodyHeight + 1) // Right side
    ctx.lineTo(x - shoulderWidth, y + bodyHeight) // Right side
    ctx.stroke()
    if (isActive) {
      ctx.fill()
    }
  }

  // Draw 4 user icons with different colors
  const iconSpacing = 33
  const startX = 30
  const startY = 200

  for (let i = 0; i < global.users.length; i++) {
    const user = global.users[i]
    const color = i === 0 ? '#4285f4' : '#80868b'
    const isActive = user.lastActive > Date.now() - 1000 * 60 * 1 // Show as active for 1 minute
    drawUserIcon(startX + i * iconSpacing, startY, color, isActive)
  }

  // Save the canvas as an image
  const buffer = canvas.toBuffer('image/png')

  http
    .request({
      socketPath: '/var/run/pibox/framebuffer.sock',
      path: '/image',
      method: 'POST',
    })
    .write(buffer)
  // console.log(`Home screen drawn in ${performance.now() - start}ms`)
}

export async function checkSetupComplete() {
  let setupComplete = false
  try {
    await stat(SETUP_COMPLETE_CHECK_FILEPATH)
    setupComplete = true
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  return setupComplete
}

export async function checkForUpdates(req, res) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'))
  const ghResponse = await fetch('https://api.github.com/repos/kubesail/pibox-host/releases')
  const releases = await ghResponse.json()
  const latestRelease = releases[0]
  const latestVersion = latestRelease.tag_name
  const currentVersion = `v${version}`
  return {
    currentVersion,
    latestVersion,
    updateAvailable: latestVersion !== currentVersion,
    changelog: latestRelease.body,
  }
}

export async function prepareUpdate(newVersion) {
  // remove all other folders in /opt/pibox-host that are not current version
  const basePath = '/opt/pibox-host'
  const allVersions = await readdir(basePath, { withFileTypes: true })
  const { version } = JSON.parse(await readFile('package.json', 'utf8'))
  const currentVersion = `v${version}`
  for (const dirEnt of allVersions) {
    if (!dirEnt.isDirectory()) continue
    if (dirEnt.name === currentVersion) continue
    const path = join(basePath, dirEnt.name)
    console.log(`Removing old version ${path}`)
    await rm(path, { recursive: true, force: true })
  }

  const ghResponse = await fetch('https://api.github.com/repos/kubesail/pibox-host/releases')
  const releases = await ghResponse.json()
  const release = releases
    .find((r) => r.tag_name === newVersion)
    ?.assets.find((asset) => asset.name === `pibox-host-${newVersion}.tar.gz`)
  if (!release) {
    return { error: 'Version not found' }
  }
  const downloadSize = release.size
  // save download size to config file
  let config = await getConfig()
  config.downloadInProgress = true
  config.downloadSize = downloadSize
  config.downloadPath = `/opt/pibox-host/${newVersion}.tar.gz`
  await saveConfig(config)

  // Download new version
  console.log(`Downloading new version ${newVersion}`)
  return { message: 'Update started. Check update status route for progress.' }
}

export async function update(newVersion) {
  const url = `https://github.com/kubesail/pibox-host/releases/download/${newVersion}/pibox-host-${newVersion}.tar.gz`
  const destinationPath = `/opt/pibox-host/${newVersion}.tar.gz`
  try {
    const result = await downloadFile(url, destinationPath)
    console.log(result)
  } catch (err) {
    console.log(err)
  }

  // untar update
  const newPath = `/opt/pibox-host/${newVersion}`
  // mkdir newPath
  await mkdir(newPath, { recursive: true })
  await execAsync(`tar -xzf ${destinationPath} -C ${newPath}`)
  await rm(destinationPath)

  console.log(`Updating service file to point to ${newVersion}`)
  // update pibox-host service file
  const serviceFile = await readFile(`/opt/pibox-host/${newVersion}/pibox-host.service`, 'utf8')
  const newServiceFile = serviceFile.replace(/PIBOX_HOST_VERSION/g, newVersion)
  await writeFile('/etc/systemd/system/pibox-host.service', newServiceFile)

  const config = await getConfig()
  config.downloadInProgress = false
  delete config.downloadSize
  delete config.downloadPath
  await saveConfig(config)

  // restart pibox-host service
  await execAsync('systemctl daemon-reload')
  await execAsync('systemctl restart pibox-host')
}

function downloadFile(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destinationPath)

    function download(url) {
      https
        .get(url, (response) => {
          if (response.statusCode === 200) {
            response.pipe(fileStream)
            response.on('end', () => {
              fileStream.close()
              resolve(`File "${destinationPath}" has been downloaded.`)
            })
          } else if (response.statusCode === 301 || response.statusCode === 302) {
            // Handle redirection
            if (response.headers.location) {
              download(response.headers.location) // Make a new request to the redirected URL
            } else {
              reject(`Received a 3XX status code, but no 'Location' header found.`)
            }
          } else {
            fileStream.close()
            fs.unlinkSync(destinationPath) // Delete the partially downloaded file on error
            reject(`Failed to download file. Status code: ${response.statusCode}`)
          }
        })
        .on('error', (err) => {
          fs.unlinkSync(destinationPath) // Delete the partially downloaded file on error
          reject(`Error: ${err.message}`)
        })
    }

    download(url)
  })
}

export function bytesToHuman(sizeInBytes) {
  if (sizeInBytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1000))
  return (sizeInBytes / Math.pow(1000, i)).toFixed(0) * 1 + ' ' + sizes[i]
}

export async function createUser(user, fullName) {
  user = user.toLowerCase()

  const beginWithRegex = /^[a-z]/i
  if (typeof user !== 'string' || user.length < 1 || !beginWithRegex.test(user)) {
    throw new Error('Your full name must start with a standard character (A-Z)')
  }

  // check that user is a valid unix username
  if (!user.match(/^[a-z0-9_-]{1,30}$/)) {
    throw new Error(
      'Invalid username. Usernames must be less than 30 characters and consist of only alphanumeric characters, dashes, or underscores'
    )
  }

  // check that the new user doesn't already exist
  let users
  try {
    users = await execAsync("grep -E '/bin/bash' /etc/passwd")
    users = users.stdout.split('\n').map((user) => {
      const [username] = user.split(':')
      return username
    })
  } catch (err) {
    console.error(`Error listing users: ${err}`)
    throw new Error('Error listing users')
  }

  if (users.find((u) => u === user)) {
    throw new Error(`User already exists (${user})`)
  } else {
    // : is an invalid full name character because it is an /etc/passwd delimiter
    fullName = fullName.replace(/:/g, '')
    // use strong bash quotes (') to escape the full name, and
    // sanitize fullName to escape any single quotes
    fullName = fullName.replace(/'/g, `'\\''`)
    execAsync(`useradd -m -s /bin/bash ${user} --comment '${fullName}'`)
  }
}

export async function middlewareAuth(req, res) {
  // https://github.com/vercel/next.js/discussions/34179
  // TODO when Next.js supports Node runtimes in middlewares, move this function into a middleware for all routes
  // export const config = {
  //   matcher: [
  //     /*
  //      * Match all API routes except:
  //      */
  //     "/api/((?!disks|setup).*)",
  //   ],
  // };

  const [_scheme, deviceKey] = (req.headers?.authorization || '').split(' ')
  if (!deviceKey) {
    res.status(401).json({
      error:
        "Restricted route. Please include a device key in your authorization header. Example format: 'Authorization: bearer XXXXX'",
    })
    return false
  }

  const config = await getConfig()

  const sessions = config.sessions.find((session) => session.key === deviceKey)
  if (!sessions) {
    res.status(401).json({
      error: 'Unauthorized',
    })
    return false
  }
  req.user = sessions.user
  req.deviceKey = sessions.key
  req.deviceName = sessions.name
  req.devicePlatform = sessions.platform
  req.isOwner = config.owner === sessions.user
  console.log(`Authorized ${req.method} ${req.url} from ${req.user} [${sessions.name}]`)
  global.users = global.users.map((user) => {
    if (user.username === sessions.user) {
      user.lastActive = Date.now()
    }
    return user
  })
  return true
}

export async function execAndLog(label, cmd, { bypassError = false } = {}) {
  if (!label || !cmd) {
    throw new Error('Missing label or command')
  }
  console.log(c.bgCyan.black(`[${label}, ${bypassError ? 'BypassError' : 'HaltOnError'}]`), cmd)
  if (bypassError) {
    try {
      await execAsync(cmd)
    } catch (err) {
      console.log('Bypassed error:', err)
    }
    return null
  }
  return execAsync(cmd)
}

export async function getConfig() {
  let config
  try {
    config = JSON.parse(await readFile(CONFIG_FILE_PATH, 'utf8'))
  } catch (err) {
    console.error(`Error reading config file: ${err}`)
    config = null
  }
  return config
}

export async function saveConfig(config) {
  if (!global.ALL_DISKS_UNLOCKED) {
    throw new Error('Cannot save config while disks are locked')
  }
  await writeFile(CONFIG_FILE_PATH, JSON.stringify(config))
}

export async function saveOwner(username) {
  await writeFile(OWNER_FILE_PATH, username)
}

export async function getOwner() {
  let username = await readFile(OWNER_FILE_PATH, 'utf8')
  username = username.trim()
  return username
}

export async function checkSystemPassword(password, hashedPassword) {
  return new Promise((resolve, reject) => {
    let stderr = ''
    let stdout = ''
    const subprocess = spawn('/bin/mkpasswd', [password, hashedPassword])
    subprocess.stdout.on('data', (data) => (stdout += data))
    subprocess.stderr.on('data', (data) => (stderr += data))
    subprocess.on('close', (exitCode) => {
      if (exitCode !== 0) {
        // mkpassword exits with code 2 if a full hashed password is provided the password is incorrect
        return resolve(false)
      }
      resolve(stdout.trim() === hashedPassword)
    })
  })
}

export async function setSystemPassword(username, password) {
  return new Promise((resolve, reject) => {
    let stderr = ''
    let stdout = ''
    const subprocess = spawn('/bin/mkpasswd', [password])
    subprocess.stdout.on('data', (data) => (stdout += data))
    subprocess.stderr.on('data', (data) => (stderr += data))
    subprocess.on('close', async (exitCode) => {
      if (exitCode !== 0) {
        console.error(`Error setting password: ${stderr}`)
        return reject(new Error('Error setting password'))
      }
      const hash = stdout.trim()
      let etcShadow = await readFile('/etc/shadow', 'utf8')
      etcShadow = etcShadow
        .split('\n')
        .map((line) => {
          const parts = line.split(':')
          if (username !== parts[0]) return line
          parts[1] = hash
          return parts.join(':')
        })
        .join('\n')
      await writeFile('/etc/shadow', etcShadow)
      resolve()
    })
  })
}

export async function setSambaPassword(username, password) {
  return new Promise((resolve, reject) => {
    let stderr = ''
    let stdout = ''
    const subprocess = spawn('/bin/smbpasswd', ['-a', username])
    subprocess.stdin.write(password + '\n' + password + '\n')
    subprocess.stdout.on('data', (data) => (stdout += data))
    subprocess.stderr.on('data', (data) => (stderr += data))
    subprocess.on('close', async (exitCode) => {
      if (exitCode !== 0) {
        console.error(`Error setting SAMBA password: ${stderr}`)
        return reject(new Error('Error setting SAMBA password'))
      }
      resolve()
    })
  })
}

export async function getSystemSerial() {
  let serial = null
  try {
    const { stdout, stderr } = await execAsync('ip link show eth0')
    const macAddressRegex = /ether\s+([^\s]+)/
    serial = stdout.match(macAddressRegex)[1]?.replace(/:/g, '')
  } catch (err) {
    console.error(`Error retrieving serial (eth0 mac): ${err}`)
  }
  return serial
}

export function sha256HexDigest(data) {
  return createHash('sha256').update(data).digest('hex')
}

export async function writeScreen(options) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams(options).toString()
    const req = http.request({
      socketPath: '/var/run/pibox/framebuffer.sock',
      path: `/text?${params}`,
      method: 'POST',
    })
    req.write(params)
    setTimeout(() => resolve(), 200)
  })
}

export async function drawScreen(image) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: '/var/run/pibox/framebuffer.sock',
      path: '/image',
      method: 'POST',
    })
    req.write(image)
    setTimeout(() => resolve(), 200)
  })
}

export async function startHomeScreen() {
  await setTimeoutPromise(2000)
  global.users = await getSystemUsers()
  if (!global.HOME_SCREEN_LOOP) {
    global.HOME_SCREEN_LOOP = setInterval(() => fetch('http://localhost/api/util/draw-home-screen'), 1000)
  }
}

export async function getLuksData(device) {
  try {
    const { stdout: isLuks, code } = await execAsync(`cryptsetup isLuks /dev/${device.name}`)
    let unlocked = false
    try {
      const { stdout: luksStatus } = await execAsync(`cryptsetup status encrypted_${device.name}`)
      unlocked = luksStatus.includes(`/dev/mapper/encrypted_${device.name} is active`)
    } catch (err) {}
    return { encrypted: true, unlocked: unlocked }
  } catch (error) {
    return { encrypted: false, unlocked: null }
  }
}

export async function getSystemUsers() {
  const config = await getConfig()
  if (!config) {
    return []
  }

  let users
  try {
    users = await readFile('/etc/passwd', 'utf8')
  } catch (err) {
    console.error(`Error getting users: ${err}`)
    return res.status(500).json({ error: 'Error getting users' })
  }

  return users
    .split('\n')
    .map((user) => {
      const [username, _password, _uid, _gid, fullName, _home, shell] = user.split(':')
      return { username, fullName, shell }
    })
    .filter((user) => ['/bin/bash', '/bin/zsh'].includes(user.shell) && user.username !== 'root')
    .sort((user) => {
      // sort owner first
      if (user.username === config.owner) return -1
      return 0
    })
    .map((user, index) => {
      return {
        fullName: user.fullName,
        username: user.username,
        isOwner: user.username === config.owner,
        color:
          PRESET_COLORS[index]?.toLowerCase() ||
          randomColor({
            luminosity: 'light',
            format: 'hex',
            seed: index * 3,
          }),
      }
    })
}
