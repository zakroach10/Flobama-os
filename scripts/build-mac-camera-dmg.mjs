import { spawnSync } from "node:child_process";
import { cp, mkdir, chmod, rm, symlink, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "clients", "mac-camera-connector");
const macDir = path.join(clientDir, "mac");
const staging = path.join(root, "tmp", "mac-camera-dmg");
const version = "1.4.4";
const output = path.join(root, "public", "downloads", `FloBama-Mac-Camera-${version}.dmg`);

const pkgRaw = await readFile(path.join(clientDir, "package.json"), "utf8");
let pkg;
try {
  pkg = JSON.parse(pkgRaw);
} catch (error) {
  console.error("Invalid clients/mac-camera-connector/package.json — refusing to build DMG.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
if (pkg.version !== version) {
  console.error(`package.json version ${pkg.version} does not match DMG version ${version}`);
  process.exit(1);
}

await rm(staging, { recursive: true, force: true });
const app = path.join(staging, "FloBama Mac Camera.app", "Contents");
const resourcesApp = path.join(app, "Resources", "app");
await mkdir(path.join(app, "MacOS"), { recursive: true });
await mkdir(path.join(resourcesApp, "lib"), { recursive: true });

await cp(path.join(macDir, "Info.plist"), path.join(app, "Info.plist"));
await cp(path.join(macDir, "mac-camera.sh"), path.join(app, "MacOS", "mac-camera"));
await chmod(path.join(app, "MacOS", "mac-camera"), 0o755);
await cp(path.join(clientDir, "index.mjs"), path.join(resourcesApp, "index.mjs"));
await cp(path.join(clientDir, "package.json"), path.join(resourcesApp, "package.json"));
await writeFile(path.join(resourcesApp, "VERSION"), `${version}\n`, "utf8");
await cp(path.join(clientDir, "lib", "adapters.mjs"), path.join(resourcesApp, "lib", "adapters.mjs"));
await cp(path.join(clientDir, "lib", "ndi.mjs"), path.join(resourcesApp, "lib", "ndi.mjs"));
await cp(path.join(clientDir, "lib", "sim-cameras.mjs"), path.join(resourcesApp, "lib", "sim-cameras.mjs"));
await cp(path.join(clientDir, "lib", "watchdog.mjs"), path.join(resourcesApp, "lib", "watchdog.mjs"));
await cp(path.join(clientDir, "lib", "inventory.mjs"), path.join(resourcesApp, "lib", "inventory.mjs"));
await cp(path.join(clientDir, "lib", "menubar.mjs"), path.join(resourcesApp, "lib", "menubar.mjs"));
await cp(path.join(clientDir, "lib", "preview-render.mjs"), path.join(resourcesApp, "lib", "preview-render.mjs"));

await cp(path.join(macDir, "Read Me.txt"), path.join(staging, "Read Me.txt"));
await cp(path.join(macDir, "reset-settings.command"), path.join(staging, "Reset settings.command"));
await chmod(path.join(staging, "Reset settings.command"), 0o755);
await symlink("/Applications", path.join(staging, "Applications"));

await mkdir(path.dirname(output), { recursive: true });
const writer = spawnSync("go", ["run", ".", staging, output], {
  cwd: path.join(root, "scripts", "mac-camera-dmg"),
  stdio: "inherit",
  env: {
    ...process.env,
    GOTOOLCHAIN: "auto",
    FLOBAMA_MAC_CAMERA_VOLUME: `FloBama Mac Camera ${version}`,
  },
});
if (writer.status !== 0) process.exit(writer.status ?? 1);
for (const old of ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.4.1", "1.4.2", "1.4.3"]) {
  await rm(path.join(root, "public", "downloads", `FloBama-Mac-Camera-${old}.dmg`), { force: true });
}
console.log(output);
