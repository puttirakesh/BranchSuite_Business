import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ToastModal as Modal } from './Toast';
import { AppIcon } from './AppIcon';
import { SearchField } from './SearchField';
import { useDesktopStyles } from './useDesktopStyles';
import { RESPONSIVE_BREAKPOINTS } from './responsiveBreakpoints';
import { colors } from '../shared/theme/colors';
import type { WorkspaceDestination } from './workspace-navigation';

export function WorkspaceSearchDialog({ visible, query, onChangeQuery, results, onSelect, onClose }: {
  visible: boolean;
  query: string;
  onChangeQuery: (value: string) => void;
  results: WorkspaceDestination[];
  onSelect: (destination: WorkspaceDestination) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < RESPONSIVE_BREAKPOINTS.tablet;
  const desktop = Platform.OS === 'web' && width >= RESPONSIVE_BREAKPOINTS.desktop;
  const styles = useDesktopStyles(baseStyles);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.overlay, narrow && styles.overlayBottom]}>
      <View testID="workspace-search-sheet" accessibilityViewIsModal style={[styles.sheet, narrow && styles.bottomSheet]}>
        <View style={styles.headingRow}>
          <Text accessibilityRole="header" style={[styles.heading, (narrow || desktop) && { fontSize: 19, lineHeight: 25 }]}>Search a module</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <AppIcon name="x" size={28} color={colors.text} />
          </Pressable>
        </View>
        <SearchField value={query} onChangeText={onChangeQuery} autoFocus accessibilityLabel="Search modules" />
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.options}>
          {results.map(item => <Pressable key={item.href} testID="workspace-search-result" accessibilityRole="button"
            accessibilityLabel={item.label} onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.option, desktop && styles.desktopOption, pressed && styles.pressed]}>
            <AppIcon name={item.icon} style={styles.optionIcon} />
            <View style={styles.body}>
              <Text style={[styles.optionName, (narrow || desktop) && { fontSize: 14, lineHeight: 20 }]}>{item.label}</Text>
              <Text style={[styles.helper, styles.resultGroup]}>{item.group}</Text>
            </View>
            <AppIcon name="chevron-right" size={18} color="#62758b" />
          </Pressable>)}
          {!results.length && <Text accessibilityLiveRegion="polite" style={styles.helper}>No matching modules</Text>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const baseStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(21,36,60,0.33)', padding: 22 },
  overlayBottom: { justifyContent: 'flex-end', padding: 0 },
  sheet: { backgroundColor: '#fff', borderRadius: 25, width: '100%', maxWidth: 580, maxHeight: '85%', padding: 22 },
  bottomSheet: { maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '83%', padding: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#172c43', flex: 1 },
  close: { width: 44, height: 44, backgroundColor: '#f4f6fb', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  scroll: { minHeight: 0 },
  options: { gap: 8, paddingBottom: 12 },
  option: { minHeight: 56, borderWidth: 1, borderColor: '#e0e6ef', borderRadius: 12, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  desktopOption: { minHeight: 52, padding: 8, borderRadius: 10 },
  optionIcon: { minWidth: 32, height: 32, textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.primaryLight, borderRadius: 9, fontSize: 17, color: colors.primaryDark, overflow: 'hidden' },
  body: { flex: 1, minWidth: 0 },
  optionName: { fontSize: 14, fontWeight: '700', color: colors.text },
  resultGroup: { marginBottom: 0 },
  helper: { color: '#778596', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  pressed: { backgroundColor: colors.primaryLight },
});
