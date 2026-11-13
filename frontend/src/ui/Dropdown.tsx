import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { AppIcon } from './AppIcon';
import type { DropdownProps } from './dropdown-types';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';
import { inputTokens } from '../shared/theme/inputTokens';

export type { DropdownOption, DropdownProps } from './dropdown-types';

/**
 * Native dropdown. The option list opens directly beneath the field, floating above the page (a
 * transparent Modal) so it never pushes or resizes the layout and scrolling parents cannot clip it.
 * It opens above the field only when there is no room below. Android hardware back or a tap outside
 * closes it.
 *
 * The field is measured in window coordinates and the Modal root is measured the same way; the menu is
 * placed by the difference, so status-bar, edge-to-edge and translucent-bar offsets cancel out.
 * The web build uses Dropdown.web.tsx, which portals an anchored list the same way.
 */
export function Dropdown({ label, value, options, onChange, placeholder = 'Select an option', disabled = false, invalid = false, emptyText = 'No options available.', quiet = false, labelInside = false, valueOnly = false, controlId, style }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [root, setRoot] = useState<{ x: number; y: number; height: number } | null>(null);
  const controlRef = useRef<ViewInstance>(null);
  const rootRef = useRef<ViewInstance>(null);
  const optionsKey = JSON.stringify(options);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled, optionsKey]);
  const selected = options.find(option => option.value === value);
  const hasBranchChoices = options.some(option => option.value !== '' && option.value !== 'ALL');
  const displayed = valueOnly && !hasBranchChoices ? undefined : selected;
  const openMenu = () => {
    controlRef.current?.measureInWindow((x, y, width, height) => {
      setRoot(null);
      setField({ x, y, width, height });
      setOpen(true);
    });
  };
  const closeMenu = () => setOpen(false);
  const measureRoot = () => rootRef.current?.measureInWindow((x, y, _width, height) => setRoot({ x, y, height }));

  let menuStyle: { left: number; width: number; maxHeight: number; top?: number; bottom?: number } | undefined;
  if (field && root) {
    const left = Math.max(8, field.x - root.x);
    const fieldTop = field.y - root.y;
    const below = root.height - (fieldTop + field.height) - 12;
    const above = fieldTop - 12;
    const wanted = Math.min(280, Math.max(options.length, 1) * 48 + 14);
    const flip = below < Math.min(wanted, 160) && above > below;
    const maxHeight = Math.max(120, Math.min(280, flip ? above : below));
    menuStyle = { left, width: field.width, maxHeight, ...(flip ? { bottom: root.height - fieldTop + 4 } : { top: fieldTop + field.height + 4 }) };
  }
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
      <Modal visible={open && !disabled && !!field} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeMenu}>
        <View ref={rootRef} collapsable={false} onLayout={measureRoot} style={s.overlayRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={closeMenu} style={StyleSheet.absoluteFill} />
          {!!menuStyle && <View style={[s.menu, s.overlayMenu, menuStyle]}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
  overlayRoot: { flex: 1 },
  menu: { borderRadius: 14, borderWidth: 1, borderColor: '#e3e9f2', backgroundColor: '#fff', overflow: 'hidden', padding: 6 },
  overlayMenu: { position: 'absolute', elevation: 24, shadowColor: '#101d35', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  option: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, marginVertical: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optionSelected: { backgroundColor: '#f0f4ff' },
  optionText: { flex: 1, fontSize: 14, color: '#20334f' },
  optionTextSelected: { color: '#345cf2', fontWeight: '700' },
  empty: { padding: 12, fontSize: 13, color: '#607591' },
}));
