/**
 * Single source of truth for form-control chrome (text inputs, dropdowns, date fields, search).
 * Focus never changes or colours the border. Feedback is a faint surface tint plus a darker label,
 * so a focused or open control is still identifiable without an outline.
 */
export const inputTokens = {
  height: 44,
  radiusNative: 6,
  radiusWeb: 10,
  surface: '#FFFFFF',
  surfaceFocused: '#F1F5F9',
  border: '#CCD6E5',
  borderError: '#B94D61',
  label: '#5F6368',
  labelFocus: '#20334F',
  text: '#20334F',
  placeholder: '#607591',
} as const;
