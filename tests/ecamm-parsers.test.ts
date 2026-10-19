import { describe, expect, it } from "vitest";
import {
  buildQuery,
  inferSessionFromButtonLabel,
  matchInstance,
  parseConnectionPermission,
  parseInfo,
  parseNumeric,
  parseOverlayList,
  parseSceneList,
  parseSoundList,
  unwrapScalar,
  yesNo,
} from "../clients/local-runner/lib/ecamm/index.mjs";
import { validatePathAgainstRoots } from "../clients/local-runner/lib/ecamm/shortcuts.mjs";
import { validateEcammCallEndpoint } from "@/lib/production/commands";
import { ecammEndpointCoverageCounts, ECAMM_ENDPOINTS } from "@/lib/production/ecamm-endpoints";

describe("ecamm query encoding", () => {
  it("encodes spaces as %20 not +", () => {
    expect(buildQuery({ text: "Mark Highlight" })).toBe("?text=Mark%20Highlight");
    expect(buildQuery({ bus: "system audio", volume: 40 })).toBe(
      "?bus=system%20audio&volume=40",
    );
  });

  it("omits empty params", () => {
    expect(buildQuery({ text: "", channel: "abc" })).toBe("?channel=abc");
  });
});

describe("ecamm parsers", () => {
  it("unwraps scalar arrays and parses yes/no", () => {
    expect(unwrapScalar(["Allowed"])).toBe("Allowed");
    expect(yesNo("yes")).toBe(true);
    expect(yesNo("no")).toBe(false);
    expect(parseNumeric("N/A")).toBeUndefined();
    expect(parseNumeric("42.5")).toBe(42.5);
  });

  it("parses connection permission safely", () => {
    expect(parseConnectionPermission(["Pending"])).toBe("Pending");
    expect(parseConnectionPermission(["Denied"])).toBe("Denied");
    expect(parseConnectionPermission(["weird"])).toBe("Not Found");
  });

  it("parses getInfo including volumes and unmapped keys", () => {
    const info = parseInfo({
      ButtonLabel: "Stop Recording",
      CurrentScene: "scene-1",
      Mute: "no",
      VOLUME_MIC: "55",
      MUTE_MIC: "yes",
      MysteryField: "x",
    });
    expect(info.buttonLabel).toBe("Stop Recording");
    expect(info.currentSceneId).toBe("scene-1");
    expect(info.volumes.mic).toBe(55);
    expect(info.mutes.mic).toBe(true);
    expect(info.unmappedKeys).toContain("MysteryField");
  });

  it("flattens grouped scenes and drops empty ids", () => {
    const scenes = parseSceneList({
      items: [
        {
          title: "Group A",
          UUID: "g1",
          Group: true,
          Children: [
            { title: "Intro", UUID: "s1", CURRENT: true },
            { title: "Empty", UUID: "" },
          ],
        },
        { title: "Solo", UUID: "s2" },
      ],
    });
    expect(scenes.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(scenes[0].groupName).toBe("Group A");
    expect(scenes[0].current).toBe(true);
  });

  it("parses overlays with visibility", () => {
    const overlays = parseOverlayList({
      items: [{ title: "Lower third", UUID: "o1", Visible: true, IsComment: false }],
    });
    expect(overlays[0]).toMatchObject({ id: "o1", visible: true });
  });

  it("splits sounds and folders", () => {
    const { sounds, folders } = parseSoundList({
      items: [
        {
          title: "Hits",
          UUID: "f1",
          Group: true,
          Children: [{ title: "Boom", UUID: "snd1", Duration: 1.2 }],
        },
      ],
    });
    expect(folders[0].id).toBe("f1");
    expect(sounds[0]).toMatchObject({ id: "snd1", folderName: "Hits" });
  });

  it("infers broadcast state from button labels without inventing certainty", () => {
    expect(inferSessionFromButtonLabel("Stop Recording").active).toBe(true);
    expect(inferSessionFromButtonLabel("Start Streaming").active).toBe(false);
    expect(inferSessionFromButtonLabel("Custom").confidence).toMatch(/low|unknown/);
  });
});

describe("ecamm discovery matching", () => {
  const found = [
    {
      name: "Ecamm Live Remote",
      hostname: "Booth-Mac.local",
      addresses: ["192.168.1.10"],
      port: 50001,
      fqdn: "a",
    },
    {
      name: "Ecamm Live Remote (2)",
      hostname: "LED-Mac.local",
      addresses: ["192.168.1.20"],
      port: 50002,
      fqdn: "b",
    },
  ];

  it("matches by hostname and never silently picks another Mac", () => {
    expect(matchInstance(found, { hostname: "Booth-Mac.local" })?.port).toBe(50001);
    expect(matchInstance(found, { hostname: "Missing.local" })).toBeUndefined();
    expect(matchInstance(found, { address: "192.168.1.20" })?.hostname).toBe("LED-Mac.local");
  });
});

describe("recording path validation", () => {
  it("rejects paths outside configured roots", async () => {
    const roots = ["/tmp/flobama-recordings-root"];
    const bad = await validatePathAgainstRoots("/etc/passwd", roots);
    expect(bad.ok).toBe(false);
  });
});

describe("production allowlist", () => {
  it("covers the verified API inventory", () => {
    const counts = ecammEndpointCoverageCounts();
    expect(counts.total).toBe(ECAMM_ENDPOINTS.length);
    expect(counts.total).toBeGreaterThanOrEqual(70);
    expect(ECAMM_ENDPOINTS.some((e) => e.name === "getSceneImage")).toBe(true);
    expect(ECAMM_ENDPOINTS.some((e) => e.name === "getMute")).toBe(true);
    expect(ECAMM_ENDPOINTS.some((e) => e.name === "setZoomLeave")).toBe(true);
  });

  it("gates undocumented per-bus mute unless enabled", () => {
    expect(validateEcammCallEndpoint("setMute").ok).toBe(true);
    expect(validateEcammCallEndpoint("setMute", { bus: "mic" }).ok).toBe(false);
    expect(validateEcammCallEndpoint("setMute", { bus: "mic" }, { allowPerBusMute: true }).ok).toBe(
      true,
    );
    expect(validateEcammCallEndpoint("setClickButton").ok).toBe(true);
    expect(validateEcammCallEndpoint("rm -rf /").ok).toBe(false);
  });
});
