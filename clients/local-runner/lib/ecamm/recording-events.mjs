/**
 * Authenticated local handler for Ecamm macOS Shortcuts recording/broadcast events.
 * Validates paths against configured recording roots; waits for files to finish writing.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { SUPPORT_DIR } from "../paths.mjs";
import { isPathInsideRoot } from "../recordings-serve.mjs";

export const RECORDING_EVENTS_FILE = join(SUPPORT_DIR, "ecamm-recording-events.json");
export const RECORDING_CALLBACK_SECRET_FILE = join(SUPPORT_DIR, "ecamm-callback-secret.txt");

export async function ensureRecordingCallbackSecret() {
  try {
    const existing = (await readFile(RECORDING_CALLBACK_SECRET_FILE, "utf8")).trim();
    if (existing.length >= 24) return existing;
  } catch {
    /* create */
  }
  await mkdir(dirname(RECORDING_CALLBACK_SECRET_FILE), { recursive: true });
  const secret = randomBytes(32).toString("base64url");
  await writeFile(RECORDING_CALLBACK_SECRET_FILE, `${secret}\n`, "utf8");
  return secret;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function eventDedupeKey(event) {
  const parts = [
    event.type || "",
    event.path || "",
    event.occurredAt || "",
    event.externalId || "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

async function loadStore() {
  try {
    return JSON.parse(await readFile(RECORDING_EVENTS_FILE, "utf8"));
  } catch {
    return { events: [], processedKeys: [] };
  }
}

async function saveStore(store) {
  await mkdir(dirname(RECORDING_EVENTS_FILE), { recursive: true });
  await writeFile(RECORDING_EVENTS_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

/**
 * Wait until file size is stable (finished writing) or timeout.
 */
export async function waitForStableFile(filePath, { settleMs = 1500, timeoutMs = 120_000 } = {}) {
  const started = Date.now();
  let lastSize = -1;
  let stableSince = 0;
  while (Date.now() - started < timeoutMs) {
    try {
      const s = await stat(filePath);
      if (!s.isFile()) return { ok: false, reason: "not_a_file" };
      if (s.size === lastSize && s.size > 0) {
        if (!stableSince) stableSince = Date.now();
        if (Date.now() - stableSince >= settleMs) {
          return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
        }
      } else {
        lastSize = s.size;
        stableSince = 0;
      }
    } catch {
      stableSince = 0;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { ok: false, reason: "timeout", size: lastSize };
}

export function pathAllowed(filePath, roots) {
  const resolved = resolve(filePath);
  return (roots || []).some((root) => root && isPathInsideRoot(resolve(root), resolved));
}

/**
 * @returns {{ ok: boolean, status: number, body: object }}
 */
export async function handleRecordingCallback(input, context) {
  const secret = await ensureRecordingCallbackSecret();
  if (!safeEqual(input.secret, secret)) {
    return { ok: false, status: 401, body: { error: "Unauthorized callback." } };
  }

  const type = String(input.type || "").trim();
  const allowedTypes = new Set([
    "recording_started",
    "recording_finished",
    "broadcast_started",
    "broadcast_finished",
  ]);
  if (!allowedTypes.has(type)) {
    return { ok: false, status: 400, body: { error: "Unknown event type." } };
  }

  const occurredAt = input.occurredAt || new Date().toISOString();
  const filePath = input.path ? resolve(String(input.path)) : null;

  if (filePath && type.endsWith("_finished")) {
    const roots = [];
    if (context.recordingsRoot) roots.push(context.recordingsRoot);
    if (Array.isArray(context.extraRoots)) roots.push(...context.extraRoots);
    if (!pathAllowed(filePath, roots)) {
      return {
        ok: false,
        status: 400,
        body: { error: "Path is outside configured recording roots." },
      };
    }
  }

  const event = {
    type,
    path: filePath,
    occurredAt,
    externalId: input.externalId || null,
    receivedAt: new Date().toISOString(),
  };
  const key = eventDedupeKey(event);
  const store = await loadStore();
  if (store.processedKeys.includes(key)) {
    return { ok: true, status: 200, body: { ok: true, deduped: true, key } };
  }

  if (filePath && type === "recording_finished") {
    const stable = await waitForStableFile(filePath);
    event.writeStable = stable.ok;
    event.fileSize = stable.size ?? null;
    if (!stable.ok) {
      event.writeWaitReason = stable.reason;
    }
  }

  store.events.push(event);
  store.events = store.events.slice(-200);
  store.processedKeys.push(key);
  store.processedKeys = store.processedKeys.slice(-500);
  await saveStore(store);

  if (typeof context.onEvent === "function") {
    await context.onEvent(event);
  }

  return { ok: true, status: 200, body: { ok: true, key, event } };
}

export async function listRecentRecordingEvents(limit = 40) {
  const store = await loadStore();
  return store.events.slice(-limit).reverse();
}

export async function callbackSecretExists() {
  try {
    await access(RECORDING_CALLBACK_SECRET_FILE);
    return true;
  } catch {
    return false;
  }
}

// re-export sep for tests that check path joins
export { sep };
