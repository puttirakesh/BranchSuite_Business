import { NeutralInputContext } from './InputInteractionContext';
import React, { useContext, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import type { DropdownProps } from './dropdown-types';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';

export type { DropdownOption, DropdownProps } from './dropdown-types';

const MENU_MAX_HEIGHT = 280;
type Placement = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/**
 * Web dropdown: the option list is rendered in a portal on document.body and positioned
 * under the input, so it always floats above the page instead of being clipped by or
 * hidden behind neighbouring content.
 */
export function Dropdown({ label, value, options, onChange, placeholder = 'Select an option', disabled = false, invalid = false, emptyText = 'No options available.', quiet = false, labelInside = false, valueOnly = false, controlId, style }: DropdownProps) {
  const neutral = useContext(NeutralInputContext);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const controlRef = useRef<View>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const optionsKey = JSON.stringify(options);
  const selected = options.find(option => option.value === value);
  const hasBranchChoices = options.some(option => option.value !== '' && option.value !== 'ALL');
  const displayed = valueOnly && !hasBranchChoices ? undefined : selected;

  const close = useCallback(() => { setOpen(false); }, []);
  const focusControl = () => (controlRef.current as unknown as HTMLElement | null)?.focus({ preventScroll: true });
  useEffect(() => { if (disabled) close(); }, [disabled, optionsKey, close]);

  const measure = useCallback(() => {
    const node = controlRef.current as unknown as HTMLElement | null;
    if (!node?.getBoundingClientRect) return;
    const rect = node.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const flip = below < 180 && above > below;
    const width = Math.min(Math.max(rect.width, 200), Math.max(0, window.innerWidth - 16));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPlacement(flip
      ? { left, width, bottom: window.innerHeight - rect.top + 6, maxHeight: Math.min(MENU_MAX_HEIGHT, above) }
      : { left, width, top: rect.bottom + 6, maxHeight: Math.min(MENU_MAX_HEIGHT, below) });
  }, []);

  useLayoutEffect(() => { if (open) measure(); }, [open, measure]);

  const positioned = !!placement;
  useEffect(() => {
    if (!open || !positioned) return;
    const menu = menuRef.current;
    const target = menu?.querySelector<HTMLElement>('input, [aria-selected="true"]')
      ?? menu?.querySelector<HTMLElement>('[role="option"]') ?? menu;
    target?.focus({ preventScroll: true });
  }, [open, positioned]);

  useEffect(() => {
    const control = controlRef.current as unknown as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (!disabled && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        setOpen(true);
      }
    };
    control?.addEventListener('keydown', onKey);
    return () => control?.removeEventListener('keydown', onKey);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    const onScroll = (event: Event) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); focusControl(); }
      if (event.key === 'Tab' && menuRef.current?.contains(document.activeElement)) { close(); focusControl(); }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, measure, close]);

  const menu = open && !disabled && placement ? createPortal(
    <>
      <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent' }} />
      <div
        ref={menuRef}
        id={menuId}
        role="listbox"
        data-neutral-controls={neutral ? 'true' : undefined}
        tabIndex={-1}
        aria-label={label}
        onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          if (event.target instanceof HTMLInputElement && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
          if (!items.length) return;
          event.preventDefault();
          const current = items.findIndex(item => item === document.activeElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : event.key === 'ArrowDown' ? (current + 1) % items.length : (current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length);
          items[next].focus({ preventScroll: true });
          items[next].scrollIntoView({ block: 'nearest' });
        }}
        style={{
          position: 'fixed', left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom,
          maxHeight: placement.maxHeight, display: 'flex', flexDirection: 'column', zIndex: 9999,
          background: webWorkspaceTheme.surface, border: `1px solid ${webWorkspaceTheme.border}`, borderRadius: webWorkspaceTheme.radiusControl, overflow: 'hidden',
          boxShadow: webWorkspaceTheme.menuShadow, fontFamily: 'inherit',
        }}
      >
        <div className="no-scrollbar" style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'none' }}>
          {options.length === 0 ? <div style={{ padding: 12, fontSize: 13, color: webWorkspaceTheme.muted }}>{emptyText}</div> : null}
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value || '__empty'}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => { close(); focusControl(); if (!isSelected) onChange(option.value); }}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); close(); focusControl(); if (!isSelected) onChange(option.value); } }}
                onMouseEnter={event => { if (!isSelected && !neutral) event.currentTarget.style.background = webWorkspaceTheme.hover; }}
                onMouseLeave={event => { if (!isSelected) event.currentTarget.style.background = 'transparent'; }}
                style={{
                  minHeight: webWorkspaceTheme.controlHeight, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  cursor: 'pointer', fontSize: 13, color: isSelected ? webWorkspaceTheme.primary : webWorkspaceTheme.text, fontWeight: isSelected ? 700 : 400,
                  background: isSelected ? webWorkspaceTheme.primaryLight : 'transparent',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: '20px' }}>{option.label}</span>
                {isSelected ? <span aria-hidden>✓</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <View style={[s.wrap, style]}>
      {!labelInside && !valueOnly && <Text style={s.label}>{label}</Text>}
      <Pressable
        ref={controlRef}
        nativeID={controlId}
        accessibilityRole="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid}
        aria-controls={open ? menuId : undefined}
        accessibilityLabel={label}
        accessibilityValue={{ text: displayed?.label ?? placeholder }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => (open ? close() : setOpen(true))}
        style={[s.control, labelInside && !valueOnly && s.controlWithLabel, open && !quiet && !neutral && s.controlOpen, invalid && { borderColor: '#B94D61' }, disabled && s.disabled]}
      >
        {labelInside && !valueOnly ? <View style={s.insideCopy}><Text numberOfLines={1} style={s.insideLabel}>{label}</Text><Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text></View> : <Text numberOfLines={1} style={[s.value, !displayed && s.placeholder]}>{displayed?.label ?? placeholder}</Text>}
        <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={webWorkspaceTheme.muted} />
      </Pressable>
      {menu}
    </View>
  );
}

const s = webWorkspaceStyles(StyleSheet.create({
  wrap: { minWidth: 0, gap: 4 },
  control: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: webWorkspaceTheme.radiusControl, borderWidth: 1, borderColor: '#dce3e7', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlWithLabel: { minHeight: 54, paddingVertical: 5 }, insideCopy: { flex: 1, minWidth: 0, justifyContent: 'center' }, insideLabel: { fontSize: 10, lineHeight: 13, color: '#607591' },
  controlOpen: { borderColor: '#345cf2', boxShadow: `0 0 0 3px ${webWorkspaceTheme.focusRing}55` },
  disabled: { opacity: 0.5 },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: '#405573' },
  value: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, color: '#20334f' },
  placeholder: { color: '#607591' },
}));
