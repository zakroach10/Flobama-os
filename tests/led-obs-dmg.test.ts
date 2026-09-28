import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { LED_OBS_CLIENT_VERSION, LED_OBS_DMG_HREF } from "@/lib/constants";

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

describe("LED OBS disk image", () => {
  it("publishes the current client without TypeScript or the broken password prompt", () => {
    expect(LED_OBS_DMG_HREF).toBe(`/downloads/FloBama-LED-OBS-${LED_OBS_CLIENT_VERSION}.dmg`);
    const script = readFileSync(path.join(process.cwd(), "clients/led-obs/mac/led-obs.sh"), "utf8");
    const client = readFileSync(path.join(process.cwd(), "clients/led-obs/index.mjs"), "utf8");
    expect(script).toContain(`echo "FloBama LED OBS ${LED_OBS_CLIENT_VERSION}"`);
    expect(script).toContain("ask_secret");
    expect(script).not.toContain("set hidden");
    expect(client).not.toMatch(/\sas\s+\{/);

    const file = path.join(process.cwd(), "public", LED_OBS_DMG_HREF);
    const bytes = readFileSync(file);
    expect(bytes.byteLength).toBeGreaterThan(100_000);
    expect(bytes.subarray(bytes.byteLength - 512, bytes.byteLength - 508).toString()).toBe("koly");
    const text = diskImageText(bytes);
    expect(text).toContain(`FloBama LED OBS ${LED_OBS_CLIENT_VERSION}`);
    expect(text).toContain("ask_secret");
    expect(text).toContain("desiredObsScene");
    expect(text).not.toContain("set hidden");
    expect(text).not.toContain("item 3 of argv");
    expect(text).not.toContain("as { desiredObsScene");
  });
});
