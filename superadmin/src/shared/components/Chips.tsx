import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/tokens';

/** Horizontal filter chips (APK `.portal-segments` style). Scrolls on narrow screens. */
export function Chips<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel={label} style={styles.scroll}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(option)} style={[styles.chip, on ? styles.on : null]}>
            <Text style={[styles.text, on ? styles.textOn : null]}>{option}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: 16, flexGrow: 0 },
  row: { gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface },
  on: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  text: { fontSize: 13, fontWeight: '600', color: colors.muted },
  textOn: { color: colors.primary, fontWeight: '700' },
});
