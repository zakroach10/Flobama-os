import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { STATUS_FILE } from "./paths.mjs";

export async function writeMenubarStatus(status) {
  await mkdir(dirname(STATUS_FILE), { recursive: true });
  await writeFile(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

export function startMenubarHelper(log) {
  if (process.platform !== "darwin") {
    void log("Menu bar helper skipped (not macOS).");
    return null;
  }

  const statusPath = STATUS_FILE;
  const script = `
ObjC.import('Cocoa');
ObjC.import('Foundation');
var statusPath = ${JSON.stringify(statusPath)};
var app = $.NSApplication.sharedApplication;
app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
var item = $.NSStatusBar.systemStatusBar.statusItemWithLength($.NSVariableStatusItemLength);
item.button.title = 'Flo ·';
var menu = $.NSMenu.alloc.init;
item.menu = menu;

function clearMenu() {
  while (menu.numberOfItems > 0) {
    menu.removeItemAtIndex(0);
  }
}

function addDisabled(title) {
  var mi = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(title, null, '');
  mi.enabled = false;
  menu.addItem(mi);
}

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
  var s = readStatus() || { title: 'Flo ·', detail: 'Starting Local Runner…' };
  item.button.title = s.title || 'Flo ·';
  item.button.toolTip = s.detail || '';
  clearMenu();
  addDisabled(s.detail || 'FloBama Local Runner');
  if (s.wallUrl) addDisabled(s.wallUrl);
  if (s.cacheLine) addDisabled(s.cacheLine);
  if (s.obsLine) addDisabled(s.obsLine);
  menu.addItem($.NSMenuItem.separatorItem);
  menu.addItem($.NSMenuItem.alloc.initWithTitleActionKeyEquivalent('Quit FloBama status', 'terminate:', 'q'));
  $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(1.5));
}
`;

  const child = spawn("osascript", ["-l", "JavaScript", "-e", script], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  void log("Menu bar status helper started.");
  return child;
}
