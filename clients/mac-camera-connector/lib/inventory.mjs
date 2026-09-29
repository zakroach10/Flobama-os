import { listSimulatedCameras, applySimCommand } from "./sim-cameras.mjs";

/**
 * Build the local camera set from staff inventory + optional built-in sims.
 * NDI/VISCA stay pending until a real adapter/runtime is present — never invent live links.
 */

export function buildLocalCameras({ inventory, includeBuiltinSims }) {
  const cameras = [];
  const byKey = new Map();

  for (const item of inventory || []) {
    if (!item?.sourceKey || item.enabled === false) continue;
    const protocol = item.protocol || "unknown";
    const isSim = protocol === "simulated";
    const isProgram = Boolean(item.isProgramOutput);
    let linkStatus = "unknown";
    let online = false;
    let lastError = null;

    if (isSim) {
      linkStatus = "simulated";
      online = true;
    } else if (protocol === "ndi_ptz") {
      linkStatus = "ndi_pending";
      lastError =
        "NDI source configured in FloBama OS. Install NDI runtime on this Mac and confirm the source name matches Ecamm/NDI tools. Live NDI receive is not enabled until the SDK adapter is verified.";
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
      connectionTarget: item.connectionTarget || null,
      connectionPort: item.connectionPort ?? null,
      linkStatus,
      inventoryId: item.id || null,
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

  if (includeBuiltinSims && cameras.every((c) => !c.isSimulated)) {
    for (const sim of listSimulatedCameras()) {
      if (byKey.has(sim.sourceKey)) continue;
      cameras.push({
        ...sim,
        connectionTarget: null,
        connectionPort: null,
        linkStatus: "simulated",
        inventoryId: null,
      });
    }
  }

  cameras.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return cameras;
}

export { applySimCommand };
