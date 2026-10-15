import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import React, { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { FiTrendingUp, FiUserPlus, FiCreditCard, FiBarChart2, FiFileText, FiLock, FiBriefcase, FiClock, FiUser, FiSettings, FiHeadphones, FiHome, FiMoreHorizontal } from '../../../src/ui/FeatherIcons';
import { getEmployees } from '../../../src/core/employees';
import { readLeads } from '../crm/index';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';
import { DemoRolePicker, type DemoRole } from '../../../src/ui/DemoRolePicker';

const icons = { crm: FiTrendingUp, people: FiUserPlus, payroll: FiCreditCard, reports: FiBarChart2, file: FiFileText, lock: FiLock, branch: FiBriefcase, clock: FiClock, user: FiUser, settings: FiSettings, support: FiHeadphones, home: FiHome, more: FiMoreHorizontal };
type Item = { title: string; caption: string; icon: keyof typeof icons; route?: Href };
const workspace: Item[] = [
  { title: 'CRM workspace', caption: 'Leads, deals, customers, quotes and support', icon: 'crm', route: '/admin/crm' },
  { title: 'People workspace', caption: 'Branch team, attendance and leave', icon: 'people', route: '/admin/employees/people' },
  {
    title: 'Leave management',
    caption: 'Configure leave types and allocate balances',
    icon: 'clock',
    route: '/admin/leave-management',
  },
  { title: 'Branch payroll', caption: 'Independent preparation and approval', icon: 'payroll', route: '/admin/payroll' },
  {
    title: 'Salary advances',
    caption: 'Review, approve and reject employee advance requests',
    icon: 'payroll',
    route: '/admin/advances',
  },
  { title: 'Reports', caption: 'Company and branch exports', icon: 'reports', route: '/admin/reports' },
  { title: 'Activity audit', caption: 'Changes in the selected branch', icon: 'file', route: '/admin/activity-audit' },
  { title: 'Roles & branch access', caption: 'Permissions and assignments', icon: 'lock', route: '/admin/roles-permissions' },
  { title: 'Branch management', caption: 'Locations, codes and branch managers', icon: 'branch', route: '/admin/branches' },
];
const personal: Item[] = [
  { title: 'My attendance & leave', caption: 'Personal attendance and time-off requests', icon: 'clock', route: '/admin/attendance' },
  { title: 'My payslips', caption: 'Pay history and payslip documents', icon: 'payroll' },
  { title: 'My profile & documents', caption: 'Contact details and documents', icon: 'user', route: '/admin/profile' },
  { title: 'Settings & help', caption: 'Preferences and help', icon: 'settings' },
];
const account: Item[] = [
  { title: 'Subscription', caption: 'Plan, capacity and renewal status', icon: 'payroll', route: '/admin/subscription' },
  { title: 'Workspace settings', caption: 'Your brand, companies and users', icon: 'branch', route: '/admin/workspace-settings' },
  { title: 'Billing & invoices', caption: 'Subscription payments and documents', icon: 'file', route: '/admin/billing' },
  { title: 'Platform support', caption: 'Product, account and subscription help', icon: 'support', route: '/admin/platform-support' },
];
function MoreIcon({ name }: { name: keyof typeof icons }) {
  if (Platform.OS === 'web') { const Icon = icons[name]; return <Icon size={17} color="#607591" />; }
  if (name === 'user' || name === 'people') return <View style={baseStyles.person}><View style={baseStyles.personHead} /><View style={baseStyles.personBody} /></View>;
  if (name === 'clock') return <View style={baseStyles.clock}><View style={baseStyles.clockHand} /></View>;
  if (name === 'home' || name === 'more' || name === 'crm') return <Text style={baseStyles.glyph}>{name === 'home' ? '\u2302' : name === 'more' ? '\u00b7\u00b7\u00b7' : '\u2197'}</Text>;
  return <View style={baseStyles.document}>{[0, 1, 2].map(line => <View key={line} style={baseStyles.documentLine} />)}</View>;
}

export default function MorePage() {
  const { styles, contentWidth, recordGrid } = useAdminLayout(baseStyles);
  const { desktop } = useAdminViewport();
  const router = useRouter();
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [branchPicker, setBranchPicker] = useState(false);
  const [branchError, setBranchError] = useState('');
  const [notice, setNotice] = useState('');
  const [rolePicker, setRolePicker] = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getEmployees(), readLeads()]).then(([employees, leads]) => {
      if (active) { setBranches([...new Set([...employees, ...leads].map(record => record.branch).filter(Boolean))].sort()); setBranchError(''); }
    }).catch(() => { if (active) setBranchError('Branch records could not be loaded.'); });
    return () => { active = false; };
  }, []));
  const open = (item: Item) => {
    if (!item.route) { setNotice(item.title); return; }
    if (item.route === '/admin/crm' && branch) router.push({ pathname: '/admin/crm', params: { branch } });
    else if (item.route === '/admin/activity-audit' && branch) router.push({ pathname: '/admin/activity-audit', params: { branch } });
    else router.push(item.route);
  };
  const group = (items: Item[]) => <View style={styles.group}>{items.map((item, index) => <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => open(item)} style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}><View style={styles.rowIcon}><MoreIcon name={item.icon} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowCaption}>{item.caption}</Text></View><Text style={styles.chevron}>{'\u203a'}</Text></Pressable>)}</View>;
  const sectionWidth = Math.max(0, (contentWidth - (recordGrid.columns - 1) * 16) / recordGrid.columns);
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}><View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}>BranchSuite</Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>BranchSuite</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Header branch selector" onPress={() => setBranchPicker(true)} style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.filterText}>{branch || 'All branches'}</Text><Text style={styles.headerCaption}>{'\u2304'}</Text></Pressable></View></View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View><Text style={styles.eyebrow}>BUSINESS WORKSPACE</Text><Text style={styles.title}>More</Text><Text style={styles.subtitle}>Your modules, without the clutter.</Text></View>
      <View style={styles.branchCard}><View style={styles.branchDot} /><View style={styles.flex}><Text style={styles.branchTitle}>{branch || 'All branches'}</Text><Text style={styles.rowCaption}>One branch, every module</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Change More branch" onPress={() => setBranchPicker(true)} style={styles.change}><Text style={styles.link}>Change</Text></Pressable></View>
      <View style={styles.profileCard}><View style={styles.profileAvatar}><Text style={styles.avatarText}>{demoRole?.initials || 'A'}</Text></View><View style={styles.flex}><Text style={styles.profileTitle}>{demoRole?.name || 'Admin workspace'}</Text><Text style={styles.subtitle}>{demoRole?.title || 'Business Admin'}</Text></View></View>
      <View style={styles.sectionGrid}><View style={[styles.section, { width: sectionWidth }]}>{group(workspace)}</View><View style={[styles.section, { width: sectionWidth }]}><Text style={styles.sectionTitle}>My personal workspace</Text>{group(personal)}</View><View style={[styles.section, { width: sectionWidth }]}>{group(account)}<Pressable accessibilityRole="button" onPress={() => setNotice('Switch demo business')} style={styles.secondary}><Text style={styles.buttonText}>Switch demo business</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setRolePicker(true)} style={[styles.secondary, styles.selectedFilter]}><Text style={styles.link}>Try another demo role</Text></Pressable></View></View>
      <Text style={styles.footer}>BranchSuite · Admin workspace</Text>
    </ScrollView>
    {!desktop && <AdminBottomNavigation />}
  </View><Modal transparent visible={branchPicker || !!notice} animationType="fade" onRequestClose={() => { setBranchPicker(false); setNotice(''); }}><View style={styles.overlay}><View style={styles.modal}><View style={styles.headerRow}><Text style={[styles.profileTitle, styles.flex]}>{branchPicker ? 'Choose branch' : notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close More dialog" onPress={() => { setBranchPicker(false); setNotice(''); }} style={styles.change}><Text style={styles.link}>Close</Text></Pressable></View>{branchPicker ? <ScrollView>{branchError ? <Text style={styles.error}>{branchError}</Text> : null}{['', ...branches].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Select ${value || 'All branches'}`} accessibilityState={{ selected: branch === value }} onPress={() => { setBranch(value); setBranchPicker(false); }} style={styles.branchOption}><Text style={styles.filterText}>{value || 'All branches'}</Text></Pressable>)}</ScrollView> : <Text style={styles.dialogText}>This module is not connected in the current app yet.</Text>}</View></View></Modal><DemoRolePicker visible={rolePicker} onClose={() => setRolePicker(false)} onSelect={role => { setDemoRole(role); setRolePicker(false); }} /></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 }, content: { padding: 16, paddingTop: 24, paddingBottom: 32, gap: 14 },
  header: { padding: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#8192ad' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, minHeight: 34, padding: 10, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 9, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 11, color: '#405573', flexShrink: 1 },
  eyebrow: { fontSize: 9, letterSpacing: 1.5, fontWeight: '700', color: '#71829c' }, title: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: '#20334f', marginTop: 6 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 },
  branchCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 17, backgroundColor: '#fff' }, branchDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#39b8a7' }, branchTitle: { fontSize: 12, fontWeight: '700', color: '#20334f' }, change: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' }, link: { fontSize: 11, lineHeight: 17, fontWeight: '600', color: '#345cf2' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' }, profileAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, profileTitle: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: '#20334f' },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }, section: { gap: 12 }, sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: '#20334f', marginTop: 8 }, group: { borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', overflow: 'hidden' }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }, rowDivider: { borderTopWidth: 1, borderTopColor: '#edf1f8' }, rowIcon: { width: 32, height: 32, flexShrink: 0, borderRadius: 10, backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center' }, rowTitle: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#20334f' }, rowCaption: { fontSize: 10, lineHeight: 16, color: '#71829c', marginTop: 4 }, chevron: { fontSize: 22, color: '#8192ad' }, pressed: { opacity: 0.75 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fff' }, buttonText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#405573' }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, footer: { fontSize: 10, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 16 },
  navigation: { flexDirection: 'row', padding: 6, borderTopWidth: 1, borderTopColor: '#e4eaf5', backgroundColor: '#fff' }, navItem: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 4 }, navIcon: { width: 48, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navLabel: { fontSize: 9, lineHeight: 14, color: '#71829c', marginTop: 3 },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, borderRadius: 18, backgroundColor: '#fff' }, branchOption: { minHeight: 48, padding: 12, justifyContent: 'center' }, dialogText: { fontSize: 14, lineHeight: 22, color: '#405573', marginTop: 16 }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' },
  glyph: { fontSize: 20, color: '#607591' }, person: { width: 18, height: 18, alignItems: 'center' }, personHead: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#607591' }, personBody: { width: 13, height: 8, marginTop: 3, borderWidth: 1, borderBottomWidth: 0, borderColor: '#607591', borderTopLeftRadius: 6, borderTopRightRadius: 6 }, clock: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#607591' }, clockHand: { width: 4, height: 6, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: '#607591', marginLeft: 7, marginTop: 3 }, document: { width: 14, height: 17, borderWidth: 1, borderColor: '#607591', borderRadius: 2, paddingTop: 4, gap: 3, alignItems: 'center' }, documentLine: { width: 7, height: 1, backgroundColor: '#607591' },
});
