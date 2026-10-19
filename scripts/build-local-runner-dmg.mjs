import { spawnSync } from "node:child_process";
import { cp, mkdir, chmod, rm, symlink, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "clients", "local-runner");
const macDir = path.join(clientDir, "mac");
const staging = path.join(root, "tmp", "local-runner-dmg");
const version = "1.1.1";
const output = path.join(root, "public", "downloads", `FloBama-Local-Runner-${version}.dmg`);

const pkgRaw = await readFile(path.join(clientDir, "package.json"), "utf8");
const pkg = JSON.parse(pkgRaw);
if (pkg.version !== version) {
  console.error(`package.json version ${pkg.version} does not match DMG version ${version}`);
  process.exit(1);
}

await rm(staging, { recursive: true, force: true });
const app = path.join(staging, "FloBama Local Runner.app", "Contents");
const resourcesApp = path.join(app, "Resources", "app");
await mkdir(path.join(app, "MacOS"), { recursive: true });
await mkdir(path.join(resourcesApp, "lib"), { recursive: true });
await mkdir(path.join(resourcesApp, "wall-player"), { recursive: true });

await cp(path.join(macDir, "Info.plist"), path.join(app, "Info.plist"));
await cp(path.join(macDir, "local-runner.sh"), path.join(app, "MacOS", "local-runner"));
await chmod(path.join(app, "MacOS", "local-runner"), 0o755);

await cp(path.join(clientDir, "index.mjs"), path.join(resourcesApp, "index.mjs"));
await cp(path.join(clientDir, "package.json"), path.join(resourcesApp, "package.json"));
await cp(path.join(clientDir, "package-lock.json"), path.join(resourcesApp, "package-lock.json"));
await writeFile(path.join(resourcesApp, "VERSION"), `${version}\n`, "utf8");

// Package every lib module (cache, downloads, performance library, etc.).
const libDir = path.join(clientDir, "lib");
for (const file of await readdir(libDir)) {
  if (!file.endsWith(".mjs")) continue;
  await cp(path.join(libDir, file), path.join(resourcesApp, "lib", file));
}
await cp(path.join(clientDir, "wall-player", "index.html"), path.join(resourcesApp, "wall-player", "index.html"));
await cp(path.join(clientDir, "wall-player", "player.js"), path.join(resourcesApp, "wall-player", "player.js"));

const install = spawnSync("npm", ["ci", "--omit=dev"], { cwd: resourcesApp, stdio: "inherit" });
if (install.status !== 0) process.exit(install.status ?? 1);

await cp(path.join(macDir, "Read Me.txt"), path.join(staging, "Read Me.txt"));
await cp(path.join(macDir, "reset-settings.command"), path.join(staging, "Reset settings.command"));
await chmod(path.join(staging, "Reset settings.command"), 0o755);
await symlink("/Applications", path.join(staging, "Applications"));

await mkdir(path.dirname(output), { recursive: true });
const writer = spawnSync("go", ["run", ".", staging, output], {
  cwd: path.join(root, "scripts", "local-runner-dmg"),
  stdio: "inherit",
  env: {
    ...process.env,
    GOTOOLCHAIN: "auto",
    FLOBAMA_LOCAL_RUNNER_VOLUME: `FloBama Local Runner ${version}`,
  },
});
if (writer.status !== 0) process.exit(writer.status ?? 1);

// Keep only the current Local Runner DMG in public downloads.
for (const file of await readdir(path.join(root, "public", "downloads"))) {
  if (!/^FloBama-Local-Runner-/.test(file)) continue;
  if (file === `FloBama-Local-Runner-${version}.dmg`) continue;
  await rm(path.join(root, "public", "downloads", file), { force: true });
}
console.log(output);
