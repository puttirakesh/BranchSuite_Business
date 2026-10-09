import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEmployees, setEmployeeStatus, setEmployeeLoginEnabled, type Employee } from '../../../src/core/employees';

const filters = ['All', 'Active', 'Inactive', 'Login enabled', 'No login'] as const;
type Filter = typeof filters[number];
const pageSize = 12;
const isActive = (employee: Employee) => employee.status !== 'inactive';
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();

export default function EmployeesPage({ defaultFilter = 'Active' }: { defaultFilter?: Filter }) {
  const router = useRouter();
  const { added, filter: requestedFilter } = useLocalSearchParams<{ added?: string; filter?: string }>();
  const initialFilter = filters.find(value => value.toLowerCase() === requestedFilter?.toLowerCase()) || defaultFilter;
  const searchRef = useRef<TextInput>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [branch, setBranch] = useState('');
  const [branchPicker, setBranchPicker] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [savingAction, setSavingAction] = useState<'status' | 'login' | null>(null);
  const savingStatus = savingAction !== null;
  const [statusError, setStatusError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const statusSavingRef = useRef(false);

  const closeDialog = () => {
    if (statusSavingRef.current) return;
    setBranchPicker(false);
    setSelected(null);
    setStatusError('');
    setStatusNotice('');
  };
  const changeSetting = async (action: 'status' | 'login') => {
    if (!selected || statusSavingRef.current) return;
    const nextStatus = isActive(selected) ? 'inactive' : 'active';
    statusSavingRef.current = true;
    setSavingAction(action);
    setStatusError('');
    setStatusNotice('');
    try {
      const updated = action === 'status'
        ? await setEmployeeStatus(selected.id, nextStatus)
        : await setEmployeeLoginEnabled(selected.id, selected.loginEnabled !== true);
      setEmployees(current => current.map(employee => employee.id === updated.id ? updated : employee));
      setSelected(updated);
      setStatusNotice(action === 'status' ? `Employee marked ${nextStatus}.` : `Employee login ${updated.loginEnabled ? 'enabled' : 'disabled'}.`);
    } catch {
      setStatusError(action === 'status' ? 'Could not update employee status. Please try again.' : 'Could not update employee login setting. Please try again.');
    } finally {
      statusSavingRef.current = false;
      setSavingAction(null);
    }
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    setFilter(initialFilter);
    getEmployees().then(records => {
      if (active) { setEmployees(records); setPage(0); }
    }).catch(() => {
      if (active) setError('Could not load employees. Please try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt, initialFilter]));

  const branches = [...new Set(employees.map(employee => employee.branch).filter(Boolean))].sort();
  const scoped = employees.filter(employee => !branch || employee.branch === branch);
  const query = search.trim().toLowerCase();
  const filtered = scoped.filter(employee => {
    const matchesSearch = [employee.fullName, employee.email, employee.branch].some(value => value.toLowerCase().includes(query));
    const matchesFilter = filter === 'All' || (filter === 'Active' && isActive(employee)) ||
      (filter === 'Inactive' && !isActive(employee)) || (filter === 'Login enabled' && employee.loginEnabled === true) ||
      (filter === 'No login' && employee.loginEnabled !== true);
    return matchesSearch && matchesFilter;
  });
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const start = currentPage * pageSize;
  const pageEmployees = filtered.slice(start, start + pageSize);
  const summary = [
    { label: 'employees', value: scoped.length },
    { label: 'active', value: scoped.filter(isActive).length },
    { label: 'employee logins', value: scoped.filter(employee => employee.loginEnabled === true).length },
  ];

  const listHeader = (
    <View>
      <View style={styles.heading}>
        <View style={styles.flex}><Text style={styles.title}>Employees</Text><Text style={styles.subtitle}>Create a profile, enable login and assign work.</Text></View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/admin/employees/create')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Text style={styles.addText}>Add employee</Text></Pressable>
      </View>
      {!loading && !error && added && employees.some(employee => employee.id === added) && <Text accessibilityLiveRegion="polite" style={styles.success}>Employee added successfully.</Text>}
      <View style={styles.summary}>
        {summary.map((stat, index) => <View key={stat.label} style={[styles.summaryItem, index !== 0 && styles.summaryDivider]}><Text style={styles.summaryValue}>{loading || error ? '—' : stat.value}</Text><Text style={styles.summaryLabel}>{stat.label}</Text></View>)}
      </View>
      <View style={styles.searchField}>
        <Text style={styles.searchFieldGlyph}>⌕</Text>
        <TextInput ref={searchRef} accessibilityLabel="Search employees" placeholder="Search name, email or branch" placeholderTextColor="#8c96a6" style={styles.searchInput} value={search} onChangeText={value => { setSearch(value); setPage(0); }} autoCapitalize="none" autoCorrect={false} />
        {search !== '' && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setSearch(''); setPage(0); }} style={styles.clearSearch}><Text style={styles.clearText}>×</Text></Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
        {filters.map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: filter === label }} onPress={() => { setFilter(label); setPage(0); }} style={[styles.filterTab, filter === label && styles.selectedFilter]}><Text style={[styles.filterText, filter === label && styles.selectedText]}>{label}</Text></Pressable>)}
      </ScrollView>
      {!loading && !error && <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{filtered.length} {filtered.length === 1 ? 'employee' : 'employees'}{filtered.length > 0 ? ` · showing ${start + 1}–${start + pageEmployees.length}` : ''}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.between}>
            <View style={styles.flex}><Text style={styles.companyName}>{/* Your company name */}</Text><Text style={styles.headerCaption}>Business workspace</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Focus employee search" onPress={() => searchRef.current?.focus()} style={styles.headerSearch}><Text style={styles.headerSearchGlyph}>⌕</Text></Pressable>
            <View style={styles.headerAvatar}>{/* Your profile initial */}</View>
          </View>
          <View style={styles.headerFilters}>
            <View style={styles.companyFilter}><Text style={styles.headerFilterLabel}>Company</Text>{/* Your company */}<Text style={styles.chevron}>⌄</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose branch" onPress={() => setBranchPicker(true)} style={styles.branchFilter}><Text style={styles.headerFilterLabel}>Branch</Text><Text numberOfLines={1} style={styles.branchSelection}>{branch || 'All branches'}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
          </View>
        </View>

        <FlatList
          data={loading || error ? [] : pageEmployees}
          keyExtractor={employee => employee.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading employees" color="#345cf2" style={styles.loading} /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable></View> : <View style={styles.empty}><Text style={styles.emptyTitle}>{employees.length === 0 ? 'No employees yet' : 'No matching employees'}</Text><Text style={styles.subtitle}>{employees.length === 0 ? 'Add your first employee to get started.' : 'Try another search, branch or filter.'}</Text></View>}
          renderItem={({ item, index }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.fullName}`} onPress={() => setSelected(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.cardBody}>
                <View style={styles.between}>
                  <View style={[styles.avatar, index % 2 === 1 && styles.greenAvatar]}><Text style={[styles.initial, index % 2 === 1 && styles.greenInitial]}>{initials(item.fullName)}</Text></View>
                  <View style={styles.flex}><Text style={styles.name}>{item.fullName}</Text><Text style={styles.description}>{item.department || item.jobTitle || item.email}</Text></View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <View style={styles.cardMeta}><Text style={styles.branchName}>{item.branch}</Text><View style={[styles.status, !isActive(item) && styles.inactiveStatus]}><Text style={[styles.statusText, !isActive(item) && styles.inactiveText]}>{isActive(item) ? 'Active' : 'Inactive'}</Text></View></View>
              </View>
              <View style={styles.cardFooter}><View style={styles.lockIcon}><View style={[styles.lockShackle, item.loginEnabled && styles.enabledLock]} /><View style={[styles.lockBody, item.loginEnabled && styles.enabledLock]} /></View><Text style={styles.loginText}>{item.loginEnabled ? 'Employee login enabled' : 'Employee login not enabled'}</Text></View>
            </Pressable>
          )}
          ListFooterComponent={!loading && !error && filtered.length > pageSize ? <View style={styles.pagination}><Pressable accessibilityRole="button" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} style={[styles.pageButton, currentPage === 0 && styles.disabled]}><Text style={styles.retryText}>Previous</Text></Pressable><Text style={styles.pageCount}>{currentPage + 1} / {Math.ceil(filtered.length / pageSize)}</Text><Pressable accessibilityRole="button" disabled={start + pageSize >= filtered.length} onPress={() => setPage(currentPage + 1)} style={[styles.pageButton, start + pageSize >= filtered.length && styles.disabled]}><Text style={styles.retryText}>Next</Text></Pressable></View> : null}
        />

        <View style={styles.navigation}>
          {([{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }] as const).map(tab => <Pressable key={tab.label} accessibilityRole="tab" accessibilityState={{ selected: tab.label === 'People' }} onPress={tab.label === 'Home' ? () => router.replace('/admin/dashboard') : undefined} style={styles.navItem}><View style={[styles.navIcon, tab.label === 'People' && styles.selectedNav]}><Text style={[styles.navGlyph, tab.label === 'People' && styles.selectedText]}>{tab.icon}</Text></View><Text style={[styles.navLabel, tab.label === 'People' && styles.selectedText]}>{tab.label}</Text></Pressable>)}
        </View>
      </View>

      <Modal transparent visible={branchPicker || selected !== null} animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.between}><Text style={styles.modalTitle}>{branchPicker ? 'Choose branch' : selected?.fullName}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" disabled={savingStatus} onPress={closeDialog} style={styles.closeButton}><Text style={styles.clearText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {branchPicker ? ['', ...branches].map(value => <Pressable key={value} accessibilityRole="button" onPress={() => { setBranch(value); setPage(0); setBranchPicker(false); }} style={styles.branchOption}><Text style={styles.name}>{value || 'All branches'}</Text><Text style={styles.selectedText}>{branch === value ? '✓' : ''}</Text></Pressable>) : selected && [
              { label: 'Work email', value: selected.email }, { label: 'Phone', value: selected.phone },
              { label: 'Job title', value: selected.jobTitle }, { label: 'Department', value: selected.department },
              { label: 'Branch', value: selected.branch }, { label: 'Reporting manager', value: selected.reportingManager },
              { label: 'Joining date', value: selected.joiningDate }, { label: 'Status', value: isActive(selected) ? 'Active' : 'Inactive' },
              { label: 'Employee login', value: selected.loginEnabled ? 'Enabled' : 'Not enabled' },
            ].map(field => <View key={field.label} style={styles.detailField}><Text style={styles.headerCaption}>{field.label}</Text><Text style={styles.detailValue}>{field.value || '—'}</Text></View>)}
          </ScrollView>
          {!branchPicker && selected && <View style={styles.statusActions}>
            {statusError !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{statusError}</Text>}
            {statusNotice !== '' && <Text accessibilityLiveRegion="polite" style={styles.statusNotice}>{statusNotice}</Text>}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: savingStatus, busy: savingStatus }}
              disabled={savingStatus}
              onPress={() => changeSetting('status')}
              style={({ pressed }) => [styles.statusButton, (pressed || savingStatus) && styles.pressed]}
            >
              <Text style={styles.statusButtonText}>{savingAction === 'status' ? 'Saving…' : isActive(selected) ? 'Mark inactive' : 'Mark active'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: savingStatus, busy: savingAction === 'login' }}
              disabled={savingStatus}
              onPress={() => changeSetting('login')}
              style={({ pressed }) => [styles.statusButton, styles.loginButton, (pressed || savingStatus) && styles.pressed]}
            >
              <Text style={styles.loginButtonText}>{savingAction === 'login' ? 'Saving…' : selected.loginEnabled ? 'Disable login' : 'Enable login'}</Text>
            </Pressable>
            <Text style={styles.loginHint}>Account sign-in is not connected yet.</Text>
          </View>}
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' },
  page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  flex: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e4eaf5' },
  companyName: { minHeight: 18, fontSize: 14, fontWeight: '800', color: '#20334f' },
  headerCaption: { fontSize: 10, color: '#8794aa', marginTop: 4 },
  headerSearch: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fc' },
  headerSearchGlyph: { fontSize: 26, color: '#304560' },
  headerAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' },
  headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 },
  companyFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff', borderRadius: 9, paddingHorizontal: 10 },
  branchFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#d5dfff', backgroundColor: '#eaf0ff', borderRadius: 9, paddingHorizontal: 10 },
  headerFilterLabel: { fontSize: 9, color: '#8492a9' },
  branchSelection: { flex: 1, fontSize: 9, color: '#405573', fontWeight: '600' },
  chevron: { fontSize: 20, color: '#8798b1' },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 22, marginBottom: 22 },
  title: { fontSize: 25, fontWeight: '800', color: '#20334f', letterSpacing: -0.7 },
  subtitle: { fontSize: 11, lineHeight: 18, color: '#7a8ba5', marginTop: 5 },
  addButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 13, justifyContent: 'center', backgroundColor: '#345cf2' },
  addText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  pressed: { opacity: 0.8 },
  success: { fontSize: 12, color: '#428671', backgroundColor: '#e6f4ee', padding: 14, borderRadius: 12, marginBottom: 16 },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, paddingVertical: 18, marginBottom: 16 },
  summaryItem: { flex: 1, paddingHorizontal: 14 },
  summaryDivider: { borderLeftWidth: 1, borderLeftColor: '#f0f3f9' },
  summaryValue: { fontSize: 23, fontWeight: '800', color: '#304968' },
  summaryLabel: { fontSize: 9, color: '#71849f', marginTop: 5 },
  searchField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e1e8f4', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 13, minHeight: 46 },
  searchFieldGlyph: { fontSize: 22, color: '#7a8ba5', marginRight: 9 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 13, color: '#20334f' },
  clearSearch: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 25, color: '#8794aa' },
  filterTabs: { gap: 7, paddingTop: 14, paddingBottom: 5 },
  filterTab: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', borderRadius: 12 },
  selectedFilter: { borderColor: '#d5dfff', backgroundColor: '#eaf0ff' },
  filterText: { fontSize: 10, fontWeight: '600', color: '#405573' },
  selectedText: { color: '#345cf2' },
  resultCount: { fontSize: 10, color: '#8192ad', marginTop: 16, marginBottom: 3 },
  loading: { marginTop: 25 },
  empty: { backgroundColor: '#fff', padding: 22, borderRadius: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#20334f' },
  error: { color: '#b94d61', fontSize: 13 },
  retryButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 6 },
  retryText: { color: '#345cf2', fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#e0e8f5', overflow: 'hidden' },
  cardBody: { padding: 16 },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff', borderWidth: 1, borderColor: '#dfe7ff' },
  initial: { color: '#345cf2', fontWeight: '700', fontSize: 12 },
  greenAvatar: { backgroundColor: '#e5f4ee', borderColor: '#d5eee4' },
  greenInitial: { color: '#388d76' },
  name: { fontSize: 13, fontWeight: '700', color: '#20334f' },
  description: { fontSize: 10, lineHeight: 16, color: '#71849f', marginTop: 3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 16 },
  branchName: { flex: 1, fontSize: 10, color: '#8192ad' },
  status: { borderRadius: 7, backgroundColor: '#e1f3eb', paddingVertical: 5, paddingHorizontal: 9 },
  statusText: { fontSize: 9, fontWeight: '600', color: '#34856c' },
  inactiveStatus: { backgroundColor: '#f0f2f7' },
  inactiveText: { color: '#8994a7' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: '#edf1f8', backgroundColor: '#fafbff', paddingHorizontal: 16, paddingVertical: 10 },
  lockIcon: { width: 10, height: 12, alignItems: 'center' },
  lockShackle: { width: 6, height: 6, borderWidth: 1, borderColor: '#8a9bb3', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  lockBody: { width: 9, height: 7, marginTop: -1, borderWidth: 1, borderColor: '#8a9bb3', borderRadius: 1, backgroundColor: '#fafbff' },
  enabledLock: { borderColor: '#388d76' },
  loginText: { fontSize: 9, color: '#7b8da8' },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pageButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#fff', borderRadius: 10 },
  disabled: { opacity: 0.4 },
  pageCount: { fontSize: 11, color: '#8192ad' },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5', paddingTop: 8, paddingBottom: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navIcon: { minWidth: 46, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  selectedNav: { backgroundColor: '#eaf0ff' },
  navGlyph: { fontSize: 22, color: '#71829c' },
  navLabel: { fontSize: 9, color: '#71829c' },
  overlay: { flex: 1, backgroundColor: 'rgba(27, 43, 68, 0.3)', padding: 24, justifyContent: 'center' },
  modal: { width: '100%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 22 },
  modalTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#20334f' },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  branchOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
  detailField: { paddingVertical: 10 },
  detailValue: { fontSize: 13, color: '#405573', marginTop: 6 },
  statusActions: { borderTopWidth: 1, borderTopColor: '#edf1f8', paddingTop: 14, gap: 12 },
  statusNotice: { fontSize: 12, color: '#34856c' },
  statusButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center', padding: 12 },
  statusButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loginButton: { backgroundColor: '#eaf0ff' },
  loginButtonText: { color: '#345cf2', fontSize: 13, fontWeight: '700' },
  loginHint: { fontSize: 10, color: '#8794aa', lineHeight: 15 },
});
