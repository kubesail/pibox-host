import { promisify } from "util";
import { exec } from "child_process";
import { readFile } from "fs/promises";
const execAsync = promisify(exec);

export default async function handler(req, res) {
  // Run lsblk command with the --json option
  // TODO once setup is complete, don't show let this route run again.
  let serial = null;
  let version = null;

  try {
    const { stdout, stderr } = await execAsync("ip link show eth0");
    const macAddressRegex = /ether\s+([^\s]+)/;
    serial = stdout.match(macAddressRegex)[1]?.replace(/:/g, "");
  } catch (err) {
    console.error(`Error retrieving serial (eth0 mac): ${err}`);
  }

  try {
    const pkgPath = process.cwd() + "/package.json";
    const pkg = await readFile(pkgPath, "utf8");
    version = JSON.parse(pkg).version;
  } catch (err) {
    console.error(`Error reading package.json: ${err}`);
  }

  res.status(200).json({
    model: "PiBox 2-Bay SSD",
    serial: serial,
    publicKey: "AAAABBBB",
    version: version,
  });
}
