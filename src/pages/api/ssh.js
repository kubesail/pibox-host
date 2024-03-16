import { execAsync, middlewareAuth } from '@/functions'
import { readFile, writeFile } from 'fs/promises'

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!req.isOwner) {
    return res.status(400).json({ message: 'Only the owner can change SSH settings' })
  }

  if (req.method === 'GET') {
    getSettings(req, res)
  } else {
    updateSettings(req, res)
  }
}

async function getSettings(req, res) {
  const config = await readFile('/etc/ssh/sshd_config', 'utf-8')
  const passwordLogin = config.includes('PasswordAuthentication yes')
  let enabled = false
  try {
    const { stdout } = await execAsync('systemctl is-enabled ssh')
    if (stdout.includes('enabled')) enabled = true
  } catch {}
  res.status(200).json({ enabled, passwordLogin })
}

async function updateSettings(req, res) {
  const { enabled, passwordLogin } = req.body
  if (typeof enabled !== 'boolean' || typeof passwordLogin !== 'boolean') {
    return res.status(400).json({ message: 'Invalid request' })
  }

  let wasEnabled = false
  try {
    const { stdout } = await execAsync('systemctl is-enabled ssh')
    if (stdout.includes('enabled')) wasEnabled = true
  } catch {}

  const config = await readFile('/etc/ssh/sshd_config', 'utf-8')
  const newConfig = config
    .split('\n')
    .map((line) => {
      if (line.includes('PasswordAuthentication')) {
        return `PasswordAuthentication ${passwordLogin ? 'yes' : 'no'}`
      }
      return line
    })
    .join('\n')
  await writeFile('/etc/ssh/sshd_config', newConfig)

  if (wasEnabled && enabled) {
    console.log(`Restarting SSH service`)
    await execAsync('systemctl restart ssh')
  } else if (enabled) {
    console.log(`Enabling and starting SSH service`)
    await execAsync('systemctl enable ssh')
    await execAsync('systemctl start ssh')
  } else {
    console.log(`Disabling and stopping SSH service`)
    await execAsync('systemctl disable ssh')
    await execAsync('systemctl stop ssh')
  }

  res.status(200).json({ enabled, passwordLogin })
}
