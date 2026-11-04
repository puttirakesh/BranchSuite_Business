import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { initials } from '../utils/format';

/** APK `.flow-avatar`: initials on lavender with a white ring. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.35 }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={[styles.text, { fontSize: size * 0.33 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: '#EEE7FD', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#E5EBF5', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
  text: { color: '#7553BD', fontWeight: '700' },
});
