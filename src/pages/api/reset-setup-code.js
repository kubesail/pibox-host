import { writeScreen } from '@/functions'

import { customAlphabet } from 'nanoid'

// NOTE See bin/reset-setup.sh for the bash version of this script

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (global.resetCode) {
    return res.status(400).json({ error: 'Reset code already generated. Please reboot the device to generate a new code.' })
  }

  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const nanoid = customAlphabet(alphabet, 8)
  global.resetCode = nanoid()

  const line1 = global.resetCode.slice(0, 4)
  const line2 = global.resetCode.slice(4)

  await writeScreen([
    { content: 'Reset Code:', color: 'CCCCCC', size: 34, center: true, y: 55 },
    { content: line1, color: 'FF0000', size: 60, bold: true, center: true, y: 130 },
    { content: line2, color: 'FF0000', size: 60, bold: true, center: true, y: 190 },
  ])

  res.status(200).json({ message: 'Reset code generated' })
}
