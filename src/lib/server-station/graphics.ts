import {
  SERVER_STATION_GRAPHIC_HEIGHT,
  SERVER_STATION_GRAPHIC_WIDTH,
} from "@/lib/constants";
import {
  buildServerStationGraphicModel,
  type ServerStationGraphicKind,
} from "@/lib/server-station/templates";

export type ServerStationGraphicInput = {
  kind: ServerStationGraphicKind;
  templateId?: string | null;
  headline: string;
  subtitle?: string | null;
  price?: string | null;
  footer?: string | null;
  photoUrl?: string | null;
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

export async function renderServerStationGraphicBlob(input: ServerStationGraphicInput): Promise<Blob> {
  const model = buildServerStationGraphicModel(input);
  const canvas = document.createElement("canvas");
  canvas.width = SERVER_STATION_GRAPHIC_WIDTH;
  canvas.height = SERVER_STATION_GRAPHIC_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the wall graphic preview.");

  const { template } = model;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, template.background);
  gradient.addColorStop(0.55, "#0d0b0a");
  gradient.addColorStop(1, template.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft stage wash
  const wash = ctx.createRadialGradient(canvas.width * 0.7, canvas.height * 0.2, 40, canvas.width * 0.7, canvas.height * 0.2, 700);
  wash.addColorStop(0, `${template.accent}55`);
  wash.addColorStop(1, "transparent");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (input.photoUrl) {
    try {
      const image = await loadImage(input.photoUrl);
      const size = 420;
      const x = canvas.width - size - 120;
      const y = (canvas.height - size) / 2;
      ctx.save();
      roundRect(ctx, x, y, size, size, 28);
      ctx.clip();
      ctx.drawImage(image, x, y, size, size);
      ctx.restore();
      ctx.strokeStyle = `${template.accent}aa`;
      ctx.lineWidth = 6;
      roundRect(ctx, x, y, size, size, 28);
      ctx.stroke();
    } catch {
      // Photo is optional — continue without it.
    }
  }

  ctx.fillStyle = template.badgeColor;
  ctx.font = "700 42px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.fillText(model.badge, 120, 220);

  ctx.fillStyle = template.headlineColor;
  ctx.font = "800 120px 'Avenir Next', 'Segoe UI', sans-serif";
  const headlineLines = wrapLines(ctx, model.headline, input.photoUrl ? 1100 : 1680, 3);
  let y = 360;
  for (const line of headlineLines) {
    ctx.fillText(line, 120, y);
    y += 130;
  }

  if (model.price) {
    ctx.fillStyle = template.accent;
    ctx.font = "700 72px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText(model.price, 120, y + 20);
    y += 110;
  }

  if (model.subtitle) {
    ctx.fillStyle = template.subtitleColor;
    ctx.font = "600 48px 'Avenir Next', 'Segoe UI', sans-serif";
    const subtitleLines = wrapLines(ctx, model.subtitle, input.photoUrl ? 1100 : 1680, 2);
    for (const line of subtitleLines) {
      ctx.fillText(line, 120, y + 10);
      y += 64;
    }
  }

  ctx.fillStyle = template.subtitleColor;
  ctx.font = "600 36px 'Avenir Next', 'Segoe UI', sans-serif";
  ctx.fillText(model.footer, 120, canvas.height - 120);

  // Brand bar
  ctx.fillStyle = template.accent;
  ctx.fillRect(0, canvas.height - 18, canvas.width, 18);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
  if (!blob) throw new Error("Could not export the wall graphic.");
  return blob;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load photo."));
    image.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function graphicPreviewObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}
