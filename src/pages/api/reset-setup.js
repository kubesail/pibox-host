import { readFile, unlink } from 'fs/promises'
import { middlewareAuth, execAsync, execAndLog } from '@/functions'
import { CONFIG_FILE_PATH } from '@/constants'

// NOTE See bin/reset-setup.sh for the bash version of this script

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.body.resetCode) {
    global.resetAttempts = global.resetAttempts || 0
    if (global.resetAttempts > 3) {
      return res.status(400).json({ error: 'Too many reset attempts' })
    }
    global.resetAttempts++

    if (!global.resetCode) {
      return res.status(400).json({ error: 'No reset code. Please generate one first' })
    }
  }

  if (req.body.resetCode) {
    if (req.body.resetCode !== global.resetCode) {
      return res.status(400).json({ error: 'Invalid reset code' })
    }
  } else if (!(await middlewareAuth(req, res)) || !req.isOwner) {
    return res.status(400).json({ error: 'Unauthorized. Only the owner can reset setup' })
  }

  if (req.body.YES_I_KNOW_WHAT_IM_DOING_AND_UNDERSTAND_THIS_WILL_DELETE_DATA !== true) {
    return res.status(400).json({ error: 'Missing confirmation' })
  }

  const errors = []

  try {
    await resetDrives()
  } catch (err) {
    console.error(`Error resetting drive: ${err}`)
    throw err
  }

  try {
    await unlink(CONFIG_FILE_PATH)
  } catch (err) {
    errors.push('Error deleting setup config file')
  }

  try {
    // remove linux user and home directory (--remove-home)
    const owner = await readFile('/etc/pibox-host/owner', 'utf8')
    await execAsync(`deluser --remove-home ${owner.trim()}`)
  } catch (err) {
    errors.push(`Error deleting user: ${err}`)
  }

  try {
    await unlink('/etc/pibox-host/initial-setup-complete')
  } catch {}

  if (errors.length) {
    return res.status(500).json({ error: errors.join('\n') })
  }
  return res.status(200).json({ message: 'Setup reset' })
}

async function resetDrives() {
  await execAndLog('GLOBAL', `umount /pibox`, { bypassError: true })
  await execAndLog('GLOBAL', `lvdisplay | grep "LV Path" | awk '{print $3}' | xargs -I {} lvchange -an {}`, { bypassError: true })
  await execAndLog('GLOBAL', `vgchange -an`, { bypassError: true })
  await execAndLog('GLOBAL', `lvremove /dev/pibox_vg/pibox_lv -y`, { bypassError: true })
  await execAndLog('GLOBAL', `vgremove pibox_vg -y`, { bypassError: true })
  await execAndLog('DRIVE1', `pvremove /dev/sda -y`, { bypassError: true })
  await execAndLog('DRIVE2', `pvremove /dev/sdb -y`, { bypassError: true })
  await execAndLog('DRIVE1', `echo "YES" | cryptsetup erase /dev/sda`, { bypassError: true })
  await execAndLog('DRIVE2', `echo "YES" | cryptsetup erase /dev/sdb`, { bypassError: true })
  await execAndLog('DRIVE1', `dd if=/dev/zero of=/dev/sda bs=1M count=10`, { bypassError: true })
  await execAndLog('DRIVE2', `dd if=/dev/zero of=/dev/sdb bs=1M count=10`, { bypassError: true })
}
