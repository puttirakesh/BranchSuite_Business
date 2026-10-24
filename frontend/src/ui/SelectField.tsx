import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { SearchField } from './SearchField';
import { formSpacing } from '../shared/theme/formSpacing';

type Option = { value: string; label: string };
export function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const optionsKey = JSON.stringify(options);
  useEffect(() => { setOpen(false); setQuery(''); }, [disabled, value, optionsKey]);
  const selected = options.find(option => option.value === value);
  const unavailable = !disabled && !!value && !selected;
  const visible = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected?.label ?? 'No selection' }} accessibilityState={{ expanded: open && !disabled, disabled }} aria-expanded={open && !disabled} aria-invalid={unavailable} disabled={disabled} onAccessibilityEscape={() => setOpen(false)} onPress={() => { Keyboard.dismiss(); setOpen(!open); setQuery(''); }} style={({ pressed }) => [s.control, disabled && s.disabled, pressed && s.pressed]}>
      <Text style={s.value}>{selected?.label ?? ''}</Text><AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#607591" />
    </Pressable>
    {open && !disabled && <View style={s.options}>
      {options.length > 6 && <SearchField accessibilityLabel={`Search ${label.toLowerCase()} options`} value={query} onChangeText={setQuery} />}
      <ScrollView style={s.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {visible.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.value === value }} disabled={disabled} onPress={() => { if (disabled || !options.some(current => current.value === option.value)) return; Keyboard.dismiss(); if (option.value !== value) onChange(option.value); setOpen(false); setQuery(''); }} style={({ pressed }) => [s.option, option.value === value && s.selected, pressed && s.pressed]}><Text style={s.value}>{option.label}</Text>{option.value === value && <AppIcon name="check" size={18} color="#00857d" />}</Pressable>)}
        {!visible.length && <Text style={s.empty}>No matching options.</Text>}
      </ScrollView>
    </View>}
    {unavailable && <Text accessibilityRole="alert" style={s.error}>This option is no longer available. Choose another.</Text>}
  </View>;
}
const s = StyleSheet.create({
  field: { width: '100%', minWidth: 0, gap: formSpacing.label, marginVertical: 4 }, label: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: '#405573' },
  control: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#dce3e7', borderRadius: 6, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, color: '#20334f' },
  options: { borderWidth: 1, borderColor: '#dce3e7', borderRadius: 10, padding: 6, backgroundColor: '#fff' }, list: { maxHeight: 260 },
  option: { minHeight: 48, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, selected: { backgroundColor: '#eaf0ff' },
  pressed: { backgroundColor: '#eef4f6' }, disabled: { opacity: 0.5 }, empty: { padding: 12, fontSize: 13, color: '#607591' },
  error: { fontSize: 12, lineHeight: 18, color: '#B94D61' },
});
