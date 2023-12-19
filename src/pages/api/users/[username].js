import { promisify } from 'util'
import { exec } from 'child_process'
import { middlewareAuth, setSystemPassword } from '@/functions'
const execAsync = promisify(exec)

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'DELETE') {
    if (req.isOwner !== true) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const username = req.query.username
    if (username === req.user) {
      return res.status(400).json({ error: 'Cannot delete yourself' })
    }
    try {
      await execAsync(`deluser --remove-home ${username}`)
    } catch (err) {
      console.error(`Error deleting user: ${err}`)
      if (err.stderr.includes('does not exist')) {
        return res.status(404).json({ error: `User ${username} does not exist` })
      }
    }
    return res.status(200).json({ message: 'User deleted' })
  } else if (req.method === 'PUT') {
    if (req.isOwner !== true && req.user !== req.query.username) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!req.body.password) {
      return res.status(400).json({ error: 'Missing password' })
    }
    try {
      await setSystemPassword(req.query.username, req.body.password)
      return res.status(200).json({ message: 'Password updated' })
    } catch (err) {
      console.error(`Error setting password: ${err}`)
      return res.status(400).json({ error: err.message })
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}
