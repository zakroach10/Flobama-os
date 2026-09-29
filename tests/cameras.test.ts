import { describe, expect, it } from "vitest";
import {
  authorizeCameraConfigure,
  authorizeCameraOperate,
  authorizeCameraView,
  canConfigureCameraConnector,
  canOperateCameras,
} from "@/lib/auth/permissions";
import {
  commandSupportedByCamera,
  isCommandExpired,
  parseCameraCommandPayload,
} from "@/lib/cameras/commands";
import {
  cameraSecretsMatch,
  createCameraDeviceToken,
  createCameraPairingCode,
  hashCameraSecret,
  normalizePairingCode,
} from "@/lib/cameras/crypto";
import { linkStatusLabel, normalizeReportedCamera, toStaffCameraSource } from "@/lib/cameras/map";
import { cameraInventoryUpsertSchema } from "@/lib/validation/schemas";
import { describeCameraConnectorLink, isCameraConnectorStale } from "@/lib/cameras/status";
import { CAMERA_COMMAND_TTL_MS } from "@/lib/cameras/types";
import { cameraConnectorSyncSchema, cameraControlCommandSchema } from "@/lib/validation/schemas";

describe("camera permissions", () => {
  it("lets managers operate but not pair", () => {
    expect(canOperateCameras("manager")).toBe(true);
    expect(authorizeCameraOperate("manager").allowed).toBe(true);
    expect(canConfigureCameraConnector("manager")).toBe(false);
    expect(authorizeCameraConfigure("manager").allowed).toBe(false);
  });

  it("lets viewers see status but not operate", () => {
    expect(authorizeCameraView("viewer").allowed).toBe(true);
    expect(authorizeCameraOperate("viewer").allowed).toBe(false);
  });

  it("lets admins pair and operate", () => {
    expect(authorizeCameraConfigure("admin").allowed).toBe(true);
    expect(authorizeCameraOperate("admin").allowed).toBe(true);
  });
});

describe("camera crypto", () => {
  it("hashes and matches device tokens", () => {
    const token = createCameraDeviceToken();
    const hash = hashCameraSecret(token);
    expect(hash).toHaveLength(64);
    expect(cameraSecretsMatch(hash, token)).toBe(true);
    expect(cameraSecretsMatch(hash, `${token}x`)).toBe(false);
  });

  it("normalizes pairing codes", () => {
    expect(normalizePairingCode(" ab-cd 12 ")).toBe("ABCD12");
    expect(createCameraPairingCode()).toHaveLength(8);
  });
});

describe("camera commands allowlist", () => {
  it("accepts move payloads and rejects unknown directions", () => {
    expect(parseCameraCommandPayload("ptz_move", { direction: "up", speed: 8 }).success).toBe(true);
    expect(parseCameraCommandPayload("ptz_move", { direction: "sideways", speed: 8 }).success).toBe(false);
  });

  it("blocks PTZ on program output", () => {
    const result = commandSupportedByCamera("ptz_move", {
      ptz: true,
      zoom: true,
      presets: false,
      presetSave: false,
      focus: false,
      isProgramOutput: true,
    });
    expect(result.ok).toBe(false);
  });

  it("marks expired commands", () => {
    const past = new Date(Date.now() - CAMERA_COMMAND_TTL_MS - 10).toISOString();
    expect(isCommandExpired(past)).toBe(true);
    const future = new Date(Date.now() + 1000).toISOString();
    expect(isCommandExpired(future)).toBe(false);
  });

  it("validates staff command schema", () => {
    expect(
      cameraControlCommandSchema.safeParse({
        cameraId: "11111111-1111-4111-8111-111111111111",
        kind: "ptz_stop",
      }).success,
    ).toBe(true);
    expect(
      cameraControlCommandSchema.safeParse({
        cameraId: "11111111-1111-4111-8111-111111111111",
        kind: "shell",
        payload: { cmd: "rm -rf /" },
      }).success,
    ).toBe(false);
  });
});

describe("camera mapping and status", () => {
  it("forces program output to non-controllable", () => {
    const row = normalizeReportedCamera(
      {
        sourceKey: "program",
        title: "Ecamm Program",
        protocol: "ndi_ptz",
        isProgramOutput: true,
        supportsPtz: true,
        supportsZoom: true,
      },
      0,
    );
    expect(row.supports_ptz).toBe(false);
    expect(row.is_program_output).toBe(true);
  });

  it("maps staff sources with capability flags", () => {
    const source = toStaffCameraSource({
      id: "c1",
      source_key: "sim-a",
      title: "Simulated Cam A (PTZ)",
      protocol: "simulated",
      is_simulated: true,
      is_program_output: false,
      supports_ptz: true,
      supports_zoom: true,
      supports_presets: true,
      supports_preset_save: false,
      supports_focus: false,
      online: true,
      last_error: null,
      link_status: "simulated",
      connection_target: null,
      capabilities: {
        ptz: true,
        zoom: true,
        presets: true,
        presetsList: [{ id: "1", label: "Wide" }],
      },
    });
    expect(source.isSimulated).toBe(true);
    expect(source.linkStatus).toBe("simulated");
    expect(source.capabilities.presetsList[0]?.label).toBe("Wide");
    expect(linkStatusLabel("ndi_pending")).toMatch(/NDI configured/i);
  });

  it("validates camera inventory create payloads", () => {
    expect(
      cameraInventoryUpsertSchema.safeParse({
        title: "Stage left",
        sourceKey: "stage-left",
        protocol: "ndi_ptz",
        connectionTarget: "CAM 1",
      }).success,
    ).toBe(true);
    expect(
      cameraInventoryUpsertSchema.safeParse({
        title: "Bad",
        sourceKey: "has spaces",
        protocol: "ndi_ptz",
      }).success,
    ).toBe(false);
  });

  it("describes offline and disabled remote control", () => {
    const now = new Date("2026-09-29T12:00:00.000Z");
    expect(isCameraConnectorStale(null, now)).toBe(true);
    expect(isCameraConnectorStale("2026-09-29T11:59:20.000Z", now)).toBe(false);
    expect(isCameraConnectorStale("2026-09-29T11:59:00.000Z", now)).toBe(true);
    expect(
      describeCameraConnectorLink({
        lastSeenAt: "2026-09-29T11:59:55.000Z",
        remoteControlEnabled: false,
        revokedAt: null,
        now,
      }).label,
    ).toMatch(/disabled/i);
  });
});

describe("camera sync schema", () => {
  it("accepts simulated camera reports", () => {
    const parsed = cameraConnectorSyncSchema.safeParse({
      remoteControlEnabled: true,
      cameras: [
        {
          sourceKey: "sim-cam-a",
          title: "Simulated Cam A (PTZ)",
          protocol: "simulated",
          isSimulated: true,
          supportsPtz: true,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts snapshot preview updates with base64 frames", () => {
    const parsed = cameraConnectorSyncSchema.safeParse({
      remoteControlEnabled: true,
      cameras: [],
      previewUpdates: [
        {
          sessionId: "11111111-1111-4111-8111-111111111111",
          status: "active",
          snapshotBase64: Buffer.from("fake-png").toString("base64"),
          snapshotContentType: "image/png",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("camera active device selection", () => {
  it("prefers the most recently seen non-revoked device", async () => {
    const { describeCameraConnectorLink } = await import("@/lib/cameras/status");
    const newer = describeCameraConnectorLink({
      lastSeenAt: new Date().toISOString(),
      remoteControlEnabled: true,
      revokedAt: null,
    });
    const older = describeCameraConnectorLink({
      lastSeenAt: new Date(Date.now() - 60_000).toISOString(),
      remoteControlEnabled: true,
      revokedAt: null,
    });
    expect(newer.online).toBe(true);
    expect(older.online).toBe(false);
  });
});

describe("camera discovered NDI sync", () => {
  it("accepts discovered NDI source reports", () => {
    const parsed = cameraConnectorSyncSchema.safeParse({
      remoteControlEnabled: true,
      ndiNote: "Found 1 NDI source(s) on this Mac.",
      discoveredNdi: [
        { name: "CAM 1 (Studio)", urlAddress: "192.168.1.20:5961", sourceKey: "ndi-cam-1-studio" },
      ],
      cameras: [],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("camera source delete schema", () => {
  it("requires a camera id", async () => {
    const { cameraSourceDeleteSchema } = await import("@/lib/validation/schemas");
    expect(
      cameraSourceDeleteSchema.safeParse({ cameraId: "11111111-1111-4111-8111-111111111111" }).success,
    ).toBe(true);
    expect(cameraSourceDeleteSchema.safeParse({}).success).toBe(false);
  });
});
