/**
 * Persist stable Ecamm client UUID and selected Mac identity.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SUPPORT_DIR } from "../paths.mjs";

export const ECAMM_SETTINGS_FILE = join(SUPPORT_DIR, "ecamm-settings.json");

const DEFAULTS = {
  uuid: null,
  selectedHostname: null,
  selectedServiceName: null,
  preferredAddress: null,
  lastHost: null,
  allowPerBusMute: false,
  deniedUntilManualRetry: false,
  favorites: { scenes: [], overlays: [] },
};

export async function loadEcammSettings() {
  try {
    const raw = await readFile(ECAMM_SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveEcammSettings(settings) {
  await mkdir(dirname(ECAMM_SETTINGS_FILE), { recursive: true });
  const next = { ...DEFAULTS, ...settings };
  await writeFile(ECAMM_SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function ensureEcammUuid(settings) {
  if (settings.uuid && typeof settings.uuid === "string" && settings.uuid.length >= 8) {
    return settings;
  }
  return saveEcammSettings({ ...settings, uuid: randomUUID() });
}

export async function clearSelectedHost() {
  const settings = await loadEcammSettings();
  return saveEcammSettings({
    ...settings,
    selectedHostname: null,
    selectedServiceName: null,
    preferredAddress: null,
    lastHost: null,
    deniedUntilManualRetry: false,
  });
}

/** Persist acknowledged production command IDs across restarts (bounded). */
export const PRODUCTION_ACK_FILE = join(SUPPORT_DIR, "production-command-acks.json");

export async function loadAcknowledgedProductionIds() {
  try {
    const raw = await readFile(PRODUCTION_ACK_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === "string") : [];
    return new Set(ids.slice(-500));
  } catch {
    return new Set();
  }
}

export async function persistAcknowledgedProductionIds(ids) {
  await mkdir(dirname(PRODUCTION_ACK_FILE), { recursive: true });
  const list = [...ids].slice(-500);
  await writeFile(PRODUCTION_ACK_FILE, `${JSON.stringify({ ids: list }, null, 2)}\n`, "utf8");
}
