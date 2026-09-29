import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Writes status JSON and launches a JXA menu-bar helper on macOS. */

export function statusFilePath() {
  return join(homedir(), "Library", "Application Support", "FloBama Mac Camera", "status.json");
}

export async function writeMenubarStatus(status) {
  const path = statusFilePath();
  await mkdir(join(homedir(), "Library", "Application Support", "FloBama Mac Camera"), {
    recursive: true,
  });
  await writeFile(path, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

export function startMenubarHelper(log) {
  if (process.platform !== "darwin") {
    void log("Menu bar helper skipped (not macOS).");
    return null;
  }

  const statusPath = statusFilePath();
  const script = `
ObjC.import('Cocoa');
ObjC.import('Foundation');
var statusPath = ${JSON.stringify(statusPath)};
var app = $.NSApplication.sharedApplication;
app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
var item = $.NSStatusBar.systemStatusBar.statusItemWithLength($.NSVariableStatusItemLength);
item.button.title = 'Cam ·';
var menu = $.NSMenu.alloc.init;
menu.addItem($.NSMenuItem.alloc.initWithTitleActionKeyEquivalent('Quit FloBama Cam status', 'terminate:', 'q'));
item.menu = menu;

function readStatus() {
  try {
    var err = Ref();
    var raw = $.NSString.stringWithContentsOfFileEncodingError(statusPath, $.NSUTF8StringEncoding, err);
    if (!raw) return null;
    return JSON.parse(raw.js);
  } catch (e) {
    return null;
  }
}

while (true) {
  var s = readStatus() || { title: 'Cam ·', detail: 'Waiting for FloBama Mac Camera…' };
  item.button.title = s.title || 'Cam ·';
  item.button.toolTip = s.detail || '';
  $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(1.0));
}
`;

  const child = spawn("osascript", ["-l", "JavaScript", "-e", script], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  void log("Menu bar status helper started (top status bar).");
  return child;
}
