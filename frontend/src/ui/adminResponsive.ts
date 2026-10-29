export type AdminGridKind = 'overview' | 'workspace' | 'records';
export type ResponsiveScreen = 'mobile' | 'tablet' | 'desktop';
import { RESPONSIVE_BREAKPOINTS } from './responsiveBreakpoints';

/** Measure available content space, rather than a device name or physical pixels. */
export function adminGrid(contentWidth: number, fontScale = 1, kind: AdminGridKind = 'records', gap = 12, screen?: ResponsiveScreen) {
  const width = Math.max(0, contentWidth);
  const scale = Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  let columns: number;
  if (screen) {
    columns = kind !== 'records'
      ? screen === 'desktop' ? 3 : 2
      : screen === 'desktop' ? 3 : screen === 'tablet' ? 2 : 1;
  } else if (kind === 'records') {
    columns = Math.max(1, Math.min(3, Math.floor((width + gap) / (280 * scale + gap))));
  } else if (kind === 'overview') {
    columns = width >= 840 * scale ? 3 : 2;
  } else {
    columns = width >= 840 * scale ? 3
      : 2;
  }
  // Dashboard tiles keep their standard grid. Detailed record cards also
  // respect available width after sidebar and page padding, at every font size.
  if (scale > 1 || kind === 'records') {
    const minimum = kind === 'records' ? 280 : kind === 'workspace' ? 140 : 120;
    columns = Math.min(columns, Math.max(1, Math.floor((width + gap) / (minimum * scale + gap))));
  }
  return { columns, cardWidth: Math.max(0, (width - (columns - 1) * gap) / columns) };
}

export function adminPageSpacing(width: number) {
  return width >= RESPONSIVE_BREAKPOINTS.desktop ? 32 : width >= RESPONSIVE_BREAKPOINTS.tablet ? 24 : width < 300 ? 12 : 16;
}
