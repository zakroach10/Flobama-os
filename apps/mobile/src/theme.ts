/**
 * FloBama guest app visual tokens.
 * Accent matches existing OS warm-red (#d36b4a); dark venue atmosphere from the public site.
 */

export const colors = {
  background: "#140f0d",
  backgroundElevated: "#1f1714",
  surface: "#2a201c",
  border: "rgba(255, 236, 220, 0.12)",
  text: "#f7efe8",
  textMuted: "rgba(247, 239, 232, 0.72)",
  textDim: "rgba(247, 239, 232, 0.5)",
  accent: "#d36b4a",
  accentPressed: "#b8573a",
  accentSoft: "rgba(211, 107, 74, 0.18)",
  success: "#7cbc8a",
  danger: "#e07070",
  onAccent: "#1a1210",
  splash: "#1a1210",
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
} as const;

export const touchMin = 48;
