export const systemFontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const typography = {
  display: { minSize: 24, maxSize: 32, lineHeight: 1.25, weight: '700', tracking: -0.45 },
  pageTitle: { minSize: 22, maxSize: 28, lineHeight: 1.3, weight: '700', tracking: -0.35 },
  sectionTitle: { minSize: 17, maxSize: 20, lineHeight: 1.4, weight: '600', tracking: -0.15 },
  cardTitle: { minSize: 14, maxSize: 16, lineHeight: 1.45, weight: '600', tracking: 0 },
  label: { minSize: 12, maxSize: 13, lineHeight: 1.5, weight: '500', tracking: 0 },
  caption: { minSize: 12, maxSize: 13, lineHeight: 1.5, weight: '400', tracking: 0 },
} as const;
