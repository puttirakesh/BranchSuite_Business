import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { Icon } from './Icon';

/** APK `.search-box`: full-width input with a leading search icon. */
export function SearchBox({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon} pointerEvents="none"><Icon name="search" size={17} color={colors.subtle} /></View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18, justifyContent: 'center' },
  icon: { position: 'absolute', left: 14, zIndex: 1 },
  input: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#DCE4EE',
    borderRadius: radius.md,
    paddingLeft: 40,
    paddingRight: 14,
    fontSize: 16,
    color: colors.ink,
  },
});
