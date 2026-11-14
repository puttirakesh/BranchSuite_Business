import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ToastModal } from './Toast';
import { Dropdown } from './Dropdown';
import { AppIcon } from './AppIcon';

export function formatTime12(value: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return '';
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
export function time24(hour: string, minute: string, period: string): string {
  return `${String(Number(hour) % 12 + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${minute}`;
}

/** AM/PM selection on screen; the API continues to receive business-time HH:mm. */
export function TimePickerField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState('9'), [minute, setMinute] = useState('00'), [period, setPeriod] = useState('AM');
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const show = () => {
    const [h, m] = (value || '09:00').split(':');
    setHour(String(Number(h) % 12 || 12)); setMinute(m); setPeriod(Number(h) >= 12 ? 'PM' : 'AM'); setOpen(true);
  };
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: formatTime12(value) || 'Not set' }} disabled={disabled} onPress={show} style={[s.control, disabled && s.disabled]}>
      <Text style={[s.value, !value && s.placeholder]}>{formatTime12(value) || 'Select time'}</Text><AppIcon name="clock" size={17} color="#607591" />
    </Pressable>
    <ToastModal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={s.overlay}><View style={s.sheet}>
        <Text accessibilityRole="header" style={s.title}>{label}</Text>
        <View style={s.row}>
          <Dropdown style={s.cell} label="Hour" value={hour} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} onChange={setHour} searchable={false} />
          <Dropdown style={s.cell} label="Minute" value={minute} options={Array.from({ length: 60 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i).padStart(2, '0') }))} onChange={setMinute} searchable={false} />
          <Dropdown style={s.cell} label="AM / PM" value={period} options={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]} onChange={setPeriod} searchable={false} />
        </View>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label.toLowerCase()}`} onPress={() => { onChange(''); setOpen(false); }} style={s.button}><Text>Clear</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${label.toLowerCase()}`} onPress={() => setOpen(false)} style={s.button}><Text>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Set ${label.toLowerCase()}`} onPress={() => { onChange(time24(hour, minute, period)); setOpen(false); }} style={[s.button, s.primary]}><Text style={s.primaryText}>Set time</Text></Pressable>
        </View>
      </View></View>
    </ToastModal>
  </View>;
}
const s = StyleSheet.create({
  field: { gap: 8 }, label: { fontSize: 12, color: '#405573', lineHeight: 18 },
  control: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce3e7', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff' },
  value: { flex: 1, color: '#20334f', fontSize: 14 }, placeholder: { color: '#607591' }, disabled: { opacity: 0.5 },
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(21,43,60,0.3)' },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 16, gap: 20, borderRadius: 18, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#20334f' },
  row: { flexDirection: 'row', gap: 8 }, cell: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10 },
  primary: { backgroundColor: '#345cf2' }, primaryText: { color: '#fff', fontWeight: '600' },
});
