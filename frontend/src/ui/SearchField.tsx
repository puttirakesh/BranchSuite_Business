import React, { forwardRef } from 'react';
import { Platform, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { FloatingTextInput, type FloatingTextInputProps } from './FloatingTextInput';
import { AppIcon } from './AppIcon';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';

/** Consistent content search with a labelled field and a reachable clear action. */
export const SearchField = forwardRef<TextInput, FloatingTextInputProps>(function SearchField({ value = '', onChangeText, accessibilityLabel = 'Search', editable = true, style, ...props }, ref) {
  return <FloatingTextInput {...props} clearOnSubmit={false} validation={{ kind: 'search', maxLength: 100 }} ref={ref} label="Search" accessibilityLabel={accessibilityLabel} value={value} onChangeText={onChangeText} editable={editable}
    autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={[s.field, style]}
    trailingAccessory={value.length ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${accessibilityLabel.toLowerCase()}`} disabled={!editable} hitSlop={2} onPress={() => onChangeText?.('')} style={s.clear}><AppIcon name="x" size={18} color={web ? webWorkspaceTheme.muted : '#607591'} /></Pressable> : <View pointerEvents="none" style={s.clear}><AppIcon name="search" size={18} color={web ? webWorkspaceTheme.muted : '#607591'} /></View>} />;
});

const web = Platform.OS === 'web';
const s = webWorkspaceStyles(StyleSheet.create({
  field: { width: '100%', minWidth: 0, minHeight: 44, borderRadius: web ? webWorkspaceTheme.radiusControl : 6, borderWidth: 1, borderColor: '#dce3e7', backgroundColor: '#fff', fontSize: 13, marginVertical: 6 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));
