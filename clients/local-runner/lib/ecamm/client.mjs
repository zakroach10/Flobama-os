/**
 * One method per verified Ecamm endpoint.
 */

import { SoundAction } from "./constants.mjs";
import {
  parseAudioFilterList,
  parseCameraList,
  parseChannelList,
  parseConnectionPermission,
  parseImageIcon,
  parseInfo,
  parseNumeric,
  parseOverlayList,
  parseProfileList,
  parseSceneList,
  parseSoundList,
  parseSourceMode,
  parseVideoList,
  unwrapScalar,
  yesNo,
} from "./parsers.mjs";

export function createEcammClient(http) {
  return new EcammClient(http);
}

export class EcammClient {
  constructor(http) {
    this.http = http;
  }

  // --- status ---
  async getConnectionStatus() {
    return parseConnectionPermission(await this.http.get("getConnectionStatus"));
  }
  async getInfo() {
    return parseInfo(await this.http.get("getInfo"));
  }
  async getButtonLabel() {
    return unwrapScalar(await this.http.get("getButtonLabel"));
  }
  async getPauseButtonLabel() {
    return unwrapScalar(await this.http.get("getPauseButtonLabel"));
  }
  async getViewers() {
    return parseNumeric(unwrapScalar(await this.http.get("getViewers"))) ?? 0;
  }
  async getLiveDemo() {
    return yesNo(unwrapScalar(await this.http.get("getLiveDemo")));
  }
  async getHideShowUI() {
    return yesNo(unwrapScalar(await this.http.get("getHideShowUI")));
  }
  async getMute(bus) {
    return yesNo(unwrapScalar(await this.http.get("getMute", bus ? { bus } : undefined)));
  }

  // --- lists ---
  async getSceneList() {
    return parseSceneList(await this.http.get("getSceneList"));
  }
  async getSceneDict() {
    return await this.http.get("getSceneDict");
  }
  async getSceneImage(id) {
    return parseImageIcon(await this.http.get("getSceneImage", { id }));
  }
  async getOverlayList() {
    return parseOverlayList(await this.http.get("getOverlayList"));
  }
  async getOverlayDict() {
    return await this.http.get("getOverlayDict");
  }
  async getOverlayImage(id) {
    return parseImageIcon(await this.http.get("getOverlayImage", { id }));
  }
  async getInputs() {
    return parseCameraList(await this.http.get("getInputs"));
  }
  async getVideoList() {
    return parseVideoList(await this.http.get("getVideoList"));
  }
  async getVideoDict() {
    return await this.http.get("getVideoDict");
  }
  async getVideoImage(id) {
    return parseImageIcon(await this.http.get("getVideoImage", { id }));
  }
  async getSoundList() {
    return parseSoundList(await this.http.get("getSoundList"));
  }
  async getSoundDict() {
    return await this.http.get("getSoundDict");
  }
  async getAudioFilterList() {
    return parseAudioFilterList(await this.http.get("getAudioFilterList"));
  }
  async getAudioFilterDict() {
    return await this.http.get("getAudioFilterDict");
  }
  async getProfileList() {
    return parseProfileList(await this.http.get("getProfileList"));
  }
  async getChannels() {
    return parseChannelList(await this.http.get("getChannels"));
  }

  // --- currents ---
  async getCurrentScene() {
    return unwrapScalar(await this.http.get("getCurrentScene"));
  }
  async getCurrentMode() {
    return parseSourceMode(await this.http.get("getCurrentMode"));
  }
  async getDefaultCamera() {
    return unwrapScalar(await this.http.get("getDefaultCamera"));
  }
  async getVolume(bus) {
    return parseNumeric(unwrapScalar(await this.http.get("getVolume", { bus })));
  }

  // --- broadcast ---
  async setClickButton(params = {}) {
    await this.http.set("setClickButton", params);
  }
  async setClickPauseButton() {
    await this.http.set("setClickPauseButton");
  }
  async setStartNewRecording() {
    await this.http.set("setStartNewRecording");
  }
  async setComment(text) {
    await this.http.set("setComment", { text });
  }
  async setShowComment() {
    await this.http.set("setShowComment");
  }
  async setHideComment() {
    await this.http.set("setHideComment");
  }
  async setMarker({ text, dialogbox = false } = {}) {
    await this.http.set("setMarker", {
      text,
      dialogbox: dialogbox ? "true" : "false",
    });
  }

  // --- scenes ---
  async setScene(id) {
    await this.http.set("setScene", { id });
  }
  async setNext() {
    await this.http.set("setNext");
  }
  async setPrev() {
    await this.http.set("setPrev");
  }
  async setInput(id) {
    await this.http.set("setInput", { id });
  }
  async setMode(mode) {
    await this.http.set("setMode", { mode });
  }
  async setVideo(id) {
    await this.http.set("setVideo", { id });
  }
  async setPIP() {
    await this.http.set("setPIP");
  }
  async setOverlay(id) {
    await this.http.set("setOverlay", { id });
  }

  // --- audio ---
  async setMute(bus) {
    await this.http.set("setMute", bus ? { bus } : undefined);
  }
  async setVolume(bus, volume) {
    await this.http.set("setVolume", { bus, volume });
  }
  async setAudioFilter(id) {
    await this.http.set("setAudioFilter", { id });
  }
  async setSound(id, volume, action = SoundAction.Restart) {
    await this.http.set("setSound", { id, volume, action });
  }
  async setSoundVolume(volume) {
    await this.http.set("setSoundVolume", { volume });
  }
  async setSoundStop() {
    await this.http.set("setSoundStop");
  }
  async setSoundPause() {
    await this.http.set("setSoundPause");
  }

  // --- utilities ---
  async setPreviewMode() {
    await this.http.set("setPreviewMode");
  }
  async setPublish() {
    await this.http.set("setPublish");
  }
  async setProfile(id) {
    await this.http.set("setProfile", { id });
  }
  async setLiveDemo() {
    await this.http.set("setLiveDemo");
  }
  async setHideShowUI() {
    await this.http.set("setHideShowUI");
  }

  // --- zoom ---
  async setZoomNew(pmi = true) {
    await this.http.set("setZoomNew", { pmi: pmi ? "true" : "false" });
  }
  async setZoomLeave(end = true) {
    await this.http.set("setZoomLeave", { end: end ? "true" : "false" });
  }
  async setZoomPanel(panel) {
    await this.http.set("setZoomPanel", { panel });
  }
  async setZoomVideo() {
    await this.http.set("setZoomVideo");
  }
  async setZoomAudio() {
    await this.http.set("setZoomAudio");
  }
  async setZoomMuteAll() {
    await this.http.set("setZoomMuteAll");
  }
  async setZoomRaiseHand() {
    await this.http.set("setZoomRaiseHand");
  }
  async setZoomFullScreen() {
    await this.http.set("setZoomFullScreen");
  }
  async setZoomCloudRecord() {
    await this.http.set("setZoomCloudRecord");
  }
  async setZoomLocalRecord() {
    await this.http.set("setZoomLocalRecord");
  }
  async setZoomPauseRecord() {
    await this.http.set("setZoomPauseRecord");
  }
  async setZoomPrevGallery() {
    await this.http.set("setZoomPrevGallery");
  }
  async setZoomNextGallery() {
    await this.http.set("setZoomNextGallery");
  }
  async setZoomGallerySpeaker() {
    await this.http.set("setZoomGallerySpeaker");
  }
  async setSpotlightSelf() {
    await this.http.set("setSpotlightSelf");
  }

  /** Generic allowlisted call for diagnostics / advanced typed actions. */
  async call(endpoint, params, { asAction = false } = {}) {
    if (asAction || String(endpoint).startsWith("set")) {
      await this.http.set(endpoint, params);
      return { ok: true, body: "Done" };
    }
    const json = await this.http.get(endpoint, params);
    return { ok: true, json };
  }
}
