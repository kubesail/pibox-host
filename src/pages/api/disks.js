import { promisify } from "util";
import { exec } from "child_process";
const execAsync = promisify(exec);

export default async function handler(req, res) {
  // Run lsblk command with the --json option
  // TODO once setup is complete, don't show let this route run again.
  try {
    const { stdout, stderr } = await execAsync("lsblk --json --bytes");
    const data = JSON.parse(stdout);
    let disks = sanitizeLsblk(data.blockdevices);
    disks = await Promise.all(disks.map((device) => getSmartData(device)));

    res.status(200).json(disks);
  } catch (err) {
    res.status(500).json({ error: "Disk error" });
    console.error(`exec error: ${err}`);
    return;
  }
}

function sanitizeLsblk(devices) {
  return devices
    .filter((device) => !device.name.startsWith("mmcblk"))
    .map((device) => {
      // Convert the drive size to a human-readable format
      const sizeInBytes = device.size;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(sizeInBytes) / Math.log(1000));
      const size =
        (sizeInBytes / Math.pow(1000, i)).toFixed(2) * 1 + " " + sizes[i];

      return { ...device, size, children: undefined };
    });
}

async function getSmartData(device) {
  try {
    const cmd = `smartctl --json -i -A /dev/${device.name}`;
    const { stdout } = await execAsync(cmd);
    const data = JSON.parse(stdout);
    let vendor = data.model_family;
    if (!vendor) {
      vendor = data.model_name.split(" ")[0];
    }
    const smartData = {
      name: device.name,
      size: device.size,
      serial: data.serial_number,
      model: MODELS[data.model_name] || data.model_name,
      vendor: VENDORS[vendor] || vendor,
    };
    return smartData;
  } catch (error) {
    console.error(`exec error: ${error}`);
    return { name: device.name, vendor: "smartctl-error" };
  }
}

const VENDORS = {
  "Crucial/Micron Client SSDs": "Crucial",
  // TODO if model starts with Samsung, then vendor is "Samsung"
};

const MODELS = {
  CT1000BX500SSD1: "BX500",
  CT1000MX500SSD1: "MX500",
  "Samsung SSD 870 EVO 1TB": "870 EVO",
};
