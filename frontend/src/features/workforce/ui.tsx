import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { WorkforceError } from './api';
import { useWorkforceSession } from './session';
import { Session } from './types';
import { router } from 'expo-router';

export function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (disabled || pressed) && { opacity: 0.55 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.employee }]}>{title}</Text>
  </Pressable>;
}
export function State({ title, message, retry, busy = false }: { title: string; message?: string; retry?: () => void; busy?: boolean }) {
  return <View style={styles.state} accessibilityLiveRegion="polite">
    {busy && <ActivityIndicator size="large" color={colors.employee} />}
    <Text style={styles.heading}>{title}</Text>
    {message && <Text style={styles.description}>{message}</Text>}
    {retry && <Button title="Retry" onPress={retry} secondary />}
  </View>;
}
export function ErrorState({ error, retry }: { error: WorkforceError; retry: () => void }) {
  if (error.kind === 'auth') return <View style={styles.state}><State title="Sign in required" message={error.message} /><Button title="Sign in" onPress={() => router.replace('/login')} /></View>;
  return <State title={error.kind === 'offline' ? 'You may be offline' : error.kind === 'forbidden' ? 'Access restricted' : 'Unable to complete request'}
    message={error.message} retry={retry} />;
}
export function SessionGate({ children }: { children: (session: Session) => ReactNode }) {
  const { session, loading, error, reload } = useWorkforceSession();
  if (loading) return <State title="Loading session" busy />;
  if (error) return <View style={styles.state}><State title="Session unavailable" message={error} retry={reload} /><Button title="Sign in" onPress={() => router.replace('/login')} /></View>;
  if (!session) return <View style={styles.state}><State title="Sign in to continue" message="Sign in and select a business branch to access workforce records." /><Button title="Sign in" onPress={() => router.replace('/login')} /></View>;
  return <>{children(session)}</>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  heading: { fontSize: 23, fontWeight: '700', color: colors.text },
  description: { fontSize: 15, lineHeight: 23, color: colors.secondaryText },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.employee, textTransform: 'uppercase', letterSpacing: 1 },
  card: { padding: 18, gap: 8, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 17, color: colors.text, fontWeight: '600' },
  badge: { color: colors.employee, fontSize: 12, fontWeight: '700', backgroundColor: colors.successTint, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  button: { backgroundColor: colors.employee, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, alignItems: 'center', minHeight: 46 },
  secondaryButton: { backgroundColor: colors.successTint },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  state: { padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, fontSize: 16, color: colors.text, minHeight: 48 },
  field: { gap: 8 },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  error: { color: '#AC2929', fontSize: 14 },
  choice: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' },
  chosen: { borderColor: colors.employee, backgroundColor: colors.successTint },
});
