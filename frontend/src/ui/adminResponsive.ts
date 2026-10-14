export type AdminGridKind = 'overview' | 'workspace' | 'records';

/** Measure available content space, rather than a device name or physical pixels. */
export function adminGrid(contentWidth: number, fontScale = 1, kind: AdminGridKind = 'records', gap = 12) {
  const width = Math.max(0, contentWidth);
  const scale = Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  let columns: number;
  if (kind === 'records') {
    columns = Math.max(1, Math.min(3, Math.floor((width + gap) / (280 * scale + gap))));
  } else {
    const compactScale = Math.max(1, scale / 1.3);
    columns = kind === 'overview' && width / scale >= 900 ? 4
      : kind === 'workspace' && width / scale >= 840 ? 3
      : width / compactScale >= 280 ? 2 : 1;
  }
  return { columns, cardWidth: Math.max(0, (width - (columns - 1) * gap) / columns) };
}

export function adminPageSpacing(width: number) {
  return width >= 1000 ? 32 : width >= 600 ? 24 : width < 300 ? 12 : 16;
}
