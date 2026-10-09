import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEmployees, type Employee } from '../../../src/core/employees';

const requestsKey = 'branchsuite:my-attendance-requests:v1';
const statusFilters = ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'] as const;
type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';
type RequestType = 'leave' | 'correction';
type ApprovalRequest = {
  id: string; type: RequestType; startDate: string; endDate: string;
  reason: string; status: Status; createdAt: string; reviewedAt?: string;
  employeeId?: string; employeeName?: string; branch?: string; leaveType?: string;
};

async function readRequests(): Promise<ApprovalRequest[]> {
  const stored = await AsyncStorage.getItem(requestsKey);
  const records: unknown = stored === null ? [] : JSON.parse(stored);
  if (!Array.isArray(records) || !records.every(record => record &&
    ['id', 'startDate', 'endDate', 'reason', 'createdAt'].every(field => typeof record[field] === 'string') &&
    ['leave', 'correction'].includes(record.type) && ['pending', 'approved', 'rejected', 'cancelled'].includes(record.status))) {
    throw new Error('Saved requests could not be read.');
  }
  return records as ApprovalRequest[];
}

function displayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function dateSummary(request: ApprovalRequest): string {
  if (request.type === 'correction') return displayDate(request.startDate);
  const duration = Math.round((Date.parse(request.endDate) - Date.parse(request.startDate)) / 86400000) + 1;
  return `${displayDate(request.startDate)} – ${displayDate(request.endDate)}${Number.isFinite(duration) && duration > 0 ? ` · ${duration} ${duration === 1 ? 'day' : 'days'}` : ''}`;
}

export default function ApprovalsPage() {
  const { styles, columns, columnWrapperStyle } = useAdminLayout(baseStyles, 'list');
  const router = useRouter();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof statusFilters[number]>('All');
  const [type, setType] = useState<RequestType | ''>('');
  const [branch, setBranch] = useState('');
  const [picker, setPicker] = useState<'type' | 'branch' | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [notice, setNotice] = useState('');
  const savingRef = useRef(false);
  const searchRef = useRef<TextInput>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    Promise.all([readRequests(), getEmployees()]).then(([records, team]) => {
      if (active) { setRequests(records); setEmployees(team); }
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load requests. Please retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));

  const employeeFor = (request: ApprovalRequest) => employees.find(employee => employee.id === request.employeeId);
  const nameFor = (request: ApprovalRequest) => request.employeeName || employeeFor(request)?.fullName || 'Personal request';
  const branchFor = (request: ApprovalRequest) => request.branch || employeeFor(request)?.branch || '';
  const typeFor = (request: ApprovalRequest) => request.type === 'leave' ? request.leaveType || 'Leave request' : 'Attendance correction';
  const scoped = requests.filter(request => !branch || branchFor(request) === branch);
  const query = search.trim().toLowerCase();
  const filtered = scoped.filter(request =>
    (filter === 'All' || request.status === filter.toLowerCase()) && (!type || request.type === type) &&
    [nameFor(request), typeFor(request), request.type].some(value => value.toLowerCase().includes(query))
  );
  const branches = [...new Set(requests.map(branchFor).filter(Boolean))].sort();
  const options = picker === 'branch' ? [{ value: '', label: 'All branches' }, ...branches.map(value => ({ value, label: value }))]
    : [{ value: '', label: 'All types' }, { value: 'leave', label: 'Leave requests' }, { value: 'correction', label: 'Attendance corrections' }];
  const decide = async (id: string, status: 'approved' | 'rejected') => {
    if (savingRef.current) return;
    savingRef.current = true; setSavingId(id); setDecisionError(''); setNotice('');
    try {
      const records = await readRequests();
      const current = records.find(request => request.id === id);
      if (!current) throw new Error('Request could not be found.');
      if (current.status !== 'pending') { setRequests(records); throw new Error('This request has already been reviewed.'); }
      const updated = records.map(request => request.id === id ? { ...request, status, reviewedAt: new Date().toISOString() } : request);
      await AsyncStorage.setItem(requestsKey, JSON.stringify(updated));
      setRequests(updated); setNotice(`Request ${status}.`);
    } catch (error) { setDecisionError(error instanceof Error ? error.message : 'Could not save the decision. Please retry.'); }
    finally { savingRef.current = false; setSavingId(null); }
  };

  const listHeader = (
    <View>
      <Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>Approvals</Text><Text style={styles.subtitle}>Clear requests. Clear decisions.</Text>
      <View style={styles.summaryGrid}>
        {([{ label: 'Leave requests', type: 'leave', caption: 'Waiting for review', icon: '▦' }, { label: 'Corrections', type: 'correction', caption: 'Attendance requests', icon: '◷' }] as const).map(summary => <View key={summary.type} style={styles.summaryCard}><View style={styles.summaryHeading}><Text style={styles.summaryIcon}>{summary.icon}</Text><Text style={styles.summaryLabel}>{summary.label}</Text></View><Text style={styles.summaryValue}>{loading || loadError ? '—' : scoped.filter(request => request.type === summary.type && request.status === 'pending').length}</Text><Text style={styles.summaryCaption}>{summary.caption}</Text></View>)}
      </View>
      <View style={styles.searchField}><Text style={styles.searchGlyph}>⌕</Text><TextInput ref={searchRef} accessibilityLabel="Search requests" placeholder="Search employee or request type" placeholderTextColor="#8c96a6" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} style={styles.searchInput} />{search !== '' && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} style={styles.clearSearch}><Text style={styles.chevron}>×</Text></Pressable>}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>{statusFilters.map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: filter === label }} onPress={() => setFilter(label)} style={[styles.filterTab, filter === label && styles.selectedFilter]}><Text style={[styles.filterText, filter === label && styles.selectedText]}>{label}</Text></Pressable>)}</ScrollView>
      <Text style={styles.label}>Request type</Text><Pressable accessibilityRole="button" accessibilityLabel="Request type" onPress={() => setPicker('type')} style={styles.typeSelect}><Text style={styles.inputText}>{type === 'leave' ? 'Leave requests' : type === 'correction' ? 'Attendance corrections' : 'All types'}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
      {notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      {decisionError !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{decisionError}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={[styles.between, styles.headerIdentity]}><View style={styles.flex}><Text style={styles.companyName}>{/* Company name */}</Text><Text style={styles.headerCaption}>Business workspace</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Focus request search" onPress={() => searchRef.current?.focus()} style={styles.headerIcon}><Text style={styles.headerSearchGlyph}>⌕</Text></Pressable><View style={styles.avatar}>{/* Profile initial */}</View></View>
          <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerFilterLabel}>Company</Text><Text style={styles.chevron}>⌄</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Choose branch" onPress={() => setPicker('branch')} style={[styles.headerFilter, styles.branchFilter]}><Text style={styles.headerFilterLabel}>Branch</Text><Text numberOfLines={1} style={styles.branchSelection}>{branch || 'All branches'}</Text><Text style={styles.chevron}>⌄</Text></Pressable></View>
        </View>
        <FlatList key={columns} numColumns={columns} columnWrapperStyle={columns > 1 ? columnWrapperStyle : undefined}
          data={loading || loadError ? [] : filtered}
          keyExtractor={request => request.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading requests" color="#345cf2" style={styles.loading} /> : loadError ? <View style={styles.empty}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View> : <View style={styles.empty}><Text style={styles.emptyTitle}>{requests.length === 0 ? 'No requests yet' : 'No matching requests'}</Text><Text style={styles.subtitle}>{requests.length === 0 ? 'Saved leave and correction requests will appear here.' : 'Try another search, status or request type.'}</Text></View>}
          renderItem={({ item }) => (
            <View style={[styles.card, styles.listItem]}>
              <View style={styles.between}><View style={styles.initialBadge}><Text style={styles.initial}>{nameFor(item).split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.name}>{nameFor(item)}</Text><Text style={styles.requestType}>{typeFor(item)}</Text></View><View style={[styles.statusBadge, item.status === 'approved' && styles.approvedBadge, item.status === 'rejected' && styles.rejectedBadge, item.status === 'cancelled' && styles.cancelledBadge]}><Text style={styles.statusText}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text></View></View>
              <Text style={styles.dateSummary}>{dateSummary(item)}</Text><Text style={styles.reason}>{item.reason}</Text>
              {item.status === 'pending' && <View style={styles.decisionButtons}><Pressable accessibilityRole="button" accessibilityLabel={`Reject ${nameFor(item)} ${typeFor(item)}`} disabled={savingId !== null} onPress={() => decide(item.id, 'rejected')} style={[styles.rejectButton, savingId !== null && styles.dim]}><Text style={styles.rejectText}>{savingId === item.id ? 'Saving…' : 'Reject'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Approve ${nameFor(item)} ${typeFor(item)}`} disabled={savingId !== null} onPress={() => decide(item.id, 'approved')} style={[styles.approveButton, savingId !== null && styles.dim]}><Text style={styles.approveText}>{savingId === item.id ? 'Saving…' : 'Approve'}</Text></Pressable></View>}
            </View>
          )}
        />
        <View style={styles.navigation}>{([{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }] as const).map(tab => <Pressable key={tab.label} accessibilityRole="tab" accessibilityState={{ selected: tab.label === 'More' }} onPress={tab.label === 'Home' ? () => router.replace('/admin/dashboard') : tab.label === 'People' ? () => router.push('/admin/employees/people') : tab.label === 'Payroll' ? () => router.push('/admin/payroll') : undefined} style={styles.navItem}><View style={[styles.navIcon, tab.label === 'More' && styles.selectedFilter]}><Text style={[styles.navGlyph, tab.label === 'More' && styles.selectedText]}>{tab.icon}</Text></View><Text style={[styles.navLabel, tab.label === 'More' && styles.selectedText]}>{tab.label}</Text></Pressable>)}</View>
      </View>
      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.between}><Text style={styles.modalTitle}>{picker === 'branch' ? 'Choose branch' : 'Request type'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close picker" onPress={() => setPicker(null)} style={styles.close}><Text style={styles.chevron}>×</Text></Pressable></View><ScrollView>{options.map(option => <Pressable accessibilityRole="button" key={option.value} onPress={() => { if (picker === 'branch') setBranch(option.value); else setType(option.value as RequestType | ''); setPicker(null); }} style={styles.option}><Text style={styles.inputText}>{option.label}</Text><Text style={styles.link}>{(picker === 'branch' ? branch : type) === option.value ? '✓' : ''}</Text></Pressable>)}</ScrollView></View></View></Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }, flex: { flex: 1 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, companyName: { minHeight: 18, fontSize: 14, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, color: '#8794aa', marginTop: 4 }, headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' }, headerSearchGlyph: { fontSize: 26, color: '#304560' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff', gap: 6 }, branchFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, headerFilterLabel: { fontSize: 9, color: '#8492a9' }, branchSelection: { flex: 1, fontSize: 9, color: '#405573' }, chevron: { fontSize: 21, color: '#8798b1' },
  list: { padding: 16, paddingTop: 24, paddingBottom: 28, gap: 14 }, eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 2, color: '#8192ad' }, title: { fontSize: 25, fontWeight: '800', color: '#20334f', letterSpacing: -0.7, marginTop: 10 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#7a8ba5', marginTop: 5 }, summaryGrid: { flexDirection: 'row', gap: 12, marginTop: 22, marginBottom: 18 }, summaryCard: { flex: 1, padding: 15, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e8f5' }, summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, summaryIcon: { fontSize: 17, color: '#345cf2' }, summaryLabel: { fontSize: 10, color: '#607591' }, summaryValue: { fontSize: 25, fontWeight: '800', color: '#20334f', marginTop: 9 }, summaryCaption: { fontSize: 9, color: '#8192ad', marginTop: 7 },
  searchField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e1e8f4', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 13, minHeight: 46 }, searchGlyph: { fontSize: 22, color: '#7a8ba5', marginRight: 9 }, searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 13, color: '#20334f' }, clearSearch: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' }, filterTabs: { gap: 7, paddingTop: 12, paddingBottom: 4 }, filterTab: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', borderRadius: 12 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, filterText: { fontSize: 10, fontWeight: '600', color: '#405573' }, selectedText: { color: '#345cf2' }, label: { fontSize: 12, fontWeight: '600', color: '#405573', marginTop: 14, marginBottom: 8 }, typeSelect: { minHeight: 46, borderRadius: 13, backgroundColor: '#fcfdff', borderWidth: 1, borderColor: '#dce5f3', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, inputText: { fontSize: 13, color: '#20334f' },
  notice: { marginTop: 12, color: '#34856c', fontSize: 12 }, error: { marginTop: 10, color: '#b94d61', fontSize: 12 }, loading: { marginTop: 25 }, empty: { padding: 22, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e4eaf5' }, emptyTitle: { fontSize: 15, fontWeight: '700', color: '#20334f' }, retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { fontSize: 12, fontWeight: '600', color: '#345cf2' }, card: { padding: 15, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e8f5' }, initialBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e1f5ee' }, initial: { fontSize: 12, fontWeight: '700', color: '#388d76' }, name: { fontSize: 13, fontWeight: '700', color: '#20334f' }, requestType: { fontSize: 10, lineHeight: 16, color: '#71849f', marginTop: 3 }, statusBadge: { borderRadius: 7, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#fff1d9' }, approvedBadge: { backgroundColor: '#e1f3eb' }, rejectedBadge: { backgroundColor: '#fce8ec' }, cancelledBadge: { backgroundColor: '#edf0f6' }, statusText: { fontSize: 9, color: '#52627c', fontWeight: '600' }, dateSummary: { fontSize: 11, fontWeight: '600', lineHeight: 18, color: '#405573', marginTop: 16 }, reason: { fontSize: 11, lineHeight: 18, color: '#8192ad', marginTop: 5 }, decisionButtons: { flexDirection: 'row', gap: 10, marginTop: 16 }, rejectButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#fce8ec', alignItems: 'center', justifyContent: 'center' }, rejectText: { fontSize: 12, fontWeight: '600', color: '#b94d61' }, approveButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#e1f3eb', alignItems: 'center', justifyContent: 'center' }, approveText: { fontSize: 12, fontWeight: '600', color: '#34856c' }, dim: { opacity: 0.6 },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navIcon: { minWidth: 46, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, navGlyph: { fontSize: 22, color: '#71829c' }, navLabel: { fontSize: 9, color: '#71829c' }, overlay: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', padding: 22, borderRadius: 20, backgroundColor: '#fff' }, modalTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#20334f' }, close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, option: { paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#edf1f8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
