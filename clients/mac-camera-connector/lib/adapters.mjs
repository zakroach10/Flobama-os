/**
 * Camera protocol adapters.
 *
 * NDI discovery/preview uses optional `grandi` bindings (installed on the Mac).
 * NDI PTZ / VISCA hardware move commands stay stubbed until camera models are confirmed —
 * discovery does not imply every NDI source supports PTZ.
 */

export {
  discoverNdiSources,
  captureNdiPreviewPng,
  ndiRuntimeStatus,
  probeLocalNetworkPermission,
} from "./ndi.mjs";

export function createAdapter(camera) {
  if (camera.protocol === "simulated" || camera.isSimulated) {
    return {
      id: camera.sourceKey,
      supportsPtz: Boolean(camera.supportsPtz) && !camera.isProgramOutput,
      async move() {
        return { ok: false, reason: "Use simulated command path." };
      },
      async stop() {
        return { ok: true };
      },
    };
  }

  if (camera.protocol === "ndi_ptz") {
    return {
      id: camera.sourceKey,
      supportsPtz: false,
      async move() {
        return {
          ok: false,
          reason: "NDI PTZ adapter pending camera model confirmation (NDI PTZ capability bit + SDK).",
        };
      },
      async stop() {
        return { ok: true };
      },
    };
  }

  if (camera.protocol === "visca_udp" || camera.protocol === "visca_tcp") {
    return {
      id: camera.sourceKey,
      supportsPtz: false,
      async move() {
        return {
          ok: false,
          reason: "VISCA adapter pending camera IP, port, and VISCA address from venue inventory.",
        };
      },
      async stop() {
        return { ok: true };
      },
    };
  }

  return {
    id: camera.sourceKey,
    supportsPtz: false,
    async move() {
      return { ok: false, reason: "Unknown protocol — preview only." };
    },
    async stop() {
      return { ok: true };
    },
  };
}
