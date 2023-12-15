import { readFile } from 'fs/promises'
import { getConfig, saveConfig, checkSystemPassword, execAsync, sanitizeForLuks, execAndLog } from '@/functions'

const OTP_EXPIRY_WINDOW = 1000 * 60 * 10 // 10 minutes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let { ownerLogin = false, user, password, oneTimePassword, sessionKey, sessionName, sessionPlatform } = req.body

  if (ownerLogin && !global.DISKS_UNLOCKED) {
    const drivePassword = sanitizeForLuks(password)
    await execAsync(`echo "${drivePassword}" | sudo cryptsetup luksOpen /dev/sda encrypted_sda`)
    await execAsync(`echo "${drivePassword}" | sudo cryptsetup luksOpen /dev/sdb encrypted_sdb`)
    await execAndLog('GLOBAL', `mount /dev/pibox_vg/pibox_lv /pibox`)
    global.DISKS_UNLOCKED = true
    global.LVM_MOUNTED = true
  }

  if (oneTimePassword) {
    const config = await getConfig()

    // filter out expired one-time passwords, and save back to config object
    config.oneTimePasswords = config.oneTimePasswords.filter((otp) => {
      if (new Date(otp.date).valueOf() + OTP_EXPIRY_WINDOW > Date.now()) {
        return true
      }
    })

    const otp = config.oneTimePasswords.find((otp) => otp.oneTimePassword === oneTimePassword)
    if (!otp) {
      return res.status(400).json({ error: 'Invalid one-time password' })
    }
    config.oneTimePasswords = config.oneTimePasswords.filter((otp) => otp.oneTimePassword !== oneTimePassword)
    user = otp.user
    await pushSession({ config, sessionKey, sessionName, sessionPlatform, user })
    return res.status(200).json({ message: 'Login successful' })
  }

  if (ownerLogin) {
    const config = await getConfig()
    user = config.owner
  }

  if (!user || !password) {
    return res.status(400).json({ error: 'Must send a oneTimePassword or a user / password combination' })
  }

  // read /etc/shadow
  let etcShadowUser
  try {
    const etcShadow = await readFile('/etc/shadow', 'utf8')
    etcShadowUser = etcShadow
      .split('\n')
      .map((user) => {
        const [username, passwordHash] = user.split(':')
        return { username, passwordHash }
      })
      .find((userObj) => userObj.username === user)
  } catch (err) {
    console.error(`Error getting users: ${err}`)
    return res.status(500).json({ error: 'Error getting users' })
  }

  if (!etcShadowUser) {
    return res.status(400).json({ error: 'User not found' })
  }

  const validLogin = await checkSystemPassword(password, etcShadowUser.passwordHash)

  if (!validLogin) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  const config = await getConfig()
  await pushSession({ config, sessionKey, sessionName, sessionPlatform, user })

  // TODO if owner, then use pass password to sedutil to unlock both drives and mount them

  res.status(200).json({ message: 'Login successful' })
}

async function pushSession({ config, sessionKey, sessionName, sessionPlatform, user }) {
  const existingSession = config.sessions.find((session) => session.key === sessionKey)
  if (!existingSession) {
    config.sessions.push({
      user: user,
      key: sessionKey,
      name: sessionName,
      platform: sessionPlatform,
    })
  }
  await saveConfig(config)
}
