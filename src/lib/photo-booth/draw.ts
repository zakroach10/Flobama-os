import {
  PHOTO_BOOTH_FOOTER,
  PHOTO_BOOTH_HEIGHT,
  PHOTO_BOOTH_IMAGE_HEIGHT,
  PHOTO_BOOTH_WIDTH,
} from "@/lib/photo-booth/constants";
import { coverSourceRect } from "@/lib/photo-booth/frame";

export type BoothLogo = {
  image: CanvasImageSource;
  width: number;
  height: number;
};

export function drawMirroredCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || destWidth <= 0 || destHeight <= 0) return;
  const crop = coverSourceRect(sourceWidth, sourceHeight, destWidth, destHeight);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, destWidth, destHeight);
  ctx.clip();
  ctx.translate(destWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, destWidth, destHeight);
  ctx.restore();
}

export function drawPhotoBoothStill(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: {
    eventLabel: string | null;
    whenLabel: string;
    logo: BoothLogo | null;
    fontFamily: string;
  },
) {
  ctx.clearRect(0, 0, PHOTO_BOOTH_WIDTH, PHOTO_BOOTH_HEIGHT);
  ctx.fillStyle = "#0c0b0a";
  ctx.fillRect(0, 0, PHOTO_BOOTH_WIDTH, PHOTO_BOOTH_HEIGHT);
  drawMirroredCover(ctx, source, sourceWidth, sourceHeight, PHOTO_BOOTH_WIDTH, PHOTO_BOOTH_IMAGE_HEIGHT);

  const font = options.fontFamily || "system-ui, sans-serif";
  let y = PHOTO_BOOTH_IMAGE_HEIGHT;
  ctx.fillStyle = "#0c0b0a";
  ctx.fillRect(0, y, PHOTO_BOOTH_WIDTH, PHOTO_BOOTH_FOOTER);
  ctx.fillStyle = "#e4572e";
  ctx.fillRect(0, y, PHOTO_BOOTH_WIDTH, 10);
  y += 28;

  const logo = options.logo;
  if (logo && logo.width > 0 && logo.height > 0) {
    const fitted = contain(logo.width, logo.height, 760, 108);
    ctx.drawImage(logo.image, (PHOTO_BOOTH_WIDTH - fitted.width) / 2, y, fitted.width, fitted.height);
    y += fitted.height + 16;
  } else {
    ctx.fillStyle = "#f6efe6";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 54px ${font}`;
    ctx.fillText("FloBama", PHOTO_BOOTH_WIDTH / 2, y);
    y += 70;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#f6efe6";
  ctx.font = `600 40px ${font}`;
  ctx.fillText(fitText(ctx, options.eventLabel || "Music Hall", PHOTO_BOOTH_WIDTH - 96), PHOTO_BOOTH_WIDTH / 2, y);
  y += 50;
  ctx.fillStyle = "#c9b8aa";
  ctx.font = `500 28px ${font}`;
  ctx.fillText(options.whenLabel, PHOTO_BOOTH_WIDTH / 2, y);
  y += 40;
  ctx.fillStyle = "#e4572e";
  ctx.font = `600 22px ${font}`;
  ctx.fillText("FLORENCE, ALABAMA", PHOTO_BOOTH_WIDTH / 2, y);
}

function contain(srcW: number, srcH: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return { width: srcW * scale, height: srcH * scale };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}
