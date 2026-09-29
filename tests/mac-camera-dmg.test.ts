import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CAMERA_CONNECTOR_DMG_HREF, CAMERA_CONNECTOR_VERSION } from "@/lib/constants";

function diskImageText(bytes: Buffer) {
  const trailer = bytes.subarray(bytes.byteLength - 512);
  const xmlOffset = Number(trailer.readBigUInt64BE(216));
  const xmlLength = Number(trailer.readBigUInt64BE(224));
  const xml = bytes.subarray(xmlOffset, xmlOffset + xmlLength).toString("utf8");
  const encoded = xml.match(/<data>([\s\S]*?)<\/data>/)?.[1]?.replace(/\s/g, "") ?? "";
  const mish = Buffer.from(encoded, "base64");
  const runs = mish.readUInt32BE(200);
  let text = "";
  let cursor = 204;
  for (let index = 0; index < runs; index += 1) {
    const type = mish.readUInt32BE(cursor);
    const compOffset = Number(mish.readBigUInt64BE(cursor + 24));
    const compLength = Number(mish.readBigUInt64BE(cursor + 32));
    cursor += 40;
    if (type === 0x80000005) text += inflateSync(bytes.subarray(compOffset, compOffset + compLength)).toString("latin1");
  }
  return text;
}

describe("Mac Camera disk image", () => {
  it("publishes the current connector with pairing flow and no invented shell exec", () => {
    expect(CAMERA_CONNECTOR_DMG_HREF).toBe(`/downloads/FloBama-Mac-Camera-${CAMERA_CONNECTOR_VERSION}.dmg`);
    const script = readFileSync(path.join(process.cwd(), "clients/mac-camera-connector/mac/mac-camera.sh"), "utf8");
    const client = readFileSync(path.join(process.cwd(), "clients/mac-camera-connector/index.mjs"), "utf8");
    expect(script).toContain(`echo "FloBama Mac Camera ${CAMERA_CONNECTOR_VERSION}"`);
    expect(script).toContain("--pair");
    expect(script).toContain("Pairing code from FloBama OS");
    expect(client).toContain("/api/agent/v1/cameras/sync");
    expect(client).toContain("startMenubarHelper");
    expect(client).toContain("buildLocalCameras");
    expect(client).not.toContain("execSync");

    const file = path.join(process.cwd(), "public", CAMERA_CONNECTOR_DMG_HREF);
    const bytes = readFileSync(file);
    expect(bytes.byteLength).toBeGreaterThan(5_000);
    expect(bytes.subarray(bytes.byteLength - 512, bytes.byteLength - 508).toString()).toBe("koly");
    const text = diskImageText(bytes);
    expect(text).toContain(`FloBama Mac Camera ${CAMERA_CONNECTOR_VERSION}`);
    expect(text).toContain("--pair");
    expect(text).toContain("startMenubarHelper");
    expect(text).toContain("CONTROLLING");
    expect(text).toContain("moveWatchdogMs");
  });
});
