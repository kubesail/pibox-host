import { drawHomeScreen } from '@/functions'

export default async function handler(req, res) {
  await drawHomeScreen()
  res.status(200).json({ success: true })
}
