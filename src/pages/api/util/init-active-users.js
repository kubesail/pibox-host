import { getSystemUsers } from '@/functions'

export default async function handler(req, res) {
  global.users = await getSystemUsers()
  res.status(200).json({ success: true })
}
