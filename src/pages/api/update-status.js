import { stat } from "fs/promises";
import { getConfig } from "@/functions";

export default async function handler(req, res) {
  const config = await getConfig();
  if (config.downloadInProgress) {
    // check download progress
    // find the tar file in /opt/pibox-host
    const downloadStat = await stat(config.downloadPath);
    return res.status(200).json({
      downloadInProgress: true,
      downloadSize: config.downloadSize,
      percentDownloaded: downloadStat
        ? downloadStat.size / config.downloadSize
        : 0,
    });
  }
  return res.status(200).json({
    downloadInProgress: false,
  });
}
