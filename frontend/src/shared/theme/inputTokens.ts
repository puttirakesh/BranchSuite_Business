/**
 * Single source of truth for form-control chrome (text inputs, dropdowns, date fields, search).
 * Focus preserves the neutral border and surface; errors remain prominent.
 */
export const inputTokens = {
  height: 44,
  radiusNative: 6,
  radiusWeb: 10,
  surface: '#FFFFFF',
  border: '#CCD6E5',
  borderError: '#B94D61',
  label: '#5F6368',
  labelFocus: '#20334F',
  text: '#20334F',
  placeholder: '#607591',
} as const;
