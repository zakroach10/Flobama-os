import { toBlob } from "html-to-image";

export async function downloadNodePng(
  node: HTMLElement,
  filename: string,
  size: { width: number; height: number },
) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${size.width}px`,
    `height:${size.height}px`,
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
    "overflow:hidden",
  ].join(";");
  const clone = node.cloneNode(true) as HTMLElement;
  host.append(clone);
  document.body.append(host);

  try {
    await document.fonts.ready;
    await waitForImages(clone);

    const blob = await toBlob(clone, {
      cacheBust: true,
      includeQueryParams: true,
      pixelRatio: 1,
      skipAutoScale: true,
      skipFonts: true,
      width: size.width,
      height: size.height,
      canvasWidth: size.width,
      canvasHeight: size.height,
      backgroundColor: "#1b1612",
    });

    if (!blob || blob.size < 32) {
      throw new Error("Export produced an empty image.");
    }

    saveBlob(blob, filename);
  } finally {
    host.remove();
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function waitForImages(root: HTMLElement) {
  return Promise.all(
    [...root.querySelectorAll("img")].map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}
