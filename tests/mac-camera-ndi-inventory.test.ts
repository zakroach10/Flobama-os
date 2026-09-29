import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Mac NDI inventory merge", () => {
  it("matches inventory by NDI name and auto-surfaces unmatched sources", () => {
    const script = `
      import { buildLocalCameras } from "./lib/inventory.mjs";
      const cameras = buildLocalCameras({
        inventory: [
          {
            id: "inv-1",
            sourceKey: "stage-left",
            title: "Stage left",
            protocol: "ndi_ptz",
            connectionTarget: "CAM 1 (Studio)",
            supportsPtz: true,
            supportsZoom: true,
            enabled: true,
            sortOrder: 0,
          },
        ],
        discoveredNdi: [
          { name: "CAM 1 (Studio)", urlAddress: "192.168.1.20:5961", sourceKey: "ndi-cam-1-studio" },
          { name: "Ecamm Live", urlAddress: null, sourceKey: "ndi-ecamm-live" },
        ],
        includeBuiltinSims: false,
      });
      console.log(JSON.stringify(cameras.map((c) => ({
        sourceKey: c.sourceKey,
        linkStatus: c.linkStatus,
        online: c.online,
        connectionTarget: c.connectionTarget,
      }))));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: path.join(process.cwd(), "clients/mac-camera-connector"),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const cameras = JSON.parse(result.stdout.trim());
    expect(cameras).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "stage-left",
          linkStatus: "ndi_live",
          online: true,
          connectionTarget: "CAM 1 (Studio)",
        }),
        expect.objectContaining({
          sourceKey: "ndi-ecamm-live",
          linkStatus: "ndi_live",
          online: true,
          connectionTarget: "Ecamm Live",
        }),
      ]),
    );
  });

  it("omits hidden source keys from inventory, discovery, and sims", () => {
    const script = `
      import { buildLocalCameras } from "./lib/inventory.mjs";
      const cameras = buildLocalCameras({
        inventory: [
          {
            id: "inv-1",
            sourceKey: "stage-left",
            title: "Stage left",
            protocol: "ndi_ptz",
            connectionTarget: "CAM 1",
            enabled: true,
          },
        ],
        discoveredNdi: [
          { name: "Ecamm Live", urlAddress: null, sourceKey: "ndi-ecamm-live" },
        ],
        hiddenSourceKeys: ["stage-left", "ndi-ecamm-live", "sim-cam-a"],
        includeBuiltinSims: true,
      });
      console.log(JSON.stringify(cameras.map((c) => c.sourceKey)));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: path.join(process.cwd(), "clients/mac-camera-connector"),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const keys = JSON.parse(result.stdout.trim());
    expect(keys).not.toContain("stage-left");
    expect(keys).not.toContain("ndi-ecamm-live");
    expect(keys).not.toContain("sim-cam-a");
  });

  it("marks inventory NDI as pending when not discovered", () => {
    const script = `
      import { buildLocalCameras } from "./lib/inventory.mjs";
      const cameras = buildLocalCameras({
        inventory: [
          {
            id: "inv-1",
            sourceKey: "stage-left",
            title: "Stage left",
            protocol: "ndi_ptz",
            connectionTarget: "Missing Cam",
            enabled: true,
          },
        ],
        discoveredNdi: [],
        includeBuiltinSims: false,
      });
      console.log(JSON.stringify(cameras[0]));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: path.join(process.cwd(), "clients/mac-camera-connector"),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const camera = JSON.parse(result.stdout.trim());
    expect(camera.linkStatus).toBe("ndi_pending");
    expect(camera.online).toBe(false);
  });
});
