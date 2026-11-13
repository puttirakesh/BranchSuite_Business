import React from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

/** Pull-to-refresh control for list screens that no longer expose a manual Refresh button. */
export function pullToRefresh(refreshing: boolean, onRefresh: () => void) {
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;
}

/** Error banner with a Retry action so a failed load can always be recovered in place. */
export function RetryNotice({ message, onRetry, busy = false }: { message: string; onRetry: () => void; busy?: boolean }) {
  return <View accessibilityRole="alert" style={s.box}>
    <Text style={s.text}>{message}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Retry" disabled={busy} onPress={onRetry} style={[s.button, busy && s.disabled]}><Text style={s.buttonText}>{busy ? 'Retrying…' : 'Retry'}</Text></Pressable>
  </View>;
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#f3c9d2', backgroundColor: '#fcecf0' },
  text: { flex: 1, minWidth: 0, color: '#B94D61', fontSize: 13, lineHeight: 18 },
  button: { minHeight: 40, minWidth: 64, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#B94D61', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#B94D61', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
