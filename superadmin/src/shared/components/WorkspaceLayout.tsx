import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme/tokens';
import { moduleIconColor } from '../../theme/iconAccent';
import { env } from '../../core/config/env';
import { useAuth } from '../../core/auth/AuthContext';
import { can, roleLabel } from '../../core/permissions/roles';
import { NAV_ITEMS, sectionOf, type NavItem } from '../../core/config/navigation';
import { previewDb } from '../../core/data/previewStore';
import { PREVIEW_PASSWORD } from '../../fixtures/previewData';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { AppText, Avatar, Button, Icon, Sheet, useToast, type IconName } from '.';
import { useQuickAction } from './QuickActions';
import { DevelopmentNotice } from './DevelopmentNotice';

const go = (href: string) => router.navigate(href as never);

/**
 * Admin shell (workspace-ui.js `shell`): sidebar at >= 1000px, otherwise a top bar plus
 * bottom navigation with four items and More. One shell serves every role and size.
 */
export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { sidebar } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const items = useMemo(() => NAV_ITEMS.filter((i) => can(user?.role, i.capability)), [user?.role]);
  const current = sectionOf(pathname);

  return (
    <View style={[styles.root, { paddingTop: sidebar ? 0 : insets.top }]}>
      {sidebar ? <Sidebar items={items} current={current} /> : null}
      <View style={styles.body}>
        <TopBar onSearch={() => setSearchOpen(true)} onAccount={() => setAccountOpen(true)} showLabel={true} />
        <DevelopmentNotice />
        <View style={styles.main}>{children}</View>
        {!sidebar ? <BottomNav current={current} /> : null}
      </View>
      <FindModule visible={searchOpen} items={items} onClose={() => setSearchOpen(false)} />
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

function Sidebar({ items, current }: { items: NavItem[]; current: string }) {
  const { user } = useAuth();
  return (
    <ScrollView style={{ width: 224, flexGrow: 0, backgroundColor: colors.sidebar }} contentContainerStyle={[styles.sidebar, { flexGrow: 1 }]} accessibilityRole="menu">
      <View style={styles.brand}>
        <View style={styles.brandMark}><Icon name="building" size={20} color="#fff" /></View>
        <View>
          <Text style={styles.brandName}>BranchSuite</Text>
          <Text style={styles.brandSub}>ADMIN</Text>
        </View>
      </View>
      <Text style={styles.caption}>PLATFORM</Text>
      <View style={{ gap: 2 }}>
        {items.map((item) => {
          const active = item.href === current;
          return (
            <Pressable
              key={item.href}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: active }}
              onPress={() => go(item.href)}
              style={({ pressed }) => [styles.side, active ? styles.sideActive : null, pressed && !active ? { backgroundColor: colors.sidebarActive } : null]}
            >
              <Icon name={item.icon} size={18} color={moduleIconColor(item.icon)} />
              <Text style={[styles.sideText, active ? styles.sideTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.sideFoot}>
        <View style={styles.sideUser}>
          <Avatar name={user?.name ?? ''} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sideUserName} numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.sideUserRole}>{user ? roleLabel[user.role] : ''}</Text>
          </View>
        </View>
        <View style={styles.modeRow}>
          <View style={[styles.dot, { backgroundColor: env.dataMode === 'api' ? '#2E9B6F' : env.dataMode === 'preview' ? '#C98A1E' : '#B3293E' }]} />
          <Text style={styles.modeText}>{env.dataMode === 'api' ? 'API configured' : env.dataMode === 'preview' ? 'Preview data' : 'No backend'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function TopBar({ onSearch, onAccount }: { onSearch: () => void; onAccount: () => void; showLabel: boolean }) {
  const { user } = useAuth();
  const { sidebar } = useBreakpoint();
  return (
    <View style={[styles.top, { paddingHorizontal: sidebar ? 32 : 18 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.topTitle}>BranchSuite</Text>
        <Text style={styles.topSub}>Admin console</Text>
      </View>
      <View style={styles.topActions}>
        <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Find a module" style={styles.iconButton}>
          <Icon name="search" size={19} color={colors.ink} />
        </Pressable>
        <Pressable onPress={onAccount} accessibilityRole="button" accessibilityLabel="Account" style={styles.userButton}>
          <Avatar name={user?.name ?? ''} />
          {sidebar ? <Text style={styles.userText}>Account</Text> : null}
          {sidebar ? <Icon name="down" size={14} color={colors.subtle} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

function BottomNav({ current }: { current: string }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const admin = user?.role === 'PLATFORM_ADMIN';
  const items: { label: string; href: string; icon: IconName }[] = [
    ...NAV_ITEMS.filter((i) => i.primary === 'all' || i.primary === (admin ? 'admin' : 'support')).map((i) => ({ label: i.label, href: i.href, icon: i.icon })),
    { label: 'More', href: '/more', icon: 'more' },
  ];
  const owners = new Set(items.map((i) => i.href));
  const active = owners.has(current) ? current : '/more';
  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {items.map((item) => {
        const on = item.href === active;
        return (
          <Pressable key={item.href} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label} onPress={() => go(item.href)} style={[styles.tab, on ? styles.tabOn : null]}>
            <Icon name={item.icon} size={19} color={on ? colors.primary : '#6A7A90'} />
            <Text style={[styles.tabText, on ? { color: colors.primary } : null]} numberOfLines={1}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FindModule({ visible, items, onClose }: { visible: boolean; items: NavItem[]; onClose: () => void }) {
  const { user } = useAuth();
  const quick = useQuickAction();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = items.filter((i) => i.label.toLowerCase().includes(q));
  const actions = can(user?.role, 'offers.manage')
    ? [
        { label: 'Create offer', icon: 'star' as const, run: () => quick('offer') },
        { label: 'Create campaign', icon: 'leads' as const, run: () => quick('campaign') },
      ].filter((a) => a.label.toLowerCase().includes(q))
    : [];
  const close = () => {
    setQuery('');
    onClose();
  };
  return (
    <Sheet visible={visible} title="Find a module" onClose={close}>
      <View style={styles.findBox}>
        <Icon name="search" size={17} color={colors.subtle} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search a module" placeholderTextColor={colors.faint} style={styles.findInput} autoFocus accessibilityLabel="Search a module" />
      </View>
      {[...matches.map((m) => ({ label: m.label, icon: m.icon, run: () => go(m.href) })), ...actions].map((row) => (
        <Pressable key={row.label} accessibilityRole="button" onPress={() => { close(); row.run(); }} style={styles.findRow}>
          <View style={styles.findIcon}><Icon name={row.icon} size={18} color={colors.primary} /></View>
          <Text style={styles.findLabel}>{row.label}</Text>
          <Icon name="chevron" size={15} color={colors.faint} />
        </Pressable>
      ))}
      {!matches.length && !actions.length ? <AppText variant="small">No module matches “{query}”.</AppText> : null}
    </Sheet>
  );
}

function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, signOut, signIn } = useAuth();
  const toast = useToast();
  const others = env.dataMode === 'preview' ? previewDb().accounts.filter((a) => a.id !== user?.id) : [];
  return (
    <Sheet visible={visible} title="Account" onClose={onClose}>
      <View style={styles.accountCard}>
        <Avatar name={user?.name ?? ''} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.findLabel}>{user?.name}</Text>
          <AppText variant="small">{user?.email}</AppText>
          <AppText variant="tiny">{user ? roleLabel[user.role] : ''}</AppText>
        </View>
      </View>
      {others.length ? (
        <>
          <AppText variant="small" style={{ marginVertical: 10 }}>Switch to another preview role</AppText>
          {others.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              onPress={async () => {
                onClose();
                await signIn(a.email, PREVIEW_PASSWORD);
                router.replace('/dashboard');
                toast('Signed in as ' + roleLabel[a.role] + '.');
              }}
              style={styles.findRow}
            >
              <View style={styles.findIcon}><Icon name="settings" size={18} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.findLabel}>{roleLabel[a.role]}</Text>
                <AppText variant="tiny">{a.email}</AppText>
              </View>
              <Icon name="chevron" size={15} color={colors.faint} />
            </Pressable>
          ))}
        </>
      ) : null}
      <Button label="Sign out" variant="secondary" icon="logout" full style={{ marginTop: 14 }} onPress={async () => { onClose(); await signOut(); router.replace('/login'); }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  body: { flex: 1, minWidth: 0 },
  main: { flex: 1 },
  previewBanner: { backgroundColor: '#FFF4E3', paddingVertical: 6, paddingHorizontal: 16 },
  previewText: { fontSize: 11, color: '#8A6228', textAlign: 'center', fontWeight: '600' },
  sidebar: { width: 224, backgroundColor: colors.sidebar, borderRightWidth: 1, borderRightColor: '#E7EBF2', paddingTop: 27, paddingHorizontal: 14, paddingBottom: 21 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 6, marginBottom: 30 },
  brandMark: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 },
  brandSub: { fontSize: 8, fontWeight: '800', color: '#73819A', letterSpacing: 1.2 },
  caption: { fontSize: 9, fontWeight: '700', color: '#94A0B2', letterSpacing: 1.5, marginHorizontal: 13, marginBottom: 14 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12, minHeight: 46 },
  sideActive: { backgroundColor: colors.sidebarActive, borderLeftWidth: 3, borderLeftColor: colors.sidebarActiveEdge, paddingLeft: 12 },
  sideText: { fontSize: 13, fontWeight: '600', color: colors.sidebarInk },
  sideTextActive: { color: colors.sidebarActiveInk, fontWeight: '700' },
  sideFoot: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#E7EBF2', paddingTop: 18 },
  sideUser: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  sideUserName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  sideUserRole: { fontSize: 10, color: colors.subtle },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  modeText: { fontSize: 10, color: '#7E8B9C' },
  top: { height: 69, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: '#EDF0F5', flexDirection: 'row', alignItems: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  topSub: { fontSize: 10, color: '#6F7E91', marginTop: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5F7FB', borderWidth: 1, borderColor: '#EDF0F5', alignItems: 'center', justifyContent: 'center' },
  userButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  userText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  bottom: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: '#E8ECF3', paddingTop: 8, paddingHorizontal: 6, gap: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.md, minHeight: 52 },
  tabOn: { backgroundColor: colors.primarySoft },
  tabText: { fontSize: 10, fontWeight: '700', color: '#6A7A90' },
  findBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 50, marginBottom: 14 },
  findInput: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 48 },
  findRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.tile, padding: 12, marginBottom: 10, minHeight: 56 },
  findIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  findLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  accountCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: radius.tile, backgroundColor: '#F8F6FF' },
});
