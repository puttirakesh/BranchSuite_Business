import { KeyboardAwareScrollView as ScrollView } from './KeyboardAwareScrollView';
import { useToastState } from './useToastState';
import { SearchField } from "./SearchField";
import React, { useEffect, useRef, useState } from 'react';
import { Link, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ToastModal as Modal } from './Toast';
import { AppIcon } from './AppIcon';
import { BrandLogo } from './BrandLogo';
import { activeDestination, filterDestinations, type WorkspaceDestination } from './workspace-navigation';
import { colors } from '../shared/theme/colors';
import { webWorkspaceTheme as theme } from './webWorkspaceStyles';
import { moduleIconColors } from './iconAccent';

type Props = {
  workspace: string;
  items: WorkspaceDestination[];
  pathname: string;
  userName: string;
  companyName: string;
  onNavigate?: () => void;
  onClose?: () => void;
  onSignOut?: () => Promise<void>;
  collapsed?: boolean;
  onToggle?: () => void;
};

export function WorkspaceNavigation({ workspace, items, pathname, userName, companyName, onNavigate, onClose, onSignOut, collapsed = false, onToggle }: Props) {
  const rail = Platform.OS === 'web' && collapsed;
  const [search, setSearch] = useState('');
  const searchRef = useRef<TextInput>(null);
  const [focusSearch, setFocusSearch] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [signOutHint, setSignOutHint] = useState(false);
  const [focused, setFocused] = useState('');
  const [hovered, setHovered] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useToastState('', 'error');
  const visible = filterDestinations(items, search);
  const active = activeDestination(items, pathname);
  const activeLink = useRef<{ scrollIntoView?: (options: ScrollIntoViewOptions) => void } | null>(null);
  useEffect(() => { if (rail) setSearch(''); }, [rail]);
  useEffect(() => {
    if (rail || !focusSearch) return;
    const frame = requestAnimationFrame(() => { searchRef.current?.focus(); setFocusSearch(false); });
    return () => cancelAnimationFrame(frame);
  }, [rail, focusSearch]);
  useEffect(() => setSignOutHint(false), [pathname, rail]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => activeLink.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [active?.href, search, rail]);
  return <View accessibilityLabel={`${workspace} navigation`} style={s.sidebar}>
    <View style={[s.brand, rail && compact.brand]}>
      <BrandLogo />
      {!rail && <View style={s.flex}><Text numberOfLines={1} style={s.brandName}>BranchSuite</Text><Text numberOfLines={1} style={s.muted}>{workspace} workspace</Text></View>}
      {onToggle && <Pressable accessibilityRole="button" accessibilityLabel={rail ? 'Expand sidebar' : 'Collapse sidebar'} accessibilityState={{ expanded: !rail }} onPress={onToggle} style={compact.toggle} {...(Platform.OS === 'web' ? { title: rail ? 'Expand sidebar' : 'Collapse sidebar' } : {})}><AppIcon name={rail ? 'chevron-right' : 'chevron-left'} size={18} color={theme.navigationText} /></Pressable>}
      {onClose && <Pressable accessibilityRole="button" accessibilityLabel="Close navigation" onPress={onClose} style={s.close}><AppIcon name="x" size={21} color={Platform.OS === 'web' ? theme.navigationText : colors.text} /></Pressable>}
    </View>
    {rail ? <View style={compact.search}><Pressable accessibilityRole="button" accessibilityLabel="Search navigation" {...{ title: 'Search navigation' }} onPress={() => { setFocusSearch(true); onToggle?.(); }} style={compact.searchButton}><AppIcon name="search" size={20} color={theme.navigationText} /></Pressable></View>
      : <View style={s.searchContainer}>{Platform.OS === 'web' ? <View testID="sidebar-search-field" style={[compact.plainSearch, searchFocused && compact.searchFocused]}>
        <AppIcon name="search" size={18} color="#A8B8D0" />
        <TextInput ref={searchRef} accessibilityLabel={`Find a page in ${workspace.toLowerCase()} navigation`} placeholder="Search" placeholderTextColor="#A8B8D0" value={search} onChangeText={setSearch} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} autoCapitalize="none" autoCorrect={false} maxLength={100} style={compact.searchInput} />
        {!!search && <Pressable accessibilityRole="button" accessibilityLabel={`Clear find a page in ${workspace.toLowerCase()} navigation`} onPress={() => { setSearch(''); searchRef.current?.focus(); }} style={compact.clearSearch}><AppIcon name="x" size={16} color="#A8B8D0" /></Pressable>}
      </View> : <SearchField ref={searchRef} accessibilityLabel={`Find a page in ${workspace.toLowerCase()} navigation`} value={search} onChangeText={setSearch} />}</View>}
    <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={s.scroll} contentContainerStyle={s.menu} keyboardShouldPersistTaps="handled">
      {visible.map(item => {
          const selected = active?.href === item.href;
          return <Link key={item.href} href={item.href as Href} aria-current={selected ? 'page' : undefined} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={() => { if (rail) onToggle?.(); onNavigate?.(); }}
              ref={node => {
                if (selected) activeLink.current = node as unknown as typeof activeLink.current;
                if (Platform.OS === 'web' && node) {
                  const element = node as unknown as HTMLElement;
                  if (rail) element.setAttribute('title', item.label);
                  else element.removeAttribute('title');
                }
              }}
              onHoverIn={() => setHovered(item.href)} onHoverOut={() => setHovered('')} onFocus={() => setFocused(item.href)} onBlur={() => setFocused('')}
              style={StyleSheet.flatten([s.item, rail && compact.item, hovered === item.href && s.hover, selected && s.selected, focused === item.href && s.focused])}>
              <AppIcon name={item.icon} size={18} color={Platform.OS === 'web' ? moduleIconColors[item.icon] ?? '#7DD3FC' : selected ? colors.primary : colors.muted} />
              {!rail && <Text style={[s.label, selected && s.selectedLabel]}>{item.label}</Text>}
              {selected && <View accessibilityElementsHidden style={[s.dot, rail && compact.dot]} />}
            </Pressable>
          </Link>;
      })}
      {!visible.length && <Text accessibilityLiveRegion="polite" style={s.empty}>No pages match “{search}”. Try a module name such as attendance or payroll.</Text>}
    </ScrollView>
    <View style={compact.accountContainer}>
    <View style={[s.account, rail && compact.account]}>
      {rail ? <Pressable accessibilityRole="button" accessibilityLabel={`Expand sidebar for ${userName}`} onPress={onToggle} style={compact.profileButton}><View style={[s.avatar, compact.railAvatar]}><Text style={s.initial}>{userName.trim().charAt(0).toUpperCase() || 'U'}</Text></View></Pressable> : <><View style={s.avatar}><Text style={s.initial}>{userName.trim().charAt(0).toUpperCase() || 'U'}</Text></View><View style={s.flex}><Text numberOfLines={1} style={s.accountName}>{userName}</Text><Text numberOfLines={1} style={s.muted}>{companyName}</Text></View></>}
    {onSignOut && <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onHoverIn={() => setSignOutHint(true)} onHoverOut={() => setSignOutHint(false)} onFocus={() => setSignOutHint(true)} onBlur={() => setSignOutHint(false)} disabled={signingOut} accessibilityState={{ disabled: signingOut, busy: signingOut }} onPress={() => {
      setSigningOut(true); setAccountError('');
      void onSignOut().catch(() => setAccountError('Could not sign out. Please try again.')).finally(() => setSigningOut(false));
    }} style={[compact.signOut, rail && compact.railSignOut]}><AppIcon name="log-out" size={18} color={Platform.OS === 'web' ? '#FDA4AF' : '#A33148'} /></Pressable>}
    </View>
    {signOutHint && <View pointerEvents="none" style={compact.tooltip}><Text style={compact.tooltipText}>Sign out</Text></View>}
    </View>
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

const base = StyleSheet.create({
  searchContainer: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  flex: { flex: 1, minWidth: 0 }, sidebar: { flex: 1, minHeight: 0, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, paddingTop: 24 },
  brandName: { color: colors.text, fontSize: 17, fontWeight: '700' }, muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  search: { flexDirection: 'row', gap: 8, alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 10, fontSize: 13, color: '#20334f' }, clear: { padding: 10 },
  scroll: { flex: 1, minHeight: 0 }, menu: { paddingHorizontal: 12, paddingBottom: 20, gap: 3 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, borderWidth: 2, borderColor: 'transparent' },
  label: { flex: 1, minWidth: 0, color: '#405573', fontSize: 13, lineHeight: 19 }, hover: { backgroundColor: '#edf5f3' },
  selected: { backgroundColor: colors.primaryLight }, selectedLabel: { color: colors.primaryDark, fontWeight: '700' }, focused: { borderColor: colors.primary }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  empty: { padding: 12, fontSize: 13, lineHeight: 21, color: colors.muted }, account: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight }, initial: { color: colors.primary, fontSize: 15, fontWeight: '700' }, accountName: { fontSize: 13, lineHeight: 20, color: colors.text, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, overlay: { flex: 1, backgroundColor: 'rgba(21,43,60,0.4)' }, drawer: { width: 300, maxWidth: '90%', height: '100%' },
});

const s = Platform.OS !== 'web' ? base : StyleSheet.create({
  ...base,
  sidebar: { ...base.sidebar, backgroundColor: theme.navigation, borderRightColor: theme.navigation },
  brand: { ...base.brand, paddingHorizontal: 14, gap: 8, paddingBottom: 24 },
  searchContainer: { marginHorizontal: 12, marginBottom: 18 },
  brandName: { ...base.brandName, color: '#FFFFFF', fontSize: 19 },
  muted: { ...base.muted, color: '#A8B8D0' },
  label: { ...base.label, color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  menu: { ...base.menu, gap: 5 },
  item: { ...base.item, borderRadius: 10, minHeight: 46 },
  hover: { backgroundColor: '#1C2E4A' },
  selected: { backgroundColor: theme.primary },
  selectedLabel: { ...base.selectedLabel, color: '#FFFFFF', fontWeight: '600' },
  dot: { ...base.dot, backgroundColor: '#34D399' },
  focused: { borderColor: '#93B8FF' },
  empty: { ...base.empty, color: theme.navigationText },
  account: { ...base.account, borderTopColor: '#2A3951', backgroundColor: '#14223B' },
  accountName: { ...base.accountName, color: '#FFFFFF' },
  avatar: { ...base.avatar, backgroundColor: '#283C60' },
  initial: { ...base.initial, color: '#FFFFFF' },
});

const compact = StyleSheet.create({
  brand: { flexDirection: 'column', paddingHorizontal: 12, paddingTop: 20, paddingBottom: 16, gap: 12 },
  toggle: { width: 32, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#1C2E4A' },
  search: { paddingHorizontal: 14, paddingBottom: 18 },
  searchButton: { width: 46, height: 44, borderWidth: 1, borderColor: '#2A3D5B', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  plainSearch: { flexDirection: 'row', alignItems: 'center', minWidth: 0, minHeight: 44, paddingLeft: 12, borderRadius: 10, borderWidth: 1, borderColor: '#314562', backgroundColor: 'transparent' },
  searchFocused: { borderColor: '#93B8FF' },
  searchInput: { flex: 1, minWidth: 0, height: 42, color: '#E2E8F0', backgroundColor: 'transparent', fontSize: 14, paddingHorizontal: 10, paddingVertical: 10 },
  clearSearch: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  item: { paddingHorizontal: 0, justifyContent: 'center', position: 'relative', gap: 0 },
  dot: { position: 'absolute', right: 5, top: 7 },
  accountContainer: { position: 'relative', zIndex: 30 },
  account: { paddingHorizontal: 6, gap: 0, justifyContent: 'space-between' },
  profileButton: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  railAvatar: { width: 28, height: 28, borderRadius: 9 },
  signOut: { width: 36, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  railSignOut: { width: 32 },
  tooltip: { position: 'absolute', bottom: '100%', right: 6, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#253957', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' },
  tooltipText: { color: '#FFFFFF', fontSize: 12, lineHeight: 18 },
});
