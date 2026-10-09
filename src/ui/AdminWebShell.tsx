import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { FiUsers, FiUserPlus, FiCheckSquare, FiClock, FiCreditCard, FiBarChart2, FiTrendingUp, FiSearch, FiUser, FiX } from 'react-icons/fi';
import { useAdminViewport } from './useAdminViewport';

const destinations = [
  { label: 'Employees', href: '/admin/employees', icon: FiUsers, match: ['/admin/employees'] },
  { label: 'Attendance', href: '/admin/attendance/team', icon: FiClock, match: ['/admin/attendance'] },
  { label: 'Payroll', href: '/admin/payroll', icon: FiCreditCard, match: ['/admin/payroll'] },
  { label: 'Reports', href: '/admin/reports', icon: FiBarChart2, match: ['/admin/reports'] },
  { label: 'Tasks', href: '/admin/tasks', icon: FiCheckSquare, match: ['/admin/tasks'] },
  { label: 'Lead', href: '/admin/teamlead', icon: FiUserPlus, match: ['/admin/teamlead'] },
  { label: 'CRM', href: '/admin/crm', icon: FiTrendingUp, match: ['/admin/crm'] },
] as const;

export function AdminWebShell({ children }: { children: React.ReactNode }) {
  const { desktop, sidebarWidth } = useAdminViewport();
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = destinations.find(item => item.match.some(prefix => pathname.startsWith(prefix)));
  const results = destinations.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <View style={styles.shell}>
      {desktop && <View accessibilityLabel="Admin navigation" style={[styles.sidebar, { width: sidebarWidth }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="BranchSuite dashboard" onPress={() => router.push('/admin/dashboard')} style={styles.brand}>
          <View style={styles.brandIcon}><FiUser size={21} color="#fff" /></View>
          <View><Text style={styles.brandTitle}>BranchSuite</Text><Text style={styles.muted}>Admin</Text></View>
        </Pressable>
        <Text style={styles.workspaceLabel}>ADMIN WORKSPACE</Text>
        <ScrollView style={styles.menu} contentContainerStyle={styles.menuContent}>
          {destinations.map(item => {
            const selected = current?.label === item.label;
            return (
              <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={() => router.push(item.href)} style={({ pressed }) => [styles.menuItem, pressed && styles.menuHover, selected && styles.menuSelected]}>
                <item.icon size={18} color={selected ? '#007f75' : '#6a7e89'} />
                <Text style={[styles.menuText, selected && styles.menuSelectedText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.account}><View style={styles.accountIcon}><FiUser size={18} color="#007f75" /></View><View style={styles.accountDetails}><Text style={styles.accountTitle}>Admin workspace</Text><Text style={styles.muted}>Business management</Text></View></View>
      </View>}
      <View style={styles.workspace}>
        {desktop && <View style={styles.topbar}>
          <View style={styles.topbarTitle}><Text style={styles.accountTitle}>BranchSuite</Text><Text style={styles.muted}>{current?.label || 'Business'} · Admin workspace</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Search admin pages" onPress={() => { setQuery(''); setSearchOpen(true); }} style={({ pressed }) => [styles.searchButton, pressed && styles.menuHover]}><FiSearch size={19} color="#334d5a" /></Pressable>
          <View accessibilityLabel="Admin account" style={styles.accountIcon}><FiUser size={19} color="#007f75" /></View>
        </View>}
        <View style={styles.screen}>{children}</View>
      </View>
      <Modal transparent visible={desktop && searchOpen} animationType="fade" onRequestClose={() => setSearchOpen(false)}>
        <View style={styles.searchOverlay}><View style={styles.searchDialog}>
          <View style={styles.searchHeading}><Text style={styles.brandTitle}>Find an admin page</Text><Pressable accessibilityRole="button" accessibilityLabel="Close page search" onPress={() => setSearchOpen(false)} style={styles.searchButton}><FiX size={20} color="#334d5a" /></Pressable></View>
          <TextInput autoFocus accessibilityLabel="Search admin pages" placeholder="Search pages…" value={query} onChangeText={setQuery} style={styles.searchInput} />
          <ScrollView keyboardShouldPersistTaps="handled">{results.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`Open ${item.label}`} onPress={() => { setSearchOpen(false); router.push(item.href); }} style={styles.searchResult}><item.icon size={18} color="#007f75" /><Text style={styles.menuText}>{item.label}</Text></Pressable>)}{results.length === 0 && <Text style={styles.noResults}>No matching pages.</Text>}</ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, flexDirection: 'row', backgroundColor: '#f3f9f8' },
  sidebar: { flexShrink: 0, paddingTop: 30, backgroundColor: '#fbfdfd', borderRightWidth: 1, borderRightColor: '#dce7e6' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22 },
  brandIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#007f75', alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: 18, fontWeight: '800', color: '#152b3c' },
  muted: { fontSize: 12, lineHeight: 18, color: '#6a7e89', marginTop: 2 },
  workspaceLabel: { marginTop: 36, marginBottom: 18, paddingHorizontal: 22, fontSize: 10, letterSpacing: 1.5, color: '#6a7e89' },
  menu: { flex: 1, minHeight: 0 }, menuContent: { paddingHorizontal: 22, gap: 8, paddingBottom: 20 },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  menuHover: { backgroundColor: '#edf5f3' }, menuSelected: { backgroundColor: '#e0f3ed', borderLeftColor: '#6bb7a9' },
  menuText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: '#4d6372' }, menuSelectedText: { color: '#007f75', fontWeight: '700' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 22, borderTopWidth: 1, borderTopColor: '#eef3f2' },
  accountIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#d5f1ec', alignItems: 'center', justifyContent: 'center' },
  accountTitle: { color: '#152b3c', fontSize: 14, fontWeight: '700' },
  accountDetails: { flex: 1, minWidth: 0 },
  workspace: { flex: 1, minWidth: 0, minHeight: 0 },
  topbar: { height: 72, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#dce7e6' },
  topbarTitle: { flex: 1, minWidth: 0 }, searchButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#f5f8fa', alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, minWidth: 0, minHeight: 0 },
  searchOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(21,43,60,0.25)' },
  searchDialog: { width: '100%', maxWidth: 520, maxHeight: '80%', padding: 24, borderRadius: 20, backgroundColor: '#fff' },
  searchHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },
  searchInput: { minHeight: 46, padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#dce7e6', borderRadius: 12, marginBottom: 12 },
  searchResult: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, padding: 12 },
  noResults: { padding: 12, fontSize: 13, color: '#6a7e89' },
});
