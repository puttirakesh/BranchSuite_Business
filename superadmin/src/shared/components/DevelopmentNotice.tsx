import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { env } from '../../core/config/env';

/**
 * Thin banner shown under the top bar whenever the app is not using live data,
 * so sample or missing data is never mistaken for real customer records.
 */
export function DevelopmentNotice() {
  if (env.dataMode === 'api') return null;
  const text =
    env.dataMode === 'preview'
      ? 'Preview data · sample records from the reference APK, not real customers'
      : 'No backend connected · set EXPO_PUBLIC_API_URL to load live records';
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#FFF4E3', paddingVertical: 6, paddingHorizontal: 16 },
  text: { fontSize: 11, color: '#8A6228', textAlign: 'center', fontWeight: '600' },
});
