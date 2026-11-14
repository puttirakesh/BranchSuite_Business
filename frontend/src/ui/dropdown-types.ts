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
  /** Deprecated no-op: the option list always overlays the screen so it never moves the page layout. */
  overlayMenu?: boolean;
  /** Show a search box for long lists (default true). */
  searchable?: boolean;
  /** Deprecated: option scrollbars are always hidden; long lists still scroll. */
  hideScrollbar?: boolean;
  /** Deprecated no-op: dropdown borders and surfaces stay neutral while open. */
  quiet?: boolean;
  /** Place the caption inside the control above its selected value. */
  labelInside?: boolean;
  /** Hide the caption and show only the selection or placeholder in compact header selectors. */
  valueOnly?: boolean;
  controlId?: string;
  style?: StyleProp<ViewStyle>;
};
