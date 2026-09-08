import { describe, expect, it } from "vitest";
import { buildObsWebsocketUrl, mapObsSceneList } from "@/lib/obs/session";

describe("OBS session helpers", () => {
  it("builds a LAN websocket URL and rejects junk hosts", () => {
    expect(buildObsWebsocketUrl("127.0.0.1", "4455")).toBe("ws://127.0.0.1:4455");
    expect(buildObsWebsocketUrl("obs.local", "4455")).toBe("ws://obs.local:4455");
    expect(buildObsWebsocketUrl("127.0.0.1/evil", "4455")).toBeNull();
    expect(buildObsWebsocketUrl("127.0.0.1", "nope")).toBeNull();
  });

  it("maps an obs-websocket v5 scene list payload", () => {
    const mapped = mapObsSceneList({
      currentProgramSceneName: "Program",
      currentPreviewSceneName: "Preview",
      scenes: [
        { sceneName: "Preview", sceneIndex: 1 },
        { sceneName: "Program", sceneIndex: 0 },
        { sceneName: "", sceneIndex: 2 },
      ],
    });
    expect(mapped.scenes.map((scene) => scene.sceneName)).toEqual(["Program", "Preview"]);
    expect(mapped.program).toBe("Program");
    expect(mapped.preview).toBe("Preview");
  });
});
