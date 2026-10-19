/**
 * Pure parsers for Ecamm Live JSON responses (Companion ecamm-parsers.ts port).
 */

import {
  ALL_AUDIO_BUSES,
  AUDIO_BUS_INFO_SUFFIX,
  ConnectionPermission,
} from "./constants.mjs";

const KNOWN_INFO_KEYS = new Set([
  "ButtonLabel",
  "PauseButtonLabel",
  "CurrentScene",
  "CurrentSceneOrig",
  "Viewers",
  "Mute",
  "PreviewMode",
  "HidingUI",
  "LiveDemo",
  "ZoomInMeeting",
  "ZoomMuted",
  "ZoomHandRaised",
  "ZoomCamOn",
  "ZoomCloudRecording",
  "ZoomLocalRecording",
  "ZoomRecordingPaused",
  "ZoomHosting",
]);

export function yesNo(value) {
  return typeof value === "string" && value.toLowerCase() === "yes";
}

export function unwrapScalar(payload) {
  if (Array.isArray(payload)) return payload.length > 0 ? unwrapScalar(payload[0]) : "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "number" || typeof payload === "boolean") return String(payload);
  return "";
}

export function parseNumeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || !/^-?\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function itemsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) return payload.items;
    const values = Object.values(payload).filter((v) => v && typeof v === "object");
    if (values.length > 0) return values;
  }
  return [];
}

function toListItem(raw) {
  const id = raw.UUID?.trim?.() || raw.UUID;
  if (!id || typeof id !== "string" || !id.trim()) return undefined;
  return {
    id: id.trim(),
    label: (raw.title?.trim?.() || raw.name?.trim?.() || id).toString(),
  };
}

function parseZoom(raw) {
  const inMeeting = yesNo(raw.ZoomInMeeting);
  if (!inMeeting) {
    return {
      inMeeting: false,
      muted: false,
      handRaised: false,
      camOn: false,
      cloudRecording: false,
      localRecording: false,
      recordingPaused: false,
      hosting: false,
    };
  }
  return {
    inMeeting: true,
    muted: yesNo(raw.ZoomMuted),
    handRaised: yesNo(raw.ZoomHandRaised),
    camOn: yesNo(raw.ZoomCamOn),
    cloudRecording: yesNo(raw.ZoomCloudRecording),
    localRecording: yesNo(raw.ZoomLocalRecording),
    recordingPaused: yesNo(raw.ZoomRecordingPaused),
    hosting: yesNo(raw.ZoomHosting),
  };
}

export function parseInfo(payload) {
  const raw = payload && typeof payload === "object" ? payload : {};
  const volumes = {};
  const mutes = {};
  const consumed = new Set();

  for (const bus of ALL_AUDIO_BUSES) {
    const suffix = AUDIO_BUS_INFO_SUFFIX[bus];
    const volumeKey = `VOLUME_${suffix}`;
    const muteKey = `MUTE_${suffix}`;
    if (raw[volumeKey] !== undefined) {
      const parsed = parseNumeric(raw[volumeKey]);
      if (parsed !== undefined) volumes[bus] = parsed;
      consumed.add(volumeKey);
    }
    if (raw[muteKey] !== undefined) {
      mutes[bus] = yesNo(raw[muteKey]);
      consumed.add(muteKey);
    }
  }

  const unmappedKeys = Object.keys(raw).filter((key) => !KNOWN_INFO_KEYS.has(key) && !consumed.has(key));

  return {
    buttonLabel: raw.ButtonLabel ?? "",
    pauseButtonLabel: raw.PauseButtonLabel ?? "",
    currentSceneId: raw.CurrentScene ?? "",
    currentSceneOrigId: raw.CurrentSceneOrig ?? "",
    viewers: parseNumeric(raw.Viewers) ?? 0,
    mute: yesNo(raw.Mute),
    previewMode: yesNo(raw.PreviewMode),
    hidingUi: yesNo(raw.HidingUI),
    liveDemo: yesNo(raw.LiveDemo),
    volumes,
    mutes,
    zoom: parseZoom(raw),
    unmappedKeys,
    raw,
  };
}

export function parseSceneList(payload) {
  const scenes = [];
  const walk = (items, groupName) => {
    for (const raw of items) {
      const base = toListItem(raw);
      if (!base) continue;
      if (raw.Group === true) {
        walk(Array.isArray(raw.Children) ? raw.Children : [], base.label);
        continue;
      }
      scenes.push({
        ...base,
        current: raw.CURRENT === true,
        locked: raw.Locked === true,
        ...(groupName ? { groupName } : {}),
      });
    }
  };
  walk(itemsOf(payload));
  return scenes;
}

export function parseOverlayList(payload) {
  const overlays = [];
  for (const raw of itemsOf(payload)) {
    const base = toListItem(raw);
    if (!base) continue;
    overlays.push({
      ...base,
      visible: raw.Visible === true,
      locked: raw.Locked === true,
      isComment: raw.IsComment === true,
    });
  }
  return overlays;
}

function parseSimpleList(payload) {
  const out = [];
  for (const raw of itemsOf(payload)) {
    const item = toListItem(raw);
    if (item) out.push(item);
  }
  return out;
}

export const parseCameraList = (p) => parseSimpleList(p);
export const parseVideoList = (p) => parseSimpleList(p);
export const parseAudioFilterList = (p) => parseSimpleList(p);
export const parseProfileList = (p) => parseSimpleList(p);
export const parseChannelList = (p) => parseSimpleList(p);

export function parseSoundList(payload) {
  const sounds = [];
  const folders = [];

  const countPlayable = (items) => {
    let total = 0;
    for (const item of items) {
      if (item.Group === true) total += countPlayable(Array.isArray(item.Children) ? item.Children : []);
      else if (item.UUID?.trim?.()) total++;
    }
    return total;
  };

  const walk = (items, folderName) => {
    for (const raw of items) {
      const base = toListItem(raw);
      if (!base) continue;
      if (raw.Group === true) {
        const children = Array.isArray(raw.Children) ? raw.Children : [];
        folders.push({ ...base, soundCount: countPlayable(children) });
        walk(children, base.label);
        continue;
      }
      sounds.push({
        ...base,
        duration: typeof raw.Duration === "number" ? raw.Duration : 0,
        ...(folderName ? { folderName } : {}),
      });
    }
  };

  walk(itemsOf(payload));
  return { sounds, folders };
}

export function parseConnectionPermission(payload) {
  const value = unwrapScalar(payload).trim();
  return Object.values(ConnectionPermission).find((known) => known === value) ?? ConnectionPermission.NotFound;
}

export function parseSourceMode(payload) {
  const value = unwrapScalar(payload).trim().toLowerCase();
  return value === "" ? undefined : value;
}

export function parseImageIcon(payload) {
  if (!payload || typeof payload !== "object") return null;
  const icon = payload.icon;
  if (typeof icon !== "string" || !icon.trim()) return null;
  return icon;
}

/** Infer recording/broadcast confidence from Ecamm button label wording. */
export function sceneLabel(scene) {
  return scene.groupName ? `${scene.groupName} - ${scene.label}` : scene.label;
}

export function soundLabel(sound) {
  return sound.folderName ? `${sound.folderName} / ${sound.label}` : sound.label;
}

export function inferBroadcastState(buttonLabel) {
  const label = String(buttonLabel || "").trim().toLowerCase();
  if (!label) {
    return { active: null, kind: "unknown", confidence: "unknown", source: "button_label_empty" };
  }
  if (/\bstop\b/.test(label) || /\bend\b/.test(label)) {
    const kind = /record/.test(label) ? "recording" : /stream|live|broadcast/.test(label) ? "broadcast" : "active";
    return { active: true, kind, confidence: "inferred", source: "button_label", label: buttonLabel };
  }
  if (/\bstart\b/.test(label) || /\bgo\s*live\b/.test(label) || /\brecord\b/.test(label)) {
    return { active: false, kind: "idle", confidence: "inferred", source: "button_label", label: buttonLabel };
  }
  return { active: null, kind: "unknown", confidence: "low", source: "button_label_unrecognized", label: buttonLabel };
}

/** Alias used by state.mjs / barrel exports. */
export const inferSessionFromButtonLabel = inferBroadcastState;
