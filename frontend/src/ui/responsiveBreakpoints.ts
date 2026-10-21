/** Shared screen classes. Keep web, native, admin, and employee layouts in sync. */
export const RESPONSIVE_BREAKPOINTS = {
  mobile: 768,
  compact: 640,
  tablet: 768,
  desktop: 1200,
} as const;

export function screenClass(width: number) {
  if (width >= RESPONSIVE_BREAKPOINTS.desktop) return 'desktop' as const;
  if (width >= RESPONSIVE_BREAKPOINTS.tablet) return 'tablet' as const;
  return 'mobile' as const;
}
