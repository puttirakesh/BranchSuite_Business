import { selectAdminBranch, useAdminScope, UserInitials } from '../../../src/core/admin/scope';
import { useAuth } from '../../../src/core/auth/AuthProvider';
import { canOpenAdminPath } from '../../../src/core/admin/access';
import { AppIcon } from "../../../src/ui/AppIcon";
import { BranchOptionsStatus } from '../../../src/ui/BranchOptionsStatus';
import { useAvailableBranches } from '../../../src/core/admin/available-branches';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ToastModal as Modal } from '../../../src/ui/Toast';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { FiTrendingUp, FiUserPlus, FiCreditCard, FiBarChart2, FiFileText, FiLock, FiBriefcase, FiClock, FiUser, FiSettings, FiHeadphones, FiHome, FiMoreHorizontal } from '../../../src/ui/FeatherIcons';

const icons = { crm: FiTrendingUp, people: FiUserPlus, payroll: FiCreditCard, reports: FiBarChart2, file: FiFileText, lock: FiLock, branch: FiBriefcase, clock: FiClock, user: FiUser, settings: FiSettings, support: FiHeadphones, home: FiHome, more: FiMoreHorizontal };
type Item = { title: string; caption: string; icon: keyof typeof icons; route?: Href };
const workspace: Item[] = [
  { title: 'CRM workspace', caption: 'Leads, deals, customers, quotes and activities', icon: 'crm', route: '/admin/crm' },
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
  { title: 'Departments', caption: 'Company and branch departments', icon: 'branch', route: '/admin/departments' },
];
const personal: Item[] = [
  { title: 'My leave requests', caption: 'Balances, applications and request history', icon: 'clock', route: '/admin/my-leave' },
  { title: 'My salary advances', caption: 'Apply and track your advance requests', icon: 'payroll', route: '/admin/my-advances' },
  { title: 'My attendance & leave', caption: 'Personal attendance and time-off requests', icon: 'clock', route: '/admin/attendance' },
  { title: 'My payslips', caption: 'Pay history and payslip documents', icon: 'payroll', route: '/admin/payslips' },
  { title: 'My profile & documents', caption: 'Contact details and documents', icon: 'user', route: '/admin/profile' },
  { title: 'Settings & help', caption: 'Preferences and help', icon: 'settings', route: '/admin/profile' },
];
const account: Item[] = [
  { title: 'Subscription', caption: 'Plan, capacity and renewal status', icon: 'payroll', route: '/admin/subscription' },
  { title: 'Workspace settings', caption: 'Your brand, companies and users', icon: 'branch', route: '/admin/workspace-settings' },
  { title: 'Billing & invoices', caption: 'Subscription payments and documents', icon: 'file', route: '/admin/billing' },
  { title: 'Platform support', caption: 'Product, account and subscription help', icon: 'support', route: '/admin/platform-support' },
];
function MoreIcon({ name }: { name: keyof typeof icons }) {
  const Icon = icons[name]; return <Icon size={20} color="#345cf2" />;
}

export default function MorePage() {
  const { session } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = baseStyles;
  const desktop = Platform.OS === 'web' && viewportWidth >= 1200;
  const mobile = viewportWidth < 768;
  const pagePadding = viewportWidth >= 1200 ? 32 : viewportWidth >= 768 ? 24 : 16;
  const sidebarWidth = Platform.OS === 'web' && viewportWidth >= 1200 ? 248 : 0;
  const availableWidth = Math.max(0, viewportWidth - insets.left - insets.right - sidebarWidth);
  const pageWidth = Math.min(availableWidth, 1280);
  const contentWidth = Math.max(0, pageWidth - pagePadding * 2);
  const router = useRouter();
  const scope = useAdminScope();
  const permittedItems = (items: Item[]) => items.filter(item => !item.route || canOpenAdminPath(session, scope?.companyId, typeof item.route === 'string' ? item.route : item.route.pathname ?? ''));
  const { branches: availableBranches, loading: branchesLoading, error: branchesError, refresh: refreshBranches } = useAvailableBranches();
  const branch = availableBranches.find(item => item.id === scope?.branchId)?.name ?? '';
  const branches = availableBranches.map(item => item.name);
  const [branchPicker, setBranchPicker] = useState(false);
  const [notice, setNotice] = useState('');
  const open = (item: Item) => {
    if (!item.route) { setNotice(item.title); return; }
    if (branch && (item.route === '/admin/crm' || item.route === '/admin/activity-audit')) router.push({ pathname: item.route, params: { branch } });
    else router.push(item.route);
  };
  const moduleGap = viewportWidth >= 768 ? 16 : 12;
  const contextGap = 12;
  const contextCardStyle = mobile ? { width: contentWidth, flexGrow: 0, flexShrink: 0 } : styles.contextCardWide;
  const moduleSections = [
    { title: 'Business workspace', items: permittedItems(workspace) },
    { title: 'My workspace', items: permittedItems(personal) },
    { title: 'Administration', items: permittedItems(account) },
  ];
  const renderModuleCard = (item: Item) => (
    <Pressable
      key={item.title}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={() => open(item)}
      style={({ pressed }) => [
        styles.moduleCard,
        mobile ? styles.moduleCardMobile : styles.moduleCardWide,
        pressed && styles.pressed,
      ]}
    >
      {mobile ? (
      <View style={styles.moduleCardMobileRow}>
        <View style={[styles.rowIcon, styles.rowIconMobile]}><MoreIcon name={item.icon} /></View>
        <View style={styles.moduleCardCopy}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowCaptionMobile}>{item.caption}</Text>
        </View>
        <AppIcon symbol="›" style={styles.chevron} />
      </View>
      ) : (
      <>
      <View style={styles.moduleCardTop}>
        <View style={[styles.rowIcon, mobile && styles.rowIconMobile]}><MoreIcon name={item.icon} /></View>
        <AppIcon symbol="›" style={styles.chevron} />
      </View>
      <Text style={styles.rowTitle}>{item.title}</Text>
      <Text style={styles.rowCaption}>{item.caption}</Text>
      </>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: pagePadding }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentInner}>
            <AdminPageHeading title="More" titleStyle={styles.title} />
            <View style={[styles.contextGrid, !mobile && styles.contextGridWide, { columnGap: contextGap, rowGap: contextGap }]}>
            <View style={[styles.branchCard, contextCardStyle]}>
              <View style={styles.branchDot} />
              <View style={styles.flex}>
                <Text style={styles.branchTitle}>{branch || 'All branches'}</Text>
                <Text style={styles.rowCaption}>One Branch, Every Module</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change More branch"
                onPress={() => setBranchPicker(true)}
                style={styles.change}
              >
                <Text style={styles.link}>Change</Text>
              </Pressable>
            </View>
            <View style={[styles.profileCard, contextCardStyle]}>
              <View style={styles.profileAvatar}>
                <Text style={styles.avatarText}><UserInitials /></Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.profileTitle}>{scope?.user.name || 'Loading profile...'}</Text>
                <Text style={styles.subtitle}>{scope?.role.toUpperCase().replace(/_/g, ' ') || ''}</Text>
              </View>
            </View>
            </View>
            {moduleSections.map(section => section.items.length > 0 && (
              <View key={section.title} style={styles.moduleSection}>
                <Text style={styles.moduleSectionTitle}>{section.title}</Text>
                {mobile ? (
                  <View style={[styles.moduleGrid, { columnGap: moduleGap, rowGap: moduleGap }]}>
                    {section.items.map(renderModuleCard)}
                  </View>
                ) : (
                  <View style={styles.moduleRows}>
                    {section.items.filter((_, index) => index % 3 === 0).map((first, rowIndex) => {
                      const items = section.items.slice(rowIndex * 3, rowIndex * 3 + 3);
                      return <View key={first.title} style={styles.moduleRow}>
                        {items.map(item => <View key={item.title} style={styles.moduleCell}>{renderModuleCard(item)}</View>)}
                        {Array.from({ length: 3 - items.length }, (_, index) => <View key={`empty-${index}`} style={styles.moduleCell} />)}
                      </View>;
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
        {!desktop && <AdminBottomNavigation />}
      </View>
      <Modal
        transparent
        visible={branchPicker || !!notice}
        animationType="fade"
        onRequestClose={() => { setBranchPicker(false); setNotice(''); }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.headerRow}>
              <Text style={[styles.profileTitle, styles.flex]}>
                {branchPicker ? 'Choose branch' : notice}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close More dialog"
                onPress={() => { setBranchPicker(false); setNotice(''); }}
                style={styles.change}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>
            {branchPicker ? (
              <ScrollView>
                <BranchOptionsStatus
                  loading={branchesLoading}
                  error={branchesError}
                  empty={branches.length === 0}
                  onRetry={refreshBranches}
                />
                {['', ...branches].map(value => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${value || 'All branches'}`}
                    accessibilityState={{ selected: branch === value }}
                    onPress={() => {
                      const branchId = availableBranches.find(item => item.name === value)?.id ?? null;
                      void selectAdminBranch(branchId).then(() => setBranchPicker(false)).catch(error => setNotice(error instanceof Error ? error.message : 'Could not change branch.'));
                    }}
                    style={styles.branchOption}
                  >
                    <Text style={styles.filterText}>{value || 'All branches'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.dialogText}>This module is not connected in the current app yet.</Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' },
  page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 },
  content: { flexGrow: 1, paddingTop: 24, paddingBottom: 32 },
  contentInner: { width: '100%', gap: 20 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: '#20334f', marginTop: 6 },
  subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 },
  contextGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  contextGridWide: { flexWrap: 'nowrap' },
  contextCardWide: { flex: 1, minWidth: 0 },
  branchCard: { minWidth: 0, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, backgroundColor: '#fff' },
  branchDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#39b8a7' },
  branchTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: '#20334f' },
  change: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
  link: { fontSize: 11, lineHeight: 17, fontWeight: '600', color: '#345cf2' },
  profileCard: { minWidth: 0, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' },
  profileAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#345cf2' },
  profileTitle: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: '#20334f' },
  moduleSection: { width: '100%', gap: 12 },
  moduleSectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#20334f' },
  moduleGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'flex-start' },
  moduleRows: { width: '100%', gap: 16 },
  moduleRow: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  moduleCell: { flex: 1, minWidth: 0 },
  moduleCardWide: { width: '100%', flexGrow: 1 },
  moduleCard: { minWidth: 0, minHeight: 148, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' },
  moduleCardMobile: { width: '100%', minHeight: 68, alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  moduleCardMobileRow: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  moduleCardCopy: { flex: 1, minWidth: 0 },
  moduleCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  moduleCardTopMobile: { marginBottom: 7 },
  rowIcon: { width: 36, height: 36, flexShrink: 0, borderRadius: 11, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' },
  rowIconMobile: { width: 30, height: 30, borderRadius: 9 },
  rowTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: '#20334f' },
  rowCaption: { fontSize: 11, lineHeight: 17, color: '#71829c', marginTop: 5, flexShrink: 1 },
  rowCaptionMobile: { fontSize: 10, lineHeight: 14, color: '#71829c', marginTop: 1, flexShrink: 1 },
  chevron: { fontSize: 22, color: '#8192ad' },
  pressed: { opacity: 0.75 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterText: { fontSize: 12, lineHeight: 18, color: '#405573' },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' },
  modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, borderRadius: 18, backgroundColor: '#fff' },
  branchOption: { minHeight: 48, padding: 12, justifyContent: 'center' },
  dialogText: { fontSize: 14, lineHeight: 22, color: '#405573', marginTop: 16 },
});
