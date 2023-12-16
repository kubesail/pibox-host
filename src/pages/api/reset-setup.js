import { unlink } from 'fs/promises'
import { middlewareAuth, execAsync, execAndLog } from '@/functions'
import { CONFIG_FILE_PATH } from '@/constants'

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!req.isOwner) {
    return res.status(400).json({ error: 'Only the owner can reset setup' })
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
    await execAsync(`deluser --remove-home ${req.user}`)
  } catch (err) {
    errors.push(`Error deleting user: ${err}`)
  }

  if (errors.length) {
    return res.status(500).json({ error: errors.join(', ') })
  }
  return res.status(200).json({ message: 'Setup reset' })
}

async function resetDrives() {
  await execAndLog('GLOBAL', `umount /pibox`)
  await execAndLog('GLOBAL', `lvdisplay | grep "LV Path" | awk '{print $3}' | xargs -I {} lvchange -an {}`)
  await execAndLog('GLOBAL', `vgchange -an`)
  await execAndLog('GLOBAL', `lvremove /dev/pibox_vg/pibox_lv -y`, { bypassError: true })
  await execAndLog('GLOBAL', `vgremove pibox_vg -y`, { bypassError: true })
  await execAndLog('DRIVE1', `pvremove /dev/sda -y`, { bypassError: true })
  await execAndLog('DRIVE2', `pvremove /dev/sdb -y`, { bypassError: true })
  await execAndLog('DRIVE1', `echo "YES" | cryptsetup erase /dev/sda`, { bypassError: true })
  await execAndLog('DRIVE2', `echo "YES" | cryptsetup erase /dev/sdb`, { bypassError: true })
  await execAndLog('DRIVE1', `sudo dd if=/dev/zero of=/dev/sda bs=1M count=10`, { bypassError: true })
  await execAndLog('DRIVE2', `sudo dd if=/dev/zero of=/dev/sdb bs=1M count=10`, { bypassError: true })
  await unlink('/etc/pibox-host/initial-setup-complete')
}

/*
  # Also as a bash script so you can copy/paste for quick debugging
  deluser --remove-home dan
  umount /pibox
  sudo dd if=/dev/zero of=/dev/sda bs=1M count=10
  sudo dd if=/dev/zero of=/dev/sdb bs=1M count=10
  rm /etc/pibox-host/initial-setup-complete
*/

/*
  # Additional commands if you want to cleanly wipe the drives
  rm ~/.pibox/config.json
  USER=dan
  deluser --remove-home ${USER}
  # -----
  umount /pibox
  vgchange -an pibox_vg
  echo "YES" | cryptsetup luksClose /dev/mapper/encrypted_sda
  echo "YES" | cryptsetup luksClose /dev/mapper/encrypted_sdb

  # You can skip these lines as the full disk will be erased via "cryptsetup erase" below
  lvdisplay | grep "LV Path" | awk '{print $3}' | xargs -I {} lvchange -an {}
  vgchange -an
  lvremove /dev/pibox_vg/pibox_lv -y
  vgremove pibox_vg -y
  pvremove /dev/sda -y
  pvremove /dev/sdb -y
  
  echo "YES" | cryptsetup erase /dev/sda
  echo "YES" | cryptsetup erase /dev/sdb

  sudo dd if=/dev/zero of=/dev/sda bs=1M count=10
  sudo dd if=/dev/zero of=/dev/sdb bs=1M count=10
  rm /etc/pibox-host/initial-setup-complete
*/
