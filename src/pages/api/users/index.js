import { createUser, setSystemPassword, middlewareAuth, getConfig, saveConfig, getSystemUsers } from '@/functions'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return listUsers(req, res)
  } else if (req.method === 'POST') {
    if (!(await middlewareAuth(req, res))) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!req.isOwner) {
      return res.status(400).json({ error: 'Only the owner can create users' })
    }

    let { username, fullName, password } = req.body

    if (!fullName) {
      return res.status(400).json({ error: 'Missing full name' })
    }

    if (!username) {
      const firstName = fullName.split(' ')[0]
      username = username || firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
    }

    try {
      await createUser(username, fullName)
    } catch (err) {
      // console.log(err);
      if (err.message.includes('already exists')) {
        await createUser(username + Math.floor(Math.random() * 10000), fullName)
      } else {
        console.error(`Error creating user: ${err}`)
      }
    }

    if (password) {
      try {
        await setSystemPassword(username, password)
      } catch (err) {
        console.error(`Error setting user's password: ${err}`)
        return res.status(400).json({ error: err.message })
      }
    }
    const config = await getConfig()
    // config.users.push({ username, fullName });
    saveConfig(config)
    setTimeout(async () => {
      global.users = await getSystemUsers()
    }, 3000)
    return res.status(201).json({ message: 'User created' })
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function listUsers(req, res) {
  const users = await getSystemUsers()
  // console.log(users);
  res.status(200).json(users)
}
