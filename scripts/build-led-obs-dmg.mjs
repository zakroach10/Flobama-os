import { spawnSync } from "node:child_process";
import { cp, mkdir, chmod, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "clients", "led-obs");
const macDir = path.join(clientDir, "mac");
const staging = path.join(root, "tmp", "led-obs-dmg");
const output = path.join(root, "public", "downloads", "FloBama-LED-OBS-1.0.2.dmg");
const previous = path.join(root, "public", "downloads", "FloBama-LED-OBS-1.0.1.dmg");

await rm(staging, { recursive: true, force: true });
const app = path.join(staging, "FloBama LED OBS.app", "Contents");
const resourcesApp = path.join(app, "Resources", "app");
await mkdir(path.join(app, "MacOS"), { recursive: true });
await mkdir(resourcesApp, { recursive: true });

await cp(path.join(macDir, "Info.plist"), path.join(app, "Info.plist"));
await cp(path.join(macDir, "led-obs.sh"), path.join(app, "MacOS", "led-obs"));
await chmod(path.join(app, "MacOS", "led-obs"), 0o755);
await cp(path.join(clientDir, "index.mjs"), path.join(resourcesApp, "index.mjs"));
await cp(path.join(clientDir, "package.json"), path.join(resourcesApp, "package.json"));
await cp(path.join(clientDir, "package-lock.json"), path.join(resourcesApp, "package-lock.json"));

const install = spawnSync("npm", ["ci", "--omit=dev"], { cwd: resourcesApp, stdio: "inherit" });
if (install.status !== 0) process.exit(install.status ?? 1);

await cp(path.join(macDir, "Read Me.txt"), path.join(staging, "Read Me.txt"));
await cp(path.join(macDir, "reset-settings.command"), path.join(staging, "Reset settings.command"));
await chmod(path.join(staging, "Reset settings.command"), 0o755);
await symlink("/Applications", path.join(staging, "Applications"));

await mkdir(path.dirname(output), { recursive: true });
const writer = spawnSync("go", ["run", ".", staging, output], {
  cwd: path.join(root, "scripts", "led-obs-dmg"),
  stdio: "inherit",
  env: { ...process.env, GOTOOLCHAIN: "auto" },
});
if (writer.status !== 0) process.exit(writer.status ?? 1);
await rm(previous, { force: true });
console.log(output);
