import { stat, readdir, rename, unlink, mkdir } from 'fs/promises'
import fs from 'fs'
import { getConfig, middlewareAuth, bytesToHuman } from '@/functions'
import { fileTypeFromFile } from 'file-type'
import getRawBody from 'raw-body'
import sharp from 'sharp'
import { PIBOX_FILES_PREFIX } from '@/constants'

function checkCollaboratorAccess(piboxConfig, user, slug) {
  const share = piboxConfig.shares.find((share) => slug[0] === share.name)
  if (!share || !share.users.includes(user)) return false
  return true
}

function collaboratorSlugToRealSlug(piboxConfig, slug) {
  for (const share of piboxConfig.shares) {
    if (share.name === slug[0]) return share.path + slug.slice(1).join('/')
  }
  throw new Error('Collaborator slug not found')
}

async function getCollaboratorSharesIndex(req, res, piboxConfig, user) {
  let shares = piboxConfig.shares.filter((share) => share.users.includes(user))
  shares = shares.map(async (share) => {
    try {
      const path = PIBOX_FILES_PREFIX + share.path
      const stats = await stat(path)
      return {
        name: share.name,
        dir: true,
        mtime: stats.mtime,
        ctime: stats.ctime,
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null
      }
      throw err
    }
  })
  shares = await Promise.all(shares)
  shares = shares.filter(Boolean)
  return res.status(200).json(shares)
}

export default async function handler(req, res) {
  if (!(await middlewareAuth(req, res))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const piboxConfig = await getConfig()

  let slug
  if (req.isOwner) {
    slug = req.query.slug ? req.query.slug.join('/') : ''
  } else {
    if (!req.query.slug || req.query.slug.length < 1) {
      return getCollaboratorSharesIndex(req, res, piboxConfig, req.user)
    }
    const hasAccess = checkCollaboratorAccess(piboxConfig, req.user, req.query.slug)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    slug = collaboratorSlugToRealSlug(piboxConfig, req.query.slug)
  }

  const filePath = `${PIBOX_FILES_PREFIX}${slug}`

  // basic CRUD operations
  if (req.method === 'PUT') {
    const contentLength = req.headers['content-length']
    if (contentLength === '0') {
      // console.log('Creating folder')
      return await createFolder({ res, path: filePath })
    } else {
      // console.log('Uploading file')
      return await uploadFile({ req, res, filePath })
    }
  } else if (req.method === 'GET') {
    return await getFileOrDirListing({ req, res, path: filePath, piboxConfig, slug })
  } else if (req.method === 'POST') {
    const body = await getRawBody(req)
    let { newPath } = JSON.parse(body)
    newPath = newPath.replace(/^\/files/, '')
    newPath = `${PIBOX_FILES_PREFIX}${newPath}`
    // TODO update sharing permissions if newPath is a folder
    return await renameFile({ res, oldPath: filePath, newPath })
  } else if (req.method === 'DELETE') {
    return await deleteFile({ res, filePath })
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function createFolder({ res, path }) {
  try {
    await mkdir(path)
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: `Folder already exists` })
    }
    return res.status(500).json({ error: `Error creating folder: ${err}` })
  }
  return res.status(200).json({ message: 'Folder created' })
}

async function getFileOrDirListing({ req, res, path, piboxConfig, slug }) {
  let stats
  try {
    stats = await stat(path)
  } catch (err) {
    return res.status(404).json({ error: `File not found` })
  }

  const isDirectory = stats.isDirectory()

  if (!isDirectory) {
    // console.log('not a directory')
    let width = parseInt(req.headers['x-pibox-width'], 10)
    let height = parseInt(req.headers['x-pibox-height'], 10)
    const mimeType = await fileTypeFromFile(path)
    const headers = {
      'Content-Type': mimeType ? mimeType.mime : 'application/octet-stream',
    }

    const readableStream = fs.createReadStream(path)
    if (width && height) {
      try {
        const transformer = sharp().resize({
          width,
          height,
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy,
        })
        readableStream.pipe(transformer).pipe(res)
        res.writeHead(200, headers)
      } catch (err) {
        return res.status(400).json({ error: `Error resizing image: ${err}` })
      }
    } else {
      headers['Content-Length'] = stats.size
      res.writeHead(200, headers)
      readableStream.pipe(res)
    }

    return
  }

  const files = await readdir(path)
  // filter out hidden files and folders
  const filteredFiles = files.filter((file) => !file.startsWith('.'))
  // get the stats for each file and folder
  const filesWithStats = await Promise.all(
    filteredFiles.map(async (file) => {
      const entryPath = `${path}/${file}`
      const stats = await stat(entryPath)
      const isDirectory = stats.isDirectory()
      let mimeType = null
      if (!isDirectory) {
        mimeType = await fileTypeFromFile(entryPath)
      }
      const res = {
        name: file,
        dir: isDirectory,
        mtime: stats.mtime,
        ctime: stats.ctime,
      }
      if (isDirectory) {
        res.subItemCount = fs.readdirSync(entryPath).length
      } else {
        res.size = bytesToHuman(stats.size)
        res.mime = mimeType ? mimeType.mime : null
      }
      return res
    })
  )

  // TODO get real disk stats from /dev/mdX
  const diskUsed = '240GB'
  const diskTotal = '1TB'
  const diskPercent = '0.24'
  const headers = {
    'Content-Type': 'application/json',
    'X-Pibox-Disk-Used': diskUsed,
    'X-Pibox-Disk-Total': diskTotal,
    'X-Pibox-Disk-Percent': diskPercent,
  }
  headers['X-Pibox-Access'] = ''
  if (req.isOwner) {
    slug = slug.endsWith('/') ? slug : slug + '/'
    const users = piboxConfig.shares.find((share) => slug.startsWith(share.path))?.users
    if (users?.length) {
      headers['X-Pibox-Access'] = users.join(',')
    }
  }
  res.writeHead(200, headers)
  return res.end(JSON.stringify(filesWithStats))
}

async function renameFile({ res, oldPath, newPath }) {
  if (!newPath) {
    return res.status(400).json({ error: 'Missing newPath' })
  }
  try {
    await rename(oldPath, newPath)
  } catch (err) {
    return res.status(500).json({ error: `Error renaming file: ${err}` })
  }
  return res.status(200).json({ message: 'File renamed' })
}

function uploadFile({ req, res, filePath }) {
  return new Promise((resolve, reject) => {
    // pipe the incoming request to the file path
    const stream = fs.createWriteStream(filePath)
    req.pipe(stream)
    req.on('error', (err) => {
      console.error(`Error uploading file: ${err}`)
      return reject(res.status(500).json({ error: err.message }))
    })
    req.on('end', () => {
      // console.log('File uploaded')
      resolve(res.status(200).json({ message: 'File uploaded' }))
    })
  })
}

async function deleteFile({ res, filePath }) {
  try {
    await unlink(filePath)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(200).json({ message: 'File already deleted' })
    }
    return res.status(500).json({ error: `Error deleting file: ${err}` })
  }
  return res.status(200).json({ message: 'File deleted' })
}

export const config = {
  api: { bodyParser: false },
}
