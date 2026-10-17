import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  loading: boolean;
  error: string;
  empty: boolean;
  onRetry: () => void;
};

export function BranchOptionsStatus({ loading, error, empty, onRetry }: Props) {
  if (loading) {
    return <View style={styles.row}><ActivityIndicator accessibilityLabel="Loading branches" color="#345cf2" /><Text style={styles.message}>Loading branches...</Text></View>;
  }
  if (error) {
    return <View style={styles.container}><Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry loading branches" onPress={onRetry} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View>;
  }
  if (empty) {
    return <Text accessibilityLiveRegion="polite" style={[styles.container, styles.message]}>No available branches.</Text>;
  }
  return null;
}

const styles = StyleSheet.create({
  container: { paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  message: { color: '#607591', fontSize: 13 },
  error: { color: '#b94d61', fontSize: 13 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  link: { color: '#345cf2', fontSize: 13, fontWeight: '600' },
});
