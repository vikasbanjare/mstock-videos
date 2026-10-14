import fs from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);

// Cloud containers ship Chromium here; elsewhere Remotion downloads its own.
const preinstalled = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (fs.existsSync(preinstalled)) {
  Config.setBrowserExecutable(preinstalled);
}
