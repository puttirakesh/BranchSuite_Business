import { SearchField } from "./SearchField";
import React, { useEffect, useRef, useState } from 'react';
import { Link, type Href } from 'expo-router';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { activeDestination, filterDestinations, type WorkspaceDestination } from './workspace-navigation';
import { colors } from '../shared/theme/colors';

type Props = {
  workspace: string;
  items: WorkspaceDestination[];
  pathname: string;
  userName: string;
  companyName: string;
  onNavigate?: () => void;
  onClose?: () => void;
  onSignOut?: () => Promise<void>;
};

export function WorkspaceNavigation({ workspace, items, pathname, userName, companyName, onNavigate, onClose, onSignOut }: Props) {
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState('');
  const [hovered, setHovered] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState('');
  const visible = filterDestinations(items, search);
  const groups = [...new Set(visible.map(item => item.group))];
  const active = activeDestination(items, pathname);
  const activeLink = useRef<{ scrollIntoView?: (options: ScrollIntoViewOptions) => void } | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => activeLink.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [active?.href, search]);
  return <View accessibilityLabel={`${workspace} navigation`} style={s.sidebar}>
    <View style={s.brand}>
      <View style={s.logo}><AppIcon name="layers" color="#fff" size={22} /></View>
      <View style={s.flex}><Text style={s.brandName}>BranchSuite</Text><Text style={s.muted}>{workspace} workspace</Text></View>
      {onClose && <Pressable accessibilityRole="button" accessibilityLabel="Close navigation" onPress={onClose} style={s.close}><AppIcon name="x" size={21} /></Pressable>}
    </View>
    <SearchField accessibilityLabel={`Find a page in ${workspace.toLowerCase()} navigation`} value={search} onChangeText={setSearch} />
    <ScrollView style={s.scroll} contentContainerStyle={s.menu} keyboardShouldPersistTaps="handled">
      {groups.map(group => <View key={group} style={s.group}>
        <Text style={s.groupLabel}>{group}</Text>
        {visible.filter(item => item.group === group).map(item => {
          const selected = active?.href === item.href;
          return <Link key={item.href} href={item.href as Href} aria-current={selected ? 'page' : undefined} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={onNavigate}
              ref={selected ? node => { activeLink.current = node as unknown as typeof activeLink.current; } : undefined}
              onHoverIn={() => setHovered(item.href)} onHoverOut={() => setHovered('')} onFocus={() => setFocused(item.href)} onBlur={() => setFocused('')}
              style={StyleSheet.flatten([s.item, hovered === item.href && s.hover, selected && s.selected, focused === item.href && s.focused])}>
              <AppIcon name={item.icon} size={18} color={selected ? colors.primary : colors.muted} />
              <Text style={[s.label, selected && s.selectedLabel]}>{item.label}</Text>
              {selected && <View accessibilityElementsHidden style={s.dot} />}
            </Pressable>
          </Link>;
        })}
      </View>)}
      {!visible.length && <Text accessibilityLiveRegion="polite" style={s.empty}>No pages match “{search}”. Try a module name such as attendance or payroll.</Text>}
    </ScrollView>
    <View style={s.account}><View style={s.avatar}><Text style={s.initial}>{userName.trim().charAt(0).toUpperCase() || 'U'}</Text></View><View style={s.flex}><Text numberOfLines={1} style={s.accountName}>{userName}</Text><Text numberOfLines={1} style={s.muted}>{companyName}</Text></View></View>
    {onSignOut && <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={signingOut} onPress={() => {
      setSigningOut(true); setAccountError('');
      void onSignOut().catch(() => setAccountError('Could not sign out. Please try again.')).finally(() => setSigningOut(false));
    }} style={s.signOut}><AppIcon name="log-out" size={17} color="#A33148" /><Text style={s.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text></Pressable>}
    {!!accountError && <Text accessibilityRole="alert" style={s.empty}>{accountError}</Text>}
  </View>;
}

export function WorkspaceNavigationDrawer({ open, ...props }: Props & { open: boolean; onClose: () => void }) {
  const close = useRef(props.onClose);
  close.current = props.onClose;
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const opener = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => { window.removeEventListener('keydown', handleKey, true); if (opener?.isConnected) opener.focus(); };
  }, [open]);
  return <Modal visible={open} transparent animationType="fade" onRequestClose={props.onClose}>
    <View style={s.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss navigation" onPress={props.onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={s.drawer}>{open && <WorkspaceNavigation {...props} />}</View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, sidebar: { flex: 1, minHeight: 0, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, paddingTop: 24 },
  logo: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.text, fontSize: 17, fontWeight: '700' }, muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  search: { flexDirection: 'row', gap: 8, alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 10, fontSize: 13, color: '#20334f' }, clear: { padding: 10 },
  scroll: { flex: 1, minHeight: 0 }, menu: { paddingHorizontal: 12, paddingBottom: 20, gap: 18 }, group: { gap: 3 },
  groupLabel: { paddingHorizontal: 12, marginTop: 5, marginBottom: 6, fontSize: 11, lineHeight: 16, color: '#586d7c', fontWeight: '700', letterSpacing: 0.5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, borderWidth: 2, borderColor: 'transparent' },
  label: { flex: 1, minWidth: 0, color: '#405573', fontSize: 13, lineHeight: 19 }, hover: { backgroundColor: '#edf5f3' },
  selected: { backgroundColor: colors.primaryLight }, selectedLabel: { color: colors.primaryDark, fontWeight: '700' }, focused: { borderColor: colors.primary }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  empty: { padding: 12, fontSize: 13, lineHeight: 21, color: colors.muted }, account: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight }, initial: { color: colors.primary, fontSize: 15, fontWeight: '700' }, accountName: { fontSize: 13, lineHeight: 20, color: colors.text, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, overlay: { flex: 1, backgroundColor: 'rgba(21,43,60,0.4)' }, drawer: { width: 300, maxWidth: '90%', height: '100%' },
  signOut: { minHeight: 44, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 }, signOutText: { color: '#A33148', fontSize: 13, fontWeight: '600' },
});
