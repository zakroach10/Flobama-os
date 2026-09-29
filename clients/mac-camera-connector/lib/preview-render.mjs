import { deflateSync } from "node:zlib";

/** Tiny 5x7 uppercase glyph set for burned-in preview labels. */
const GLYPHS = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "11111", "10001", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "11100", "10010", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  "(": ["00100", "01000", "10000", "10000", "10000", "01000", "00100"],
  ")": ["00100", "00010", "00001", "00001", "00001", "00010", "00100"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
};

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

function drawText(pixels, w, h, text, x0, y0, scale, color) {
  const cleaned = String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 .\-:/()*]/g, " ")
    .slice(0, 42);
  let x = x0;
  for (const ch of cleaned) {
    const glyph = GLYPHS[ch] || GLYPHS[" "];
    for (let gy = 0; gy < 7; gy += 1) {
      for (let gx = 0; gx < 5; gx += 1) {
        if (glyph[gy][gx] !== "1") continue;
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            const px = x + gx * scale + sx;
            const py = y0 + gy * scale + sy;
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            const i = (py * w + px) * 3;
            pixels[i] = color[0];
            pixels[i + 1] = color[1];
            pixels[i + 2] = color[2];
          }
        }
      }
    }
    x += 6 * scale;
  }
}

function fillRect(pixels, w, h, x, y, rw, rh, color) {
  for (let py = y; py < y + rh; py += 1) {
    for (let px = x; px < x + rw; px += 1) {
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const i = (py * w + px) * 3;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
    }
  }
}

/** Browser-visible framing preview with burned-in camera identity. */
export function renderCameraPreviewPng(camera, options = {}) {
  const w = 640;
  const h = 360;
  const state = camera.state || { pan: 0, tilt: 0, zoom: 10, moving: false };
  const pixels = Buffer.alloc(w * h * 3);
  const controlling = Boolean(options.controlling);
  const link = options.linkStatus || camera.linkStatus || (camera.isSimulated ? "simulated" : "unknown");

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 3;
      const shiftX = ((state.pan % 80) + 80) % 80;
      const shiftY = ((state.tilt % 40) + 40) % 40;
      const zoomScale = 1 + (state.zoom % 40) / 80;
      const stage =
        x > w * (0.18 + shiftX / 400) &&
        x < w * (0.78 + shiftX / 400) * zoomScale &&
        y > h * (0.28 + shiftY / 300);
      if (stage) {
        pixels[i] = camera.isSimulated ? 40 : 28;
        pixels[i + 1] = camera.isSimulated ? 110 + (state.zoom % 40) : 70;
        pixels[i + 2] = camera.isSimulated ? 150 : 90;
      } else {
        pixels[i] = 18;
        pixels[i + 1] = 20;
        pixels[i + 2] = 26;
      }
    }
  }

  fillRect(pixels, w, h, 0, 0, w, 54, controlling ? [140, 40, 30] : [12, 12, 16]);
  fillRect(pixels, w, h, 0, h - 42, w, 42, [10, 10, 14]);

  drawText(pixels, w, h, controlling ? "CONTROLLING" : "PREVIEW", 12, 10, 2, [255, 220, 180]);
  drawText(pixels, w, h, camera.title || camera.sourceKey || "CAMERA", 12, 30, 2, [255, 255, 255]);
  drawText(
    pixels,
    w,
    h,
    `${link.replaceAll("_", " ")}  pan ${state.pan}  tilt ${state.tilt}  zoom ${state.zoom}`,
    12,
    h - 28,
    2,
    [180, 200, 220],
  );

  if (camera.connectionTarget) {
    drawText(pixels, w, h, `TARGET ${camera.connectionTarget}`, 12, 70, 2, [200, 210, 120]);
  }

  // Pack PNG
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 0;
    pixels.copy(row, 1, y * w * 3, (y + 1) * w * 3);
    rows.push(row);
  }
  const compressed = deflateSync(Buffer.concat(rows));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
