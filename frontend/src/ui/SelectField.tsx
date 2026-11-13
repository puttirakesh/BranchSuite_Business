import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Dropdown } from './Dropdown';
import { formSpacing } from '../shared/theme/formSpacing';

type Option = { value: string; label: string };

/**
 * Form select. It delegates to Dropdown on every platform so the option list always overlays
 * the form (an inline list would push the fields below it and can be clipped by scroll panels).
 */
export function SelectField({ label, value, options, onChange, disabled = false, searchable = true, hideScrollbar = false, labelInside = false }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean; searchable?: boolean; hideScrollbar?: boolean; labelInside?: boolean }) {
  const selected = options.find(option => option.value === value);
  const unavailable = !disabled && !!value && !selected;
  return <View style={s.field}>
    <Dropdown label={label} labelInside={labelInside} value={value} options={options} onChange={onChange} disabled={disabled} invalid={unavailable} searchable={searchable} hideScrollbar={hideScrollbar} />
    {unavailable && <Text accessibilityRole="alert" style={s.error}>This option is no longer available. Choose another.</Text>}
  </View>;
}

const s = StyleSheet.create({
  field: { width: '100%', minWidth: 0, gap: formSpacing.label, marginVertical: 4 },
  error: { fontSize: 12, lineHeight: 18, color: '#B94D61' },
});
