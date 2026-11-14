import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from 'react-native';
import { PopoverPortal } from './PopoverHost';
import { FloatingTextInput } from './FloatingTextInput';
import { AppIcon } from './AppIcon';
import type { DropdownProps } from './dropdown-types';
import { webWorkspaceStyles } from './webWorkspaceStyles';
import { dropdownPlacement } from './dropdown-placement';
import { dropdownTokens } from './dropdown-tokens';
import { useDeviceAccent } from '../shared/theme/DeviceAccentProvider';

export type { DropdownOption, DropdownProps } from './dropdown-types';

/**
 * Native dropdown. The option list opens directly beneath the field, floating above the page (a
 * same-window portal) so it never pushes the layout and scrolling parents cannot clip it.
 * Android hardware back or a tap outside closes it.
 *
 * Both the field and overlay are measured in the same native window. In particular,
 * opening a dropdown never creates a second Android dialog with a different coordinate origin.
 * The web build uses Dropdown.web.tsx, which portals an anchored list the same way.
 */
export function Dropdown({ label, value, options, onChange, placeholder = 'Select an option', disabled = false, invalid = false, emptyText = 'No options available.', searchable = true, labelInside = false, valueOnly = false, controlId, style }: DropdownProps) {
  const { palette } = useDeviceAccent();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [root, setRoot] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [query, setQuery] = useState('');
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  useEffect(() => { setOpen(false); setQuery(''); }, [windowWidth]);
  const showSearch = searchable && options.length > 8;
  const filtered = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const controlRef = useRef<ViewInstance>(null);
  const rootRef = useRef<ViewInstance>(null);
  const optionsKey = JSON.stringify(options);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled, optionsKey]);
  const selected = options.find(option => option.value === value);
  const hasBranchChoices = options.some(option => option.value !== '' && option.value !== 'ALL');
  const displayed = valueOnly && !hasBranchChoices ? undefined : selected;
  const openMenu = () => {
    setQuery('');
    controlRef.current?.measureInWindow((x, y, width, height) => {
      setRoot(null);
      setField({ x, y, width, height });
      setOpen(true);
    });
  };
  const closeMenu = useCallback(() => setOpen(false), []);
  const measureRoot = () => rootRef.current?.measureInWindow((x, y, width, height) => {
    setRoot({ x, y, width, height });
    controlRef.current?.measureInWindow((fieldX, fieldY, fieldWidth, fieldHeight) => {
      setField({ x: fieldX, y: fieldY, width: fieldWidth, height: fieldHeight });
    });
  });

  useEffect(() => {
    if (!open) { setKeyboardTop(null); return; }
    const shown = Keyboard.addListener('keyboardDidShow', event => setKeyboardTop(event.endCoordinates.screenY));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => { shown.remove(); hidden.remove(); };
  }, [open]);

  let menuStyle: { left: number; width: number; maxHeight: number; top?: number; bottom?: number } | undefined;
  if (field && root) {
    const height = keyboardTop === null ? root.height : Math.max(0, Math.min(root.height, keyboardTop - root.y));
    menuStyle = dropdownPlacement({ ...field, x: field.x - root.x, y: field.y - root.y }, { width: root.width, height });
    if (menuStyle.bottom !== undefined) menuStyle.bottom += root.height - height;
  }
  return (
    <View style={[s.wrap, style]}>
      {!labelInside && !valueOnly && <Text style={s.label}>{label}</Text>}
      <Pressable
        ref={controlRef}
        nativeID={controlId}
        accessibilityRole="button"
        aria-haspopup="listbox"
        aria-invalid={invalid}
        aria-expanded={open}
        accessibilityLabel={label}
        accessibilityValue={{ text: displayed?.label ?? placeholder }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => { Keyboard.dismiss(); if (open) closeMenu(); else openMenu(); }}
        style={[s.control, labelInside && !valueOnly && s.controlWithLabel, invalid && { borderColor: '#B94D61' }, disabled && s.disabled]}
      >
        {labelInside && !valueOnly ? <View style={s.insideCopy}><Text numberOfLines={1} style={s.insideLabel}>{label}</Text><Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text></View> : <Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text>}
        <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#607591" />
      </Pressable>
      {open && !disabled && !!field && <PopoverPortal onDismiss={closeMenu}>
        <View ref={rootRef} collapsable={false} onLayout={measureRoot} style={s.overlayRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={closeMenu} style={StyleSheet.absoluteFill} />
          {!!menuStyle && <View style={[s.menu, s.overlayMenu, menuStyle]}>
            {showSearch && <FloatingTextInput accessibilityLabel={`Search ${label.toLocaleLowerCase()}`} label="Search options" value={query} onChangeText={setQuery} validation={{ kind: 'search' }} clearOnSubmit={false} autoCapitalize="none" autoCorrect={false} style={s.search} />}
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={s.list}>
              {filtered.length === 0 ? <Text style={s.empty}>{options.length ? 'No matching options.' : emptyText}</Text> : null}
              {filtered.map(option => {
                const isSelected = option.value === value;
                return <Pressable key={option.value || '__empty'} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: isSelected }} onPress={() => { closeMenu(); if (!isSelected) onChange(option.value); }} style={[s.option, isSelected && s.optionSelected, isSelected && { backgroundColor: palette.soft }]}>
                  <Text style={[s.optionText, isSelected && s.optionTextSelected, isSelected && { color: palette.color }]}>{option.label}</Text>
                  {isSelected ? <AppIcon name="check" size={15} color={palette.color} /> : null}
                </Pressable>;
              })}
            </ScrollView>
          </View>}
        </View>
      </PopoverPortal>}
    </View>
  );
}

const s = webWorkspaceStyles(StyleSheet.create({
  wrap: { minWidth: 0, gap: 4, marginBottom: dropdownTokens.fieldMarginBottom },
  control: { minHeight: 44, paddingHorizontal: dropdownTokens.fieldPaddingHorizontal, paddingVertical: dropdownTokens.fieldPaddingVertical, borderRadius: dropdownTokens.fieldRadius, borderWidth: 1, borderColor: '#dce3e7', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlWithLabel: { minHeight: 54, paddingVertical: 8 }, insideCopy: { flex: 1, minWidth: 0, justifyContent: 'center' }, insideLabel: { fontSize: 10, lineHeight: 13, color: '#607591' },
  disabled: { opacity: 0.5 },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: '#405573' },
  value: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, color: '#20334f' },
  placeholder: { color: '#607591' },
  overlayRoot: { flex: 1 },
  menu: { borderRadius: dropdownTokens.menuRadius, borderWidth: 1, borderColor: '#e3e9f2', backgroundColor: '#fff', overflow: 'hidden', padding: dropdownTokens.menuPadding },
  list: { flexGrow: 0, flexShrink: 1 },
  search: { minHeight: 44, flexShrink: 0, marginTop: 8, marginBottom: 8 },
  overlayMenu: { position: 'absolute', elevation: 24, shadowColor: '#101d35', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  option: { minHeight: dropdownTokens.optionHeight, paddingHorizontal: 12, paddingVertical: 10, borderRadius: dropdownTokens.optionRadius, marginVertical: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  optionSelected: { backgroundColor: '#f0f4ff' },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#20334f' },
  optionTextSelected: { color: '#345cf2', fontWeight: '700' },
  empty: { padding: 12, fontSize: 13, color: '#607591' },
}));
