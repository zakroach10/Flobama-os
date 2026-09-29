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
  var s = readStatus() || { title: 'Cam ·', detail: 'Waiting for FloBama Mac Camera…', ndiSources: [] };
  item.button.title = s.title || 'Cam ·';
  item.button.toolTip = s.detail || '';
  clearMenu();
  addDisabled(s.detail || 'FloBama Mac Camera');
  menu.addItem($.NSMenuItem.separatorItem);
  addDisabled('NDI sources on this Mac');
  var sources = s.ndiSources || [];
  if (!sources.length) {
    addDisabled(s.ndiNote || 'None discovered yet');
  } else {
    for (var i = 0; i < Math.min(sources.length, 20); i++) {
      var src = sources[i];
      var label = src.name || 'NDI';
      if (src.urlAddress) label = label + '  ·  ' + src.urlAddress;
      addDisabled(label);
    }
  }
  menu.addItem($.NSMenuItem.separatorItem);
  menu.addItem($.NSMenuItem.alloc.initWithTitleActionKeyEquivalent('Quit FloBama Cam status', 'terminate:', 'q'));
  $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(1.5));
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
