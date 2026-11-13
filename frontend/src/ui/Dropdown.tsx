import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import type { DropdownProps } from './dropdown-types';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';
import { inputTokens } from '../shared/theme/inputTokens';

export type { DropdownOption, DropdownProps } from './dropdown-types';

/**
 * Native dropdown. Choosing opens a bottom sheet in a Modal, so there is no coordinate maths to get
 * wrong (status bar, edge-to-edge, scrolling parents, keyboard): the page never moves, nothing is
 * clipped, options are full-width touch targets, and Android hardware back or a backdrop tap closes it.
 * The web build uses Dropdown.web.tsx, which portals an anchored list instead.
 */
export function Dropdown({ label, value, options, onChange, placeholder = 'Select an option', disabled = false, invalid = false, emptyText = 'No options available.', quiet = false, labelInside = false, valueOnly = false, controlId, style }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const optionsKey = JSON.stringify(options);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled, optionsKey]);
  const selected = options.find(option => option.value === value);
  const hasBranchChoices = options.some(option => option.value !== '' && option.value !== 'ALL');
  const displayed = valueOnly && !hasBranchChoices ? undefined : selected;
  const closeMenu = () => setOpen(false);
  const choose = (next: string) => { closeMenu(); if (next !== value) onChange(next); };
  return (
    <View style={[s.wrap, style]}>
      {!labelInside && !valueOnly && <Text style={s.label}>{label}</Text>}
      <Pressable
        nativeID={controlId}
        accessibilityRole="button"
        aria-invalid={invalid}
        aria-expanded={open}
        accessibilityLabel={label}
        accessibilityValue={{ text: displayed?.label ?? placeholder }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => { Keyboard.dismiss(); setOpen(true); }}
        style={[s.control, labelInside && !valueOnly && s.controlWithLabel, open && !quiet && s.controlOpen, invalid && { borderColor: '#B94D61' }, disabled && s.disabled]}
      >
        {labelInside && !valueOnly ? <View style={s.insideCopy}><Text numberOfLines={1} style={s.insideLabel}>{label}</Text><Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text></View> : <Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text>}
        <AppIcon name="chevron-down" size={16} color="#607591" />
      </Pressable>
      <Modal visible={open && !disabled} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={closeMenu}>
        <View style={s.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={closeMenu} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={[s.sheet, { maxHeight: Math.round(height * 0.7), paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={s.grabber} />
            <View style={s.sheetHeader}>
              <Text accessibilityRole="header" numberOfLines={1} style={s.sheetTitle}>{label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeMenu} hitSlop={8} style={s.close}><AppIcon name="x" size={18} color="#405573" /></Pressable>
            </View>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {options.length === 0 ? <Text style={s.empty}>{emptyText}</Text> : null}
              {options.map(option => {
                const isSelected = option.value === value;
                return (
                  <Pressable key={option.value || '__empty'} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: isSelected }} onPress={() => choose(option.value)} style={({ pressed }) => [s.option, isSelected && s.optionSelected, pressed && s.optionPressed]}>
                    <Text numberOfLines={2} style={[s.optionText, isSelected && s.optionTextSelected]}>{option.label}</Text>
                    {isSelected ? <AppIcon name="check" size={18} color="#345cf2" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = webWorkspaceStyles(StyleSheet.create({
  wrap: { minWidth: 0, gap: 4 },
  control: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Platform.OS === 'web' ? webWorkspaceTheme.radiusControl : 6, borderWidth: 1, borderColor: '#dce3e7', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlWithLabel: { minHeight: 54, paddingVertical: 5 }, insideCopy: { flex: 1, minWidth: 0, justifyContent: 'center' }, insideLabel: { fontSize: 10, lineHeight: 13, color: '#607591' },
  controlOpen: { backgroundColor: inputTokens.surfaceFocused },
  disabled: { opacity: 0.5 },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: '#405573' },
  value: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, color: '#20334f' },
  placeholder: { color: '#607591' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(21,36,60,0.35)' },
  sheet: { width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 12, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#d5dce8', marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 6, paddingBottom: 6 },
  sheetTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', color: '#20334f' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  option: { minHeight: 52, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optionSelected: { backgroundColor: '#f0f4ff' },
  optionPressed: { backgroundColor: '#f1f5f9' },
  optionText: { flex: 1, fontSize: 15, color: '#20334f' },
  optionTextSelected: { color: '#345cf2', fontWeight: '700' },
  empty: { padding: 12, fontSize: 13, color: '#607591' },
}));
