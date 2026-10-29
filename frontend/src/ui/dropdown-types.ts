import type { StyleProp, ViewStyle } from 'react-native';

export type DropdownOption = { value: string; label: string };

export type DropdownProps = {
  /** Small caption shown above the selected value, also the accessibility label. */
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Shown inside the open menu when there are no options. */
  emptyText?: string;
  /** Render the native option list above the screen instead of in the page layout. */
  overlayMenu?: boolean;
  /** Show a search box for long lists (default true). */
  searchable?: boolean;
  /** Hide the option list's scroll bar; the list still scrolls. */
  hideScrollbar?: boolean;
  /** Keep header selectors visually neutral while they are hovered, focused, or open. */
  quiet?: boolean;
  /** Place the caption inside the control above its selected value. */
  labelInside?: boolean;
  /** Hide the caption and show only the selection or placeholder in compact header selectors. */
  valueOnly?: boolean;
  controlId?: string;
  style?: StyleProp<ViewStyle>;
};
