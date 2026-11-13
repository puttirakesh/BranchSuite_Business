import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Dropdown } from './Dropdown';

/** Compact filter row: every child shares the width equally and may shrink, so nothing clips on phones. */
export function FilterRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, style]}>{React.Children.toArray(children).map((child, index) => <View key={index} style={s.cell}>{child}</View>)}</View>;
}

export const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Shared status selector. Values are the backend enum names (PENDING, APPROVED, ...), ALL means no filter. */
export function StatusFilterDropdown({ value, onChange, options = STATUS_FILTER_OPTIONS, label = 'Status', style, disabled }: {
  value: string; onChange: (value: string) => void; options?: { value: string; label: string }[]; label?: string; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  return <Dropdown labelInside label={label} value={value} options={options} onChange={onChange} disabled={disabled} style={style} />;
}

const s = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cell: { flex: 1, minWidth: 0 },
});
