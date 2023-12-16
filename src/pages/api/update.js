import { middlewareAuth, checkForUpdates, prepareUpdate, update } from '@/functions'

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!req.isOwner) {
    return res.status(400).json({ message: 'Only the owner can update' })
  }

  if (req.method === 'GET') {
    const updateInfo = await checkForUpdates(req, res)
    return res.status(200).json(updateInfo)
  } else if (req.method === 'POST') {
    const { version } = req.body
    const { error } = await prepareUpdate(version)
    if (error) {
      return res.status(400).json({ error })
    }
    res.status(200).json({
      message: 'Update started. Check update status route for progress.',
    })
    await update(version)
  }
}
