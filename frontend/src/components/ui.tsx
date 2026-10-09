import type { PropsWithChildren, ReactNode, Ref } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../constants/colors';

export function Button({ title, onPress, onPressIn, disabled = false, busy = false, variant = 'primary' }: {
  title: string; onPress: () => void; onPressIn?: () => void; disabled?: boolean; busy?: boolean; variant?: 'primary' | 'secondary' | 'danger';
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} onPressIn={onPressIn}
    style={({ pressed }) => [styles.button, variant === 'secondary' ? styles.secondary : variant === 'danger' ? styles.danger : styles.primary, (disabled || busy || pressed) && { opacity: 0.55 }]}>
    {busy && <ActivityIndicator color={variant === 'secondary' ? colors.business : '#FFF'} />}
    <Text style={[styles.buttonLabel, variant === 'secondary' && { color: colors.business }]}>{title}</Text>
  </Pressable>;
}
export function Field({ label, error, rightAccessory, ref, ...props }: TextInputProps & { label: string; error?: string; rightAccessory?: ReactNode; ref?: Ref<TextInput> }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={{ position: 'relative' }}><TextInput accessibilityLabel={label} accessibilityHint={error || props.accessibilityHint} placeholderTextColor="#7B889C"
    {...props} ref={ref} style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, rightAccessory != null && { paddingRight: 56 }, error && { borderColor: '#B42318' }, props.style]} />
    {rightAccessory != null && <View style={{ position: 'absolute', right: 3, top: 2, bottom: 2, justifyContent: 'center' }}>{rightAccessory}</View>}</View>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</View>;
}
export function Card({ children }: PropsWithChildren) { return <View style={styles.card}>{children}</View>; }
export function Badge({ value }: { value: string }) {
  const good = ['WON', 'ACCEPTED', 'ACTIVE', 'QUALIFIED', 'CONVERTED'].includes(value);
  const bad = ['LOST', 'REJECTED', 'INACTIVE', 'EXPIRED'].includes(value);
  return <View style={[styles.badge, { backgroundColor: good ? '#E2F4EC' : bad ? '#FDEBEC' : '#EDF1F8' }]}><Text style={{ color: good ? '#13704B' : bad ? '#A6343A' : '#52637A', fontSize: 11, fontWeight: '700' }}>{humanize(value)}</Text></View>;
}
export function StateView({ title, message, loading, action, onAction }: { title: string; message?: string; loading?: boolean; action?: string; onAction?: () => void }) {
  return <View style={styles.state}>{loading && <ActivityIndicator size="large" color={colors.business} />}<Text style={styles.heading}>{title}</Text>
    {message && <Text style={styles.muted}>{message}</Text>}{action && onAction && <Button title={action} onPress={onAction} variant="secondary" />}</View>;
}
export function ErrorNotice({ message }: { message: string }) { return <Text accessibilityRole="alert" style={styles.notice}>{message}</Text>; }
export function Sheet({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.sheet}>
    <View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>{title}</Text><Button title="Close" onPress={onClose} variant="secondary" /></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>{children}</ScrollView>
  </View></View></Modal>;
}
export function humanize(value: string) { return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }
export function money(value: number, currency = 'INR') {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, gap: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text }, heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { color: colors.secondaryText, fontSize: 14, lineHeight: 22 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { padding: 20, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFF', gap: 12 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  primary: { backgroundColor: colors.business }, secondary: { backgroundColor: colors.cardTint }, danger: { backgroundColor: '#B42318' },
  buttonLabel: { color: '#FFF', fontWeight: '600', fontSize: 14, flexShrink: 1 }, field: { gap: 7 }, label: { color: colors.text, fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#FFF', padding: 13, fontSize: 15, color: colors.text, minHeight: 48 },
  error: { color: '#B42318', fontSize: 13 }, notice: { padding: 14, backgroundColor: '#FFF0ED', borderRadius: 10, color: '#A23224', lineHeight: 21 },
  state: { padding: 32, gap: 16, alignItems: 'center', justifyContent: 'center', flex: 1 }, badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
  overlay: { flex: 1, backgroundColor: '#14243C99', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { maxWidth: 600, width: '100%', maxHeight: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, gap: 20 },
});
