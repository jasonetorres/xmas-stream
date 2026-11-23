import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { createApp } from "../server/app.js";
import { listSponsors } from "../server/domain.js";
import { catalog } from "../server/overlayhtml.js";
import { campaign, siteUrl } from "../server/campaign.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "overlays");
const tmp = path.join("/tmp", "xmas-overlay-html");

function shot(htmlFile, pngFile) {
  return new Promise((resolve, reject) => {
    const child = spawn("google-chrome", [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--allow-file-access-from-files",
      "--default-background-color=00000000",
      "--user-data-dir=/tmp/chrome-overlay-" + path.basename(pngFile, ".png"),
      "--window-size=1280,720",
      `--screenshot=${pngFile}`,
      htmlFile,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    const finish = (err) => {
      child.kill("SIGKILL");
      if (err) reject(err);
      else resolve();
    };
    child.stdout.on("data", (chunk) => { text += chunk; if (text.includes("written to file")) finish(); });
    child.stderr.on("data", (chunk) => { text += chunk; if (text.includes("written to file")) finish(); });
    child.on("exit", () => { if (fs.existsSync(pngFile)) resolve(); });
    setTimeout(() => finish(new Error(`timed out ${path.basename(pngFile)}\n${text.slice(-400)}`)), 25000);
  });
}

const app = await createApp({
  SESSION_SECRET: "overlay-render-secret",
  ADMIN_CODE: "overlay-admin-code",
  SPONSOR_CODE: "overlay-sponsor",
  SQLITE_PATH: ":memory:",
  PUBLIC_DIR: path.join(root, "public"),
});
const sponsors = await listSponsors(app.db, "overlay-render-secret");
await app.close();

fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
const donate = await QRCode.toDataURL(campaign.tiltifyUrl, { margin: 1, width: 280, color: { dark: "#17110d", light: "#f5e6b8" } });
const enter = await QRCode.toDataURL(`${siteUrl}/enter`, { margin: 1, width: 280, color: { dark: "#17110d", light: "#f5e6b8" } });
const items = catalog(sponsors, path.join(root, "public"), { donate, enter });
const manifest = [];
for (const item of items) {
  const htmlFile = path.join(tmp, item.file.replace(/\.png$/, ".html"));
  const pngFile = path.join(outDir, item.file);
  fs.writeFileSync(htmlFile, item.html);
  await shot(`file://${htmlFile}`, pngFile);
  const buf = fs.readFileSync(pngFile);
  if (buf.readUInt32BE(16) !== 1280 || buf.readUInt32BE(20) !== 720) {
    throw new Error(`${item.file} is ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`);
  }
  manifest.push({ file: item.file, title: item.title });
  console.log(item.file, buf.length);
}
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`rendered ${manifest.length}`);
