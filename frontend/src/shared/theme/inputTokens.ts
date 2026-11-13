/**
 * Single source of truth for form-control chrome (text inputs, dropdowns, date fields, search).
 * Focus feedback is deliberately neutral: a darker slate border, a darker label and a faint
 * surface tint. It stays visible for keyboard and touch users without a coloured outline.
 */
export const inputTokens = {
  height: 44,
  radiusNative: 6,
  radiusWeb: 10,
  surface: '#FFFFFF',
  surfaceFocused: '#F8FAFC',
  border: '#CCD6E5',
  borderFocus: '#64748B',
  borderError: '#B94D61',
  label: '#5F6368',
  labelFocus: '#20334F',
  text: '#20334F',
  placeholder: '#607591',
  focusRingWeb: 'rgba(100, 116, 139, 0.22)',
} as const;
