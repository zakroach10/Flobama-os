/**
 * NDI discovery + low-bandwidth preview capture via optional `grandi` bindings.
 * Installed on the venue Mac at first launch; gracefully degrades when unavailable.
 */

let grandiModule = null;
let grandiLoadError = null;
let finder = null;
let lastDiscoverAt = 0;
let cachedSources = [];

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

/** Discover local/LAN NDI sources. Cached briefly to avoid hammering mDNS. */
export async function discoverNdiSources({ force = false, waitMs = 1500 } = {}) {
  const now = Date.now();
  if (!force && cachedSources.length && now - lastDiscoverAt < 5_000) {
    return { ok: true, sources: cachedSources, note: "Cached NDI discovery." };
  }

  const grandi = await loadGrandi();
  if (!grandi?.find) {
    return {
      ok: false,
      sources: [],
      note:
        grandiLoadError ||
        "Install NDI bindings on the Mac (npm install in the app Resources/app). Requires NDI runtime/network access.",
    };
  }

  try {
    if (!finder) {
      finder = await grandi.find({ showLocalSources: true });
    }
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      try {
        finder.wait?.(250);
      } catch {
        /* older bindings */
      }
      await new Promise((r) => setTimeout(r, 200));
      const list = typeof finder.sources === "function" ? finder.sources() : [];
      if (Array.isArray(list) && list.length > 0) break;
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
    lastDiscoverAt = Date.now();
    return {
      ok: true,
      sources: cachedSources,
      note: cachedSources.length
        ? `Found ${cachedSources.length} NDI source(s).`
        : "NDI finder running — no sources visible yet (check LAN/Local Network permission).",
    };
  } catch (error) {
    return {
      ok: false,
      sources: [],
      note: error instanceof Error ? error.message : "NDI discovery failed.",
    };
  }
}

/**
 * Grab one low-bandwidth preview frame as PNG bytes when possible.
 * Returns null when receive is unavailable; caller should use labeled fallback.
 */
export async function captureNdiPreviewPng(source, { encodeRgbaPng }) {
  const grandi = await loadGrandi();
  if (!grandi?.receive || !source?.name) return null;

  let receiver;
  try {
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

    const frame = await receiver.video(2500);
    if (!frame?.data || !frame.xres || !frame.yres) return null;

    // Prefer RGBX/RGBA packed buffers. If stride suggests UYVY (2 bytes/px), skip.
    const stride = Number(frame.lineStrideBytes || frame.xres * 4);
    if (stride < frame.xres * 3) return null;

    const targetW = 640;
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
  } catch {
    return null;
  } finally {
    try {
      receiver?.destroy?.();
    } catch {
      /* ignore */
    }
  }
}
