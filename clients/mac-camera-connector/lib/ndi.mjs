/**
 * NDI discovery + low-bandwidth preview capture via optional `grandi` bindings.
 * Installed on the venue Mac at first launch; gracefully degrades when unavailable.
 */

import dgram from "node:dgram";

let grandiModule = null;
let grandiLoadError = null;
let finder = null;
let lastDiscoverAt = 0;
let cachedSources = [];
let cachedNote = "NDI discovery starting…";
let cachedOk = false;
let localNetworkProbed = false;
let discoverInFlight = null;

async function loadGrandi() {
  if (grandiModule) return grandiModule;
  if (grandiLoadError) return null;
  try {
    const mod = await import("grandi");
    grandiModule = mod.default ?? mod;
    return grandiModule;
  } catch (error) {
    grandiLoadError = error instanceof Error ? error.message : String(error);
    return null;
  }
}

/**
 * Trigger macOS Local Network TCC for the process that is actually running Node
 * (usually Terminal when launched from the .dmg). Harmless if permission already granted.
 */
export async function probeLocalNetworkPermission() {
  if (localNetworkProbed) return { ok: true, note: "Local Network already probed." };
  localNetworkProbed = true;
  return await new Promise((resolve) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const done = (note) => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      resolve({ ok: true, note });
    };
    socket.on("error", () => done("Local Network probe finished (with socket error)."));
    try {
      socket.bind(0, () => {
        try {
          socket.setBroadcast(true);
          const payload = Buffer.from("FloBama-Mac-Camera-local-network-probe");
          socket.send(payload, 0, payload.length, 5353, "224.0.0.251", () => {
            done(
              "Local Network probe sent. Allow Terminal under System Settings → Privacy & Security → Local Network.",
            );
          });
        } catch {
          done("Local Network probe bound.");
        }
      });
    } catch {
      done("Local Network probe skipped.");
    }
    setTimeout(() => done("Local Network probe timed out."), 1500);
  });
}

export function ndiRuntimeStatus() {
  if (grandiModule) return { ok: true, note: "NDI runtime loaded (grandi)." };
  if (grandiLoadError) {
    return {
      ok: false,
      note: `NDI bindings unavailable: ${grandiLoadError}. On the Mac, open Terminal in the app Resources/app folder and run npm install.`,
    };
  }
  return { ok: false, note: "NDI bindings not loaded yet." };
}

export function sourceKeyForNdiName(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug ? `ndi-${slug}` : `ndi-${Date.now()}`;
}

function snapshotDiscovery() {
  return {
    ok: cachedOk,
    sources: cachedSources,
    note: cachedNote,
  };
}

async function runDiscovery({ waitMs }) {
  await probeLocalNetworkPermission();

  const grandi = await loadGrandi();
  if (!grandi?.find) {
    cachedOk = false;
    cachedSources = [];
    cachedNote =
      grandiLoadError ||
      "Install NDI bindings on the Mac (npm install in the app Resources/app). Requires NDI runtime/network access.";
    lastDiscoverAt = Date.now();
    return snapshotDiscovery();
  }

  try {
    if (!finder) {
      finder = await grandi.find({ showLocalSources: true });
    }
    if (typeof finder.wait === "function") {
      try {
        await finder.wait(waitMs);
      } catch {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    } else {
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const list = typeof finder.sources === "function" ? finder.sources() : [];
    cachedSources = (Array.isArray(list) ? list : [])
      .map((item) => {
        const name = String(item?.name || "").trim();
        const urlAddress = String(item?.urlAddress || item?.url || "").trim();
        if (!name) return null;
        return {
          name,
          urlAddress: urlAddress || null,
          sourceKey: sourceKeyForNdiName(name),
        };
      })
      .filter(Boolean);
    cachedOk = true;
    cachedNote = cachedSources.length
      ? `Found ${cachedSources.length} NDI source(s) on this Mac.`
      : "NDI finder running — no sources yet. Allow Local Network for Terminal, keep cameras/Ecamm on the same LAN, then wait a few seconds.";
    lastDiscoverAt = Date.now();
    return snapshotDiscovery();
  } catch (error) {
    cachedOk = false;
    cachedNote = error instanceof Error ? error.message : "NDI discovery failed.";
    lastDiscoverAt = Date.now();
    return snapshotDiscovery();
  }
}

/**
 * Discover local/LAN NDI sources.
 * Caches empty and non-empty results so the connector heartbeat stays fast.
 */
export async function discoverNdiSources({ force = false, waitMs = 1200, maxAgeMs = 4_000 } = {}) {
  const now = Date.now();
  if (!force && lastDiscoverAt && now - lastDiscoverAt < maxAgeMs) {
    return snapshotDiscovery();
  }
  if (discoverInFlight) return discoverInFlight;

  discoverInFlight = runDiscovery({ waitMs })
    .catch((error) => {
      cachedOk = false;
      cachedNote = error instanceof Error ? error.message : "NDI discovery failed.";
      lastDiscoverAt = Date.now();
      return snapshotDiscovery();
    })
    .finally(() => {
      discoverInFlight = null;
    });
  return discoverInFlight;
}

function destroyReceiver(receiver) {
  try {
    receiver?.destroy?.();
  } catch {
    /* ignore */
  }
}

/**
 * Grab one low-bandwidth preview frame as PNG bytes when possible.
 * Hard-timeouts so a stuck NDI receive cannot freeze the connector heartbeat.
 * Returns null when receive is unavailable/slow; caller should use labeled fallback.
 */
export async function captureNdiPreviewPng(source, { encodeRgbaPng, timeoutMs = 1800 } = {}) {
  const grandi = await loadGrandi();
  if (!grandi?.receive || !source?.name) return null;

  const budget = Math.max(400, Math.min(Number(timeoutMs) || 1800, 4000));
  let receiver;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    destroyReceiver(receiver);
  }, budget);

  const work = (async () => {
    const colorFormat =
      grandi.COLOR_FORMAT_RGBX_RGBA ??
      grandi.COLOR_FORMAT_BGRX_BGRA ??
      grandi.ColorFormat?.RgbxRgba ??
      undefined;
    const bandwidth = grandi.BANDWIDTH_LOWEST ?? grandi.Bandwidth?.Lowest ?? undefined;
    receiver = await grandi.receive({
      source: { name: source.name, urlAddress: source.urlAddress || undefined },
      colorFormat,
      bandwidth,
      allowVideoFields: false,
      name: "FloBama Mac Camera preview",
    });
    if (timedOut) return null;

    const frame = await receiver.video(Math.min(1200, budget));
    if (timedOut || !frame?.data || !frame.xres || !frame.yres) return null;

    const stride = Number(frame.lineStrideBytes || frame.xres * 4);
    if (stride < frame.xres * 3) return null;

    const targetW = 480;
    const targetH = Math.max(180, Math.round((frame.yres / frame.xres) * targetW));
    const rgba = Buffer.alloc(targetW * targetH * 4);
    const src = Buffer.isBuffer(frame.data) ? frame.data : Buffer.from(frame.data);

    for (let y = 0; y < targetH; y += 1) {
      const sy = Math.min(frame.yres - 1, Math.floor((y * frame.yres) / targetH));
      for (let x = 0; x < targetW; x += 1) {
        const sx = Math.min(frame.xres - 1, Math.floor((x * frame.xres) / targetW));
        const si = sy * stride + sx * 4;
        const di = (y * targetW + x) * 4;
        rgba[di] = src[si] ?? 0;
        rgba[di + 1] = src[si + 1] ?? 0;
        rgba[di + 2] = src[si + 2] ?? 0;
        rgba[di + 3] = 255;
      }
    }

    return encodeRgbaPng(targetW, targetH, rgba);
  })();

  try {
    const result = await Promise.race([
      work,
      new Promise((resolve) => {
        setTimeout(() => resolve(null), budget + 50);
      }),
    ]);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    destroyReceiver(receiver);
  }
}
