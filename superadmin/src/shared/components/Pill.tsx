import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { pills, radius } from '../../theme/tokens';
import { statusTone } from '../../core/domain/status';

/** APK `.pill` status badge; colour comes from the APK status rules. */
export function Pill({ label }: { label: string }) {
  const tone = pills[statusTone(label)];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]} accessibilityLabel={'Status: ' + label}>
      <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, alignSelf: 'flex-start' },
  text: { fontSize: 10, fontWeight: '700', lineHeight: 13, letterSpacing: 0.05 },
});
