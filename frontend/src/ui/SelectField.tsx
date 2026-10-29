import React, { useContext, useEffect, useState } from 'react';
import { NeutralInputContext } from './InputInteractionContext';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { Dropdown } from './Dropdown';
import { formSpacing } from '../shared/theme/formSpacing';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';

type Option = { value: string; label: string };
export function SelectField({ label, value, options, onChange, disabled = false, searchable = true, hideScrollbar = false, labelInside = false }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean; searchable?: boolean; hideScrollbar?: boolean; labelInside?: boolean }) {
  const neutral = useContext(NeutralInputContext);
  const [open, setOpen] = useState(false);
  const optionsKey = JSON.stringify(options);
  useEffect(() => { setOpen(false); }, [disabled, value, optionsKey]);
  const selected = options.find(option => option.value === value);
  const unavailable = !disabled && !!value && !selected;
  // Use the same portal and keyboard navigation as the other web selectors.
  // An inline option list would move the form and can be clipped by its scroll panel.
  if (Platform.OS === 'web') return <View style={s.field}>
    <Dropdown label={label} labelInside={labelInside} value={value} options={options} onChange={onChange} disabled={disabled} invalid={unavailable} searchable={searchable} hideScrollbar={hideScrollbar} />
    {unavailable && <Text accessibilityRole="alert" style={s.error}>This option is no longer available. Choose another.</Text>}
  </View>;
  return <View style={s.field}>
    {!labelInside && <Text style={s.label}>{label}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected?.label ?? 'Select an option' }} accessibilityState={{ expanded: open && !disabled, disabled }} aria-expanded={open && !disabled} aria-invalid={unavailable} disabled={disabled} onAccessibilityEscape={() => setOpen(false)} onPress={() => { Keyboard.dismiss(); setOpen(!open); }} style={({ pressed }) => [s.control, labelInside && s.controlWithLabel, disabled && s.disabled, pressed && !neutral && s.pressed]}>
      {labelInside ? <View style={s.insideCopy}><Text numberOfLines={1} style={s.insideLabel}>{label}</Text><Text numberOfLines={1} style={s.value}>{selected?.label ?? 'Select an option'}</Text></View> : <Text style={s.value}>{selected?.label ?? 'Select an option'}</Text>}<AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#607591" />
    </Pressable>
    {open && !disabled && <View style={s.options}>
      <ScrollView style={s.list} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.value === value }} disabled={disabled} onPress={() => { if (disabled || !options.some(current => current.value === option.value)) return; Keyboard.dismiss(); if (option.value !== value) onChange(option.value); setOpen(false); }} style={({ pressed }) => [s.option, option.value === value && s.selected, pressed && !neutral && s.pressed]}><Text style={s.value}>{option.label}</Text>{option.value === value && <AppIcon name="check" size={18} color="#00857d" />}</Pressable>)}
        {!options.length && <Text style={s.empty}>No options available.</Text>}
      </ScrollView>
    </View>}
    {unavailable && <Text accessibilityRole="alert" style={s.error}>This option is no longer available. Choose another.</Text>}
  </View>;
}
const web = Platform.OS === 'web';
const s = webWorkspaceStyles(StyleSheet.create({
  field: { width: '100%', minWidth: 0, gap: formSpacing.label, marginVertical: 4 }, label: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: '#405573' },
  control: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#dce3e7', borderRadius: web ? webWorkspaceTheme.radiusControl : 6, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlWithLabel: { minHeight: 54, paddingVertical: 5 }, insideCopy: { flex: 1, minWidth: 0, justifyContent: 'center' }, insideLabel: { fontSize: 10, lineHeight: 13, color: '#607591' },
  value: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, color: '#20334f' },
  options: { borderWidth: 1, borderColor: '#dce3e7', borderRadius: web ? webWorkspaceTheme.radiusControl : 10, padding: 6, backgroundColor: '#fff' }, list: { maxHeight: 260 },
  option: { minHeight: 48, padding: 12, borderRadius: web ? webWorkspaceTheme.radiusControl : 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, selected: { backgroundColor: '#eaf0ff' },
  pressed: { backgroundColor: web ? webWorkspaceTheme.hover : '#eef4f6' }, disabled: { opacity: 0.5 }, empty: { padding: 12, fontSize: 13, color: '#607591' },
  error: { fontSize: 12, lineHeight: 18, color: '#B94D61' },
}));
