import { promisify } from "util";
import { exec } from "child_process";
import { readFile } from "fs/promises";

export const execAsync = promisify(exec);

export function bytesToHuman(sizeInBytes) {
  if (sizeInBytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1000));
  return (sizeInBytes / Math.pow(1000, i)).toFixed(0) * 1 + " " + sizes[i];
}

export async function createUser(user) {
  user = user.toLowerCase();
  // check that user is a valid unix username
  if (!user.match(/^[a-z0-9_-]{0,30}$/)) {
    throw new Error(
      "Invalid username. Usernames must be less than 30 characters and consist of only alphanumeric characters, dashes, or underscores"
    );
  }

  // check that the new user doesn't already exist
  let users;
  try {
    users = await execAsync("grep -E '/bin/bash' /etc/passwd");
    users = users.stdout.split("\n").map((user) => {
      const [username] = user.split(":");
      return username;
    });
  } catch (err) {
    console.error(`Error listing users: ${err}`);
    throw new Error("Error listing users");
  }

  if (users.find((u) => u === user)) {
    console.error(`User ${user} already exists`);
    throw new Error("User already exists");
  } else {
    execAsync(`useradd -m -s /bin/bash ${user}`);
  }
}

export async function setPassword(user, password) {
  // set password
  console.log({ user, password });
  try {
    // await execAsync(`echo "${user}:${password}" | chpasswd`);
    const output = await execAsync(`echo "${user}:${password}" | chpasswd`);
    console.log(output.stdout);
  } catch (err) {
    console.error(`Error setting password: ${err}`);
    throw new Error("Error setting password for user " + user);
  }
}

export async function middlewareAuth(req, res) {
  // https://github.com/vercel/next.js/discussions/34179
  // TODO when Next.js supports Node runtimes in middlewares, move this function into a middleware for all routes
  // export const config = {
  //   matcher: [
  //     /*
  //      * Match all API routes except:
  //      */
  //     "/api/((?!disks|setup).*)",
  //   ],
  // };

  const [_scheme, deviceKey] = (req.headers?.authorization || "").split(" ");
  if (!deviceKey) {
    res.status(401).json({
      error:
        "Restricted route. Please include a device key in your authorization header. Example format: 'Authorization: bearer XXXXX'",
    });
    return false;
  }

  let config;
  try {
    const configFile = await readFile("/root/.pibox/config.json", "utf8");
    config = JSON.parse(configFile);
  } catch (err) {
    console.log("Error reading config file", err);
    res.status(401).json({
      error: "Unauthorized",
    });
    return false;
  }

  const device = config.devices.find((device) => device.key === deviceKey);
  if (!device) {
    res.status(401).json({
      error: "Unauthorized",
    });
    return false;
  }
  req.user = device.user;
  req.deviceName = device.name;
  req.devicePlatform = device.platform;
  req.isOwner = config.owner === device.user;
  console.log("Authorized request from", req.user, req.url, device.name);
  return true;
}

function createRAID1Array() {
  // const { execSync } = require('child_process');
  // const drive1 = 'sda';
  // const drive2 = 'sdb';
  // // Format the drives
  // console.log('Formatting drives...');
  // execSync(`sudo parted /dev/${drive1} mklabel gpt`);
  // execSync(`sudo parted /dev/${drive2} mklabel gpt`);
  // // Create RAID 1 (mirror) array
  // console.log('Creating RAID 1 (mirror) array...');
  // execSync(`sudo mdadm --create --verbose /dev/md0 --level=1 --raid-devices=2 /dev/${drive1} /dev/${drive2}`);
  // // Wait for the array to sync
  // console.log('Waiting for the array to sync (this may take a while)...');
  // execSync('sudo mdadm --wait /dev/md0');
  // console.log('RAID 1 (mirror) array created successfully!');
}
