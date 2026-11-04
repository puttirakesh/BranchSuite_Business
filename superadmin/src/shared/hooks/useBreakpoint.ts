import { useWindowDimensions } from 'react-native';
import { breakpoints } from '../../theme/tokens';

/** Responsive flags matching the APK media queries (560 / 1000 / 1320 px). */
export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    compact: width < breakpoints.compact,
    medium: width >= breakpoints.medium,
    sidebar: width >= breakpoints.sidebar,
    wide: width >= breakpoints.wide,
    landscape: width > height,
  };
}

/** Column count for a card grid given a target breakpoint table. */
export function useColumns(table: { base: number; medium?: number; sidebar?: number; wide?: number }) {
  const bp = useBreakpoint();
  if (bp.wide && table.wide) return table.wide;
  if (bp.sidebar && table.sidebar) return table.sidebar;
  if (bp.medium && table.medium) return table.medium;
  return table.base;
}
