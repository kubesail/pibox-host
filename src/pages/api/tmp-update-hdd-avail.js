import { getConfig, saveConfig } from '@/functions'

export default async function handler(req, res) {
  const config = await getConfig()
  config.newHddAvailable = req.body.newHddAvailable
  await saveConfig(config)
  res.status(200).json({
    newHddAvailable: config.newHddAvailable,
  })
}
