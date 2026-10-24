import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function AttendanceAction({ label, onPress, secondary = false, danger = false, disabled = false, loading = false }: {
  label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; loading?: boolean;
}) {
  const blocked = disabled || loading;
  const color = danger ? '#A33148' : secondary ? '#345CF2' : '#FFFFFF';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: blocked, busy: loading }} aria-busy={loading}
    disabled={blocked} onPress={onPress} style={({ pressed }) => [attendanceUI.action, secondary && attendanceUI.secondaryAction, danger && attendanceUI.dangerAction, (pressed || blocked) && { opacity: 0.6 }]}>
    {loading && <ActivityIndicator size="small" color={color} />}
    <Text style={[attendanceUI.actionText, { color }]}>{label}</Text>
  </Pressable>;
}

export function AttendanceTimes({ checkIn, checkOut, compact = false }: { checkIn: string; checkOut: string; compact?: boolean }) {
  return <View style={attendanceUI.timeRow}>
    {[{ label: 'Check-in', value: checkIn }, { label: 'Check-out', value: checkOut }].map(item => <View key={item.label} style={attendanceUI.timeBox}>
      <Text style={attendanceUI.caption}>{item.label} (IST)</Text>
      <Text style={[attendanceUI.timeValue, compact && { fontSize: 15, lineHeight: 22 }]}>{item.value}</Text>
    </View>)}
  </View>;
}

export const attendanceUI = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, gap: 0 },
  section: { gap: 16 },
  sectionHeading: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#20334F' },
  caption: { fontSize: 11, lineHeight: 16, color: '#607591' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCell: { flexGrow: 1, flexShrink: 0, flexBasis: 150, minWidth: 150 },
  action: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, backgroundColor: '#345CF2', borderWidth: 1, borderColor: '#345CF2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  secondaryAction: { backgroundColor: '#FFFFFF', borderColor: '#D5DFF4' },
  dangerAction: { backgroundColor: '#FFFFFF', borderColor: '#E8CCD2' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeBox: { flex: 1, minWidth: 0, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E6EBF2', backgroundColor: '#F7F9FC', gap: 8 },
  timeValue: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#20334F' },
  divider: { borderTopWidth: 1, borderTopColor: '#E6EBF2', paddingTop: 16 },
  info: { padding: 12, borderRadius: 10, backgroundColor: '#F3F6FC', gap: 6 },
  success: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#CDE8DC', backgroundColor: '#EFF9F4' },
  error: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EED4D9', backgroundColor: '#FFF5F6' },
  empty: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 12, gap: 10 },
  emptyText: { fontSize: 12, lineHeight: 19, color: '#607591', textAlign: 'center' },
});
