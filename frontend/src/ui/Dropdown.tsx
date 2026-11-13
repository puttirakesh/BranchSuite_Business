import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { AppIcon } from './AppIcon';
import type { DropdownProps } from './dropdown-types';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';
import { inputTokens } from '../shared/theme/inputTokens';

export type { DropdownOption, DropdownProps } from './dropdown-types';

/**
 * Native dropdown: the option list always floats over the screen in a transparent Modal,
 * positioned from the control's window frame, so opening it never moves or resizes the page
 * layout and it cannot be clipped by scroll containers. Android hardware back closes it. It
 * opens above the control when there is not enough room below. The web build uses
 * Dropdown.web.tsx, which portals the list the same way.
 */
export function Dropdown({ label, value, options, onChange, placeholder = 'Select an option', disabled = false, invalid = false, emptyText = 'No options available.', quiet = false, labelInside = false, valueOnly = false, controlId, style }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuFrame, setMenuFrame] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const controlRef = useRef<ViewInstance>(null);
  const optionsKey = JSON.stringify(options);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled, optionsKey]);
  const selected = options.find(option => option.value === value);
  const hasBranchChoices = options.some(option => option.value !== '' && option.value !== 'ALL');
  const displayed = valueOnly && !hasBranchChoices ? undefined : selected;
  const openMenu = () => {
    controlRef.current?.measureInWindow((left, top, width, height) => {
      const screenHeight = Dimensions.get('window').height;
      const below = screenHeight - (top + height) - 18;
      const above = top - 18;
      const wanted = Math.min(280, Math.max(options.length, 1) * 44 + 2);
      const flip = below < Math.min(wanted, 160) && above > below;
      const maxHeight = Math.max(120, Math.min(280, flip ? above : below));
      setMenuFrame({ left, width, maxHeight, ...(flip ? { bottom: screenHeight - top + 6 } : { top: top + height + 6 }) });
      setOpen(true);
    });
  };
  const closeMenu = () => setOpen(false);
  return (
    <View style={[s.wrap, style]}>
      {!labelInside && !valueOnly && <Text style={s.label}>{label}</Text>}
      <Pressable
        ref={controlRef}
        nativeID={controlId}
        accessibilityRole="button"
        aria-invalid={invalid}
        aria-expanded={open}
        accessibilityLabel={label}
        accessibilityValue={{ text: displayed?.label ?? placeholder }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => { Keyboard.dismiss(); if (open) closeMenu(); else openMenu(); }}
        style={[s.control, labelInside && !valueOnly && s.controlWithLabel, open && !quiet && s.controlOpen, invalid && { borderColor: '#B94D61' }, disabled && s.disabled]}
      >
        {labelInside && !valueOnly ? <View style={s.insideCopy}><Text numberOfLines={1} style={s.insideLabel}>{label}</Text><Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text></View> : <Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text>}
        <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#607591" />
      </Pressable>
      <Modal visible={open && !disabled && !!menuFrame} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeMenu}>
          <View style={s.overlayRoot}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={closeMenu} style={StyleSheet.absoluteFill} />
            {!!menuFrame && <View style={[s.menu, s.overlayMenu, { left: menuFrame.left, top: menuFrame.top, bottom: menuFrame.bottom, width: menuFrame.width, maxHeight: menuFrame.maxHeight }]}>
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={s.list}>
                {options.length === 0 ? <Text style={s.empty}>{emptyText}</Text> : null}
                {options.map(option => {
                  const isSelected = option.value === value;
                  return <Pressable key={option.value || '__empty'} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: isSelected }} onPress={() => { closeMenu(); if (!isSelected) onChange(option.value); }} style={[s.option, isSelected && s.optionSelected]}>
                    <Text numberOfLines={1} style={[s.optionText, isSelected && s.optionTextSelected]}>{option.label}</Text>
                    {isSelected ? <AppIcon name="check" size={15} color="#345cf2" /> : null}
                  </Pressable>;
                })}
              </ScrollView>
            </View>}
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
  menu: { marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: '#d7e0ea', backgroundColor: '#fff', overflow: 'hidden' },
  overlayRoot: { flex: 1 },
  overlayMenu: { position: 'absolute', marginTop: 0, elevation: 24, shadowColor: '#172b4d', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  list: { maxHeight: 280 },
  option: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optionSelected: { backgroundColor: '#f0f4ff' },
  optionText: { flex: 1, fontSize: 13, color: '#20334f' },
  optionTextSelected: { color: '#345cf2', fontWeight: '700' },
  empty: { padding: 12, fontSize: 13, color: '#607591' },
}));
