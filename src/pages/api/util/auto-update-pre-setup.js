import { checkForUpdates, prepareUpdate, update, writeScreen, checkSetupComplete } from '@/functions'
import c from 'chalk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const setupComplete = await checkSetupComplete()
  if (setupComplete) {
    console.log(c.cyan('Setup has already been completed. Not checking for automatic updates.'))
    return res.status(400).json({ error: 'Device has already been set up. Not checking for automatic updates.' })
  }

  const { currentVersion, latestVersion, updateAvailable } = await checkForUpdates(req, res)
  if (!updateAvailable) {
    console.log('[Pre-setup update check] ' + c.bgGreen.black(`Currently up to date (${latestVersion})`))
    return res.status(200).json({ success: true })
  }

  await writeScreen([
    { content: 'Updating...\nPlease Wait', color: '3C89C7', background: '000000', size: 36, y: 55 },
    { content: 'Downloading latest\nsecurity update\nprior to setup', color: '999', size: 26, y: 145 },
  ])

  //TODO call /update to latest
  console.log(
    '[Pre-setup update check] ' +
      c.bgYellow.black(`Update is available. Updating now (${currentVersion} -> ${latestVersion})`)
  )

  const { error } = await prepareUpdate(latestVersion)
  if (error) {
    return res.status(400).json({ error })
  }
  res.status(200).json({ message: 'Update started. Check update status route for progress.' })
  await update(latestVersion)
}
