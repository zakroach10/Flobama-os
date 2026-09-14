/** Contain-fit a fixed artboard into a box without upscaling past `maxScale`. */
export function previewContainScale(
  artWidth: number,
  artHeight: number,
  availableWidth: number,
  availableHeight: number,
  maxScale = 1,
): number {
  if (artWidth <= 0 || artHeight <= 0 || availableWidth <= 0 || availableHeight <= 0) {
    return 0;
  }
  return Math.min(availableWidth / artWidth, availableHeight / artHeight, maxScale);
}
