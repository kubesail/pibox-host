import http from 'http'
import https from 'https'
import fs from 'fs'
import { promisify } from 'util'
import { exec, spawn } from 'child_process'
import { readFile, writeFile, readdir, rm, mkdir, stat } from 'fs/promises'
import { CONFIG_FILE_PATH, SETUP_COMPLETE_CHECK_FILEPATH } from '@/constants'
import { createHash } from 'crypto'
import { join } from 'path'

export const execAsync = promisify(exec)

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
  return true
}

export async function execAndLog(label, cmd, { bypassError = false } = {}) {
  if (!label || !cmd) {
    throw new Error('Missing label or command')
  }
  console.log(`[${label}] ${bypassError} running ${cmd}`)
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
  mkdir('/root/.pibox', { recursive: true })
  await writeFile(CONFIG_FILE_PATH, JSON.stringify(config))
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

export function sanitizeForLuks(password) {
  // hash the password and get a hex digest to prevent shell injection
  return createHash('sha256').update(password).digest('hex')
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
