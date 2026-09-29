import { deflateSync } from "node:zlib";

/** Clearly labeled simulated cameras for development without NDI hardware. */

const PRESETS = [
  { id: "1", label: "Wide" },
  { id: "2", label: "Stage left" },
  { id: "3", label: "Stage right" },
];

export function listSimulatedCameras() {
  return [
    {
      sourceKey: "sim-cam-a",
      title: "Simulated Cam A (PTZ)",
      protocol: "simulated",
      isSimulated: true,
      isProgramOutput: false,
      supportsPtz: true,
      supportsZoom: true,
      supportsPresets: true,
      supportsPresetSave: false,
      supportsFocus: false,
      online: true,
      lastError: null,
      sortOrder: 0,
      capabilities: {
        ptz: true,
        zoom: true,
        presets: true,
        presetSave: false,
        focus: false,
        preview: true,
        speeds: [1, 2, 4, 8, 12, 16],
        presetsList: PRESETS,
      },
      state: { pan: 0, tilt: 0, zoom: 10, moving: false, zooming: false },
    },
    {
      sourceKey: "sim-cam-b",
      title: "Simulated Cam B (PTZ)",
      protocol: "simulated",
      isSimulated: true,
      isProgramOutput: false,
      supportsPtz: true,
      supportsZoom: true,
      supportsPresets: true,
      supportsPresetSave: false,
      supportsFocus: false,
      online: true,
      lastError: null,
      sortOrder: 1,
      capabilities: {
        ptz: true,
        zoom: true,
        presets: true,
        presetSave: false,
        focus: false,
        preview: true,
        speeds: [1, 2, 4, 8, 12, 16],
        presetsList: PRESETS,
      },
      state: { pan: 0, tilt: 0, zoom: 10, moving: false, zooming: false },
    },
    {
      sourceKey: "sim-program",
      title: "Simulated Ecamm Program (preview only)",
      protocol: "simulated",
      isSimulated: true,
      isProgramOutput: true,
      supportsPtz: false,
      supportsZoom: false,
      supportsPresets: false,
      supportsPresetSave: false,
      supportsFocus: false,
      online: true,
      lastError: null,
      sortOrder: 99,
      capabilities: {
        ptz: false,
        zoom: false,
        presets: false,
        presetSave: false,
        focus: false,
        preview: true,
        speeds: [],
        presetsList: [],
      },
      state: { pan: 0, tilt: 0, zoom: 10, moving: false, zooming: false },
    },
  ];
}

export function applySimCommand(camera, kind, payload) {
  if (camera.isProgramOutput) {
    return { ok: false, reason: "Program output is preview-only." };
  }
  const state = camera.state;
  if (kind === "ptz_stop") {
    state.moving = false;
    state.zooming = false;
    return { ok: true };
  }
  if (kind === "ptz_move") {
    const speed = Number(payload?.speed ?? 1);
    const dir = String(payload?.direction ?? "");
    if (dir.includes("left")) state.pan -= speed;
    if (dir.includes("right")) state.pan += speed;
    if (dir.includes("up")) state.tilt += speed;
    if (dir.includes("down")) state.tilt -= speed;
    state.moving = true;
    return { ok: true };
  }
  if (kind === "ptz_zoom") {
    const speed = Number(payload?.speed ?? 1);
    if (payload?.direction === "in") state.zoom += speed;
    if (payload?.direction === "out") state.zoom = Math.max(1, state.zoom - speed);
    state.zooming = true;
    return { ok: true };
  }
  if (kind === "ptz_preset_recall") {
    const preset = camera.capabilities.presetsList.find((item) => item.id === payload?.presetId);
    if (!preset) return { ok: false, reason: "Unknown preset." };
    state.pan = Number(preset.id) * 10;
    state.tilt = Number(preset.id) * 5;
    state.moving = false;
    state.zooming = false;
    return { ok: true };
  }
  return { ok: false, reason: `Unsupported simulated command: ${kind}` };
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return ~c;
}

/** Low-res PNG whose stage rectangle shifts with pan/tilt/zoom for framing feedback. */
export function renderSimSnapshotPng(camera) {
  const w = 320;
  const h = 180;
  const { pan, tilt, zoom } = camera.state;
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0;
    for (let x = 0; x < w; x += 1) {
      const i = 1 + x * 3;
      const shiftX = ((pan % 40) + 40) % 40;
      const shiftY = ((tilt % 20) + 20) % 20;
      const stage =
        x > w * 0.2 + shiftX * 0.5 && x < w * 0.75 + shiftX * 0.5 && y > h * 0.3 + shiftY * 0.5;
      if (y < 16) {
        row[i] = 10;
        row[i + 1] = 10;
        row[i + 2] = 14;
      } else if (stage) {
        row[i] = 36;
        row[i + 1] = 96 + (zoom % 50);
        row[i + 2] = 140;
      } else {
        row[i] = 20;
        row[i + 1] = 24;
        row[i + 2] = 30;
      }
    }
    rows.push(row);
  }
  const compressed = deflateSync(Buffer.concat(rows));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const text = `Simulated · ${camera.title} · pan=${pan} tilt=${tilt} zoom=${zoom}`;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", Buffer.from(`Comment\0${text}`)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
