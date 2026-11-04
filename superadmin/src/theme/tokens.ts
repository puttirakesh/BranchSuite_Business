/**
 * Design tokens extracted from the reference APK (BranchSuite Admin v2.3).
 * Values come from computed styles of the rendered APK UI in admin mode
 * (body.portal-admin). See docs/APK_DESIGN_SYSTEM.md for the source of each value.
 */
export const colors = {
  bg: "#F8F6FF",
  surface: "#FFFFFF",
  surfaceRaised: "#FCFDFF",
  ink: "#182A43",
  inkStrong: "#1F3552",
  heading: "#233A55",
  muted: "#5C6E84",
  subtle: "#687990",
  faint: "#94A0B2",
  line: "#E2E8F1",
  lineStrong: "#D6DFEC",
  fieldBorder: "#D6DFEB",
  fieldBg: "#FCFDFF",
  label: "#34445B",
  primary: "#6947B8",
  primaryPressed: "#5A3BA3",
  primarySoft: "#EDE7F9",
  sidebarActive: "#EDE8FA",
  sidebarActiveInk: "#6D49AF",
  sidebarActiveEdge: "#9B81CC",
  sidebarInk: "#657791",
  overlay: "rgba(23, 38, 63, 0.42)",
  toast: "#1C2B45",
  error: "#B3293E",
  focus: "#8AB4FA",
} as const;

export type Tone = "blue" | "lavender" | "mint" | "amber";
/** Accent families used by stat cards, module cards and tiles. */
export const tones: Record<
  Tone,
  { iconBg: string; iconFg: string; tint: string; border: string; link: string }
> = {
  blue: {
    iconBg: "#EAF0FF",
    iconFg: "#315BBC",
    tint: "#F6F8FF",
    border: "#E0E8F8",
    link: "#315BBC",
  },
  lavender: {
    iconBg: "#EEE7F9",
    iconFg: "#7850AD",
    tint: "#F8F5FE",
    border: "#E8E1F2",
    link: "#7850AD",
  },
  mint: {
    iconBg: "#E2F5EA",
    iconFg: "#187251",
    tint: "#F4FBF8",
    border: "#DCEDE5",
    link: "#187251",
  },
  amber: {
    iconBg: "#FFF1DD",
    iconFg: "#9C661A",
    tint: "#FFF9F0",
    border: "#F0E6D4",
    link: "#9C661A",
  },
};

export type PillTone = "green" | "amber" | "red" | "purple";
export const pills: Record<PillTone, { bg: string; fg: string }> = {
  green: { bg: "#E1F4EA", fg: "#126B51" },
  amber: { bg: "#FFF0D8", fg: "#8A5A10" },
  red: { bg: "#FBE7EC", fg: "#A42F43" },
  purple: { bg: "#EEE7F8", fg: "#674497" },
};

export type NoteTone = "info" | "warning" | "success" | "error";
export const notes: Record<NoteTone, { bg: string; fg: string }> = {
  info: { bg: "#EBF1FD", fg: "#3D5A87" },
  warning: { bg: "#FFF4E3", fg: "#8A6228" },
  success: { bg: "#E7F5EE", fg: "#1D6B4E" },
  error: { bg: "#FBE7EC", fg: "#A42F43" },
};

export const radius = {
  pill: 7,
  sm: 11,
  md: 13,
  tile: 16,
  card: 19,
  hero: 23,
  price: 22,
  sheet: 26,
} as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 21, xxl: 32 } as const;

/** Shadow equivalent of `0 3px 14px rgba(36,59,97,.02)` (very soft card shadow). */
export const shadow = {
  shadowColor: "#243B61",
  shadowOpacity: 0.05,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
} as const;

/** Breakpoints taken from the APK stylesheet media queries. */
export const breakpoints = {
  compact: 360,
  medium: 560,
  sidebar: 1000,
  wide: 1320,
} as const;
