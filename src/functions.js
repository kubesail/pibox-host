import { promisify } from "util";
import { exec } from "child_process";
import { readFile } from "fs/promises";
const execAsync = promisify(exec);

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
    if (users.find((u) => u === user)) {
      console.error(`User ${user} already exists`);
      throw new Error("User already exists");
    } else {
      execAsync(`useradd -m -s /bin/bash ${user}`);
    }
  } catch (err) {
    console.error(`Error creating new user: ${err}`);
    throw new Error("Error creating new user");
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

  const [_scheme, deviceKey] = (req.headers?.authorization||'').split(" ");
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
