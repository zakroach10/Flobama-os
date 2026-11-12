import { pickCamera, type CameraCandidate } from "@/lib/photo-booth/frame";

export async function openBoothCamera(preferredId: string | null): Promise<{
  stream: MediaStream;
  devices: CameraCandidate[];
  deviceId: string | null;
}> {
  const first = await requestStream(preferredId);
  const devices = await listCameras();
  const currentId = first.getVideoTracks()[0]?.getSettings().deviceId ?? null;
  const savedStillThere = Boolean(preferredId && devices.some((device) => device.deviceId === preferredId));
  const picked = pickCamera(devices, savedStillThere ? preferredId : null);
  if (picked && picked !== currentId) {
    first.getTracks().forEach((track) => track.stop());
    try {
      const next = await requestStream(picked);
      return {
        stream: next,
        devices,
        deviceId: next.getVideoTracks()[0]?.getSettings().deviceId ?? picked,
      };
    } catch {
      const fallback = await requestStream(null);
      return {
        stream: fallback,
        devices,
        deviceId: fallback.getVideoTracks()[0]?.getSettings().deviceId ?? null,
      };
    }
  }
  return { stream: first, devices, deviceId: currentId };
}

async function listCameras(): Promise<CameraCandidate[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device) => ({ deviceId: device.deviceId, label: device.label }));
}

async function requestStream(deviceId: string | null): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
    },
    {
      audio: false,
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    },
  ];
  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  if (deviceId) return requestStream(null);
  throw lastError instanceof Error ? lastError : new Error("Camera failed.");
}

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission is blocked. Allow the camera for this site in Chrome, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
    return "No webcam found. Power on the Mevo, double-tap the power button for Wired Webcam mode, and plug it into this kiosk.";
  }
  return "The camera didn't start. Check the USB cable and try again.";
}
