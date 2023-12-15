import { getConfig, saveConfig } from '@/functions'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const config = await getConfig()
  if (!config) {
    res.status(200).json({ message: 'success' })
  }
  const [_scheme, deviceKey] = (req.headers?.authorization || '').split(' ')
  config.sessions = config.sessions.filter((session) => session.key !== deviceKey)

  await saveConfig(config)
  res.status(200).json({ message: 'success' })
}
