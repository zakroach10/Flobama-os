export const FLOBAMA_LOGO_SRC = "/flobama-logo.png?v=3";
export const FLOBAMA_LOGO_ALT = "FloBama";
export const FLOBAMA_LOGO_WIDTH = 1500;
export const FLOBAMA_LOGO_HEIGHT = 495;

export function flobamaLogoHeight(width: number) {
  return Math.round((width * FLOBAMA_LOGO_HEIGHT) / FLOBAMA_LOGO_WIDTH);
}
