import { bytesToHuman, execAsync } from '@/functions'

export default async function handler(req, res) {
  // Run lsblk command with the --json option
  // TODO once setup is complete, don't show let this route run again.
  try {
    const { stdout, stderr } = await execAsync('lsblk --json --bytes --output +UUID')
    const data = JSON.parse(stdout)
    let { totalCapacity, totalCapacityMirrored, disks } = sanitizeLsblk(data.blockdevices)
    disks = await Promise.all(disks.map((device) => getSmartData(device)))
    res.status(200).json({ totalCapacity, totalCapacityMirrored, disks })
  } catch (err) {
    res.status(500).json({ error: 'Disk error' })
    console.error(`exec error: ${err}`)
    return
  }
}

function sanitizeLsblk(devices) {
  let totalCapacityMirrored = 0
  let totalCapacity = []
  const disks = devices
    .filter((device) => !device.name.startsWith('mmcblk'))
    .map((device) => {
      // Convert the drive size to a human-readable format
      totalCapacity.push(device.size)
      return {
        ...device,
        hasData: device.children?.some((child) => child.name === 'pibox_vg-pibox_lv'),
        size: bytesToHuman(device.size),
        children: undefined,
      }
    })

  totalCapacityMirrored = Math.min(...totalCapacity)
  totalCapacity = totalCapacity.reduce((a, b) => a + b, 0)
  return {
    totalCapacity: bytesToHuman(totalCapacity),
    totalCapacityMirrored: bytesToHuman(totalCapacityMirrored),
    disks,
  }
}

async function getSmartData(device) {
  try {
    const cmd = `smartctl --json -i -A /dev/${device.name}`
    const { stdout } = await execAsync(cmd)
    const data = JSON.parse(stdout)
    let vendor = data.model_family
    if (!vendor) {
      vendor = data.model_name.split(' ')[0]
    }
    console.log('smartdata', /CT\d+BX500SSD1/i.test(data.model_name))
    const smartData = {
      name: device.name,
      size: device.size,
      hasData: device.hasData,
      serial: data.serial_number,
      model: MODELS.find((model) => model.regex.test(data.model_name))?.name || data.model_name,
      vendor: VENDORS[vendor] || vendor,
    }
    return smartData
  } catch (error) {
    console.error(`exec error: ${error}`)
    return { name: device.name, vendor: 'smartctl-error' }
  }
}

const VENDORS = {
  'Crucial/Micron Client SSDs': 'Crucial',
  // TODO if model starts with Samsung, then vendor is "Samsung"
}

const MODELS = [
  { regex: /CT\d+MX500SSD1/i, name: 'MX500' },
  { regex: /CT\d+BX500SSD1/i, name: 'BX500' },
  { regex: /Samsung SSD 870 EVO/, name: '870 EVO' },
]
