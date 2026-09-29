import { listSimulatedCameras, applySimCommand } from "./sim-cameras.mjs";
import { sourceKeyForNdiName } from "./ndi.mjs";

function namesMatch(a, b) {
  const left = String(a || "")
    .trim()
    .toLowerCase();
  const right = String(b || "")
    .trim()
    .toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * Build local cameras from staff inventory + live NDI discovery + optional sims.
 */
export function buildLocalCameras({
  inventory,
  discoveredNdi = [],
  hiddenSourceKeys = [],
  includeBuiltinSims,
}) {
  const cameras = [];
  const byKey = new Map();
  const discovered = Array.isArray(discoveredNdi) ? discoveredNdi : [];
  const hidden = new Set(
    (Array.isArray(hiddenSourceKeys) ? hiddenSourceKeys : []).map((key) => String(key || "").toLowerCase()),
  );

  for (const item of inventory || []) {
    if (!item?.sourceKey || item.enabled === false) continue;
    if (hidden.has(String(item.sourceKey).toLowerCase())) continue;
    const protocol = item.protocol || "unknown";
    const isSim = protocol === "simulated";
    const isProgram = Boolean(item.isProgramOutput);
    let linkStatus = "unknown";
    let online = false;
    let lastError = null;
    let ndiSource = null;

    if (isSim) {
      linkStatus = "simulated";
      online = true;
    } else if (protocol === "ndi_ptz") {
      ndiSource =
        discovered.find((src) => namesMatch(src.name, item.connectionTarget)) ||
        discovered.find((src) => namesMatch(src.name, item.title)) ||
        null;
      if (ndiSource) {
        linkStatus = "ndi_live";
        online = true;
        lastError = null;
      } else {
        linkStatus = "ndi_pending";
        lastError =
          "NDI source not visible on this Mac yet. Confirm the exact NDI name, Local Network permission, and that the camera/Ecamm is publishing NDI.";
      }
    } else if (protocol === "visca_udp" || protocol === "visca_tcp") {
      linkStatus = "visca_pending";
      lastError = `VISCA target configured (${item.connectionTarget || "missing host"}). Hardware adapter pending model confirmation.`;
    } else {
      linkStatus = "offline";
      lastError = "Unknown protocol — preview/control disabled.";
    }

    const camera = {
      sourceKey: item.sourceKey,
      title: item.title,
      protocol,
      isSimulated: isSim,
      isProgramOutput: isProgram,
      supportsPtz: isProgram ? false : Boolean(item.supportsPtz),
      supportsZoom: isProgram ? false : Boolean(item.supportsZoom),
      supportsPresets: isProgram ? false : Boolean(item.supportsPresets),
      supportsPresetSave: isProgram ? false : Boolean(item.supportsPresetSave),
      supportsFocus: isProgram ? false : Boolean(item.supportsFocus),
      online,
      lastError,
      connectionTarget: ndiSource?.name || item.connectionTarget || null,
      connectionPort: item.connectionPort ?? null,
      linkStatus,
      inventoryId: item.id || null,
      ndiUrlAddress: ndiSource?.urlAddress || null,
      sortOrder: item.sortOrder ?? cameras.length,
      capabilities: {
        ptz: isProgram ? false : Boolean(item.supportsPtz),
        zoom: isProgram ? false : Boolean(item.supportsZoom),
        presets: isProgram ? false : Boolean(item.supportsPresets),
        presetSave: isProgram ? false : Boolean(item.supportsPresetSave),
        focus: isProgram ? false : Boolean(item.supportsFocus),
        preview: true,
        speeds: [1, 2, 4, 8, 12, 16],
        presetsList: item.supportsPresets
          ? [
              { id: "1", label: "Wide" },
              { id: "2", label: "Stage left" },
              { id: "3", label: "Stage right" },
            ]
          : [],
      },
      state: { pan: 0, tilt: 0, zoom: 10, moving: false, zooming: false },
    };
    cameras.push(camera);
    byKey.set(camera.sourceKey, camera);
  }

  // Auto-surface discovered NDI sources that are not already in inventory.
  for (const src of discovered) {
    const sourceKey = src.sourceKey || sourceKeyForNdiName(src.name);
    if (hidden.has(String(sourceKey).toLowerCase())) continue;
    const already = [...byKey.values()].some(
      (cam) => namesMatch(cam.connectionTarget, src.name) || namesMatch(cam.title, src.name),
    );
    if (already) continue;
    if (byKey.has(sourceKey)) continue;
    const camera = {
      sourceKey,
      title: src.name,
      protocol: "ndi_ptz",
      isSimulated: false,
      isProgramOutput: false,
      supportsPtz: false,
      supportsZoom: false,
      supportsPresets: false,
      supportsPresetSave: false,
      supportsFocus: false,
      online: true,
      lastError: null,
      connectionTarget: src.name,
      connectionPort: null,
      linkStatus: "ndi_live",
      inventoryId: null,
      ndiUrlAddress: src.urlAddress || null,
      sortOrder: 1000 + cameras.length,
      capabilities: {
        ptz: false,
        zoom: false,
        presets: false,
        presetSave: false,
        focus: false,
        preview: true,
        speeds: [1, 2, 4, 8, 12, 16],
        presetsList: [],
      },
      state: { pan: 0, tilt: 0, zoom: 10, moving: false, zooming: false },
    };
    cameras.push(camera);
    byKey.set(sourceKey, camera);
  }

  if (includeBuiltinSims && !cameras.some((c) => c.isSimulated)) {
    for (const sim of listSimulatedCameras()) {
      if (hidden.has(String(sim.sourceKey).toLowerCase())) continue;
      if (byKey.has(sim.sourceKey)) continue;
      cameras.push({
        ...sim,
        connectionTarget: null,
        connectionPort: null,
        linkStatus: "simulated",
        inventoryId: null,
        ndiUrlAddress: null,
      });
    }
  }

  cameras.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return cameras;
}

export { applySimCommand };
