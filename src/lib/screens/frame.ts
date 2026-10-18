export const VERTICAL_FRAME_WIDTH = 1080;
export const VERTICAL_FRAME_HEIGHT = 1920;

export function containScale(
  viewportWidth: number,
  viewportHeight: number,
  frameWidth = VERTICAL_FRAME_WIDTH,
  frameHeight = VERTICAL_FRAME_HEIGHT,
) {
  if (viewportWidth <= 0 || viewportHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) return 1;
  return Math.min(viewportWidth / frameWidth, viewportHeight / frameHeight);
}

/** Shrink a slide to the frame. Never scales up. */
export function fitScale(available: number, needed: number) {
  if (!(available > 0) || !(needed > 0)) return 1;
  return Math.min(1, available / needed);
}
