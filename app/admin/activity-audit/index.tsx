import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FiHome, FiTrendingUp, FiUserPlus, FiCreditCard, FiMoreHorizontal } from '../../../src/ui/FeatherIcons';
import { getEmployees } from '../../../src/core/employees';
import { readLeads, type LeadActivity } from '../crm/index';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';
import type { Task } from '../tasks/index';

type AuditEntry = { id: string; title: string; detail: string; actor: string; branch: string; createdAt: string };
const activityTitles: Record<LeadActivity['kind'], string> = { call: 'Call logged', activity: 'Lead activity added', edit: 'Lead edited', opportunity: 'Opportunity created', customer: 'Lead converted to customer' };
const tabs = [
  { label: 'Home', route: '/admin/dashboard', icon: FiHome }, { label: 'CRM', route: '/admin/crm', icon: FiTrendingUp },
  { label: 'People', route: '/admin/employees/people', icon: FiUserPlus }, { label: 'Payroll', route: '/admin/payroll', icon: FiCreditCard },
  { label: 'More', route: '/admin/more', icon: FiMoreHorizontal },
] as const;
const dateLabel = (value: string) => new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

export default function ActivityAuditPage() {
  const { styles, recordGrid } = useAdminLayout(baseStyles);
  const { desktop } = useAdminViewport();
  const router = useRouter();
  const params = useLocalSearchParams<{ branch?: string }>();
  const [branch, setBranch] = useState(params.branch || '');
  const [branchPicker, setBranchPicker] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([readLeads(), getEmployees(), AsyncStorage.getItem('branchsuite:tasks:v1')]).then(([leads, employees, stored]) => {
      const tasks: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(tasks) || !tasks.every(task => task && typeof task.id === 'string' && typeof task.title === 'string' && typeof task.employeeId === 'string')) throw new Error('Saved tasks could not be read.');
      const records: AuditEntry[] = [];
      const add = (entry: AuditEntry) => { if (typeof entry.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt))) records.push(entry); };
      leads.forEach(lead => {
        add({ id: `lead:${lead.id}`, title: 'Lead created', detail: lead.organisation, actor: 'Actor not recorded', branch: lead.branch, createdAt: lead.createdAt });
        (lead.history || []).forEach(entry => add({ id: `lead:${lead.id}:${entry.id}`, title: activityTitles[entry.kind] || 'Lead updated', detail: [lead.organisation, entry.note].filter(Boolean).join(' · '), actor: 'Actor not recorded', branch: lead.branch, createdAt: entry.createdAt }));
      });
      employees.forEach(employee => add({ id: `employee:${employee.id}`, title: 'Employee added', detail: employee.fullName, actor: 'Actor not recorded', branch: employee.branch, createdAt: employee.createdAt }));
      (tasks as Task[]).forEach(task => {
        const employee = employees.find(record => record.id === task.employeeId);
        add({ id: `task:${task.id}`, title: 'Task assigned', detail: [task.title, employee?.fullName].filter(Boolean).join(' → '), actor: task.assignedBy || 'Actor not recorded', branch: task.branch || employee?.branch || '', createdAt: task.createdAt });
        (task.history || []).forEach(entry => add({ id: `task:${task.id}:${entry.id}`, title: entry.kind === 'edit' ? 'Task edited / reassigned' : entry.status === 'completed' ? 'Task completed' : 'Task progress updated', detail: [task.title, entry.note].filter(Boolean).join(' · '), actor: 'Actor not recorded', branch: task.branch || employee?.branch || '', createdAt: entry.createdAt }));
      });
      records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
      if (active) setEntries(records);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load the audit trail.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));
  const branches = [...new Set(entries.map(entry => entry.branch).filter(Boolean))].sort();
  const visible = entries.filter(entry => !branch || entry.branch === branch);
  const cardWidth = recordGrid.cardWidth;
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}><View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}>BranchSuite</Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>BranchSuite</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Choose audit branch" onPress={() => setBranchPicker(true)} style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.filterText}>{branch || 'All branches'}</Text><Text style={styles.headerCaption}>{'\u2304'}</Text></Pressable></View></View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Back to More" onPress={() => router.push('/admin/more')} style={styles.back}><Text style={styles.backGlyph}>{'\u2039'}</Text></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>BUSINESS WORKSPACE</Text><Text style={styles.title}>Audit trail</Text><Text style={styles.subtitle}>Every meaningful change has a record.</Text></View>{desktop && <Pressable accessibilityRole="button" accessibilityLabel="Choose audit branch" onPress={() => setBranchPicker(true)} style={styles.branchButton}><Text style={styles.link}>{branch || 'All branches'} {'\u2304'}</Text></Pressable>}</View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading audit trail" color="#345cf2" /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry audit trail" onPress={() => setAttempt(value => value + 1)} style={styles.branchButton}><Text style={styles.link}>Retry</Text></Pressable></View> : <>
        <View style={styles.auditGrid}>{visible.map(entry => <View key={entry.id} testID="audit-entry" style={[styles.auditCard, { width: cardWidth }]}><Text style={styles.eventTitle}>{entry.title}</Text>{entry.detail ? <Text style={styles.eventDetail}>{entry.detail}</Text> : null}<View style={styles.eventFooter}><Text style={styles.actor}>{entry.actor}</Text><Text style={styles.timestamp}>{dateLabel(entry.createdAt)}</Text></View></View>)}</View>
        {!visible.length && <View style={styles.empty}><Text style={styles.eventTitle}>No activity yet</Text><Text style={styles.subtitle}>Saved lead, employee and task activity will appear here{branch ? ` for ${branch}` : ''}.</Text></View>}
        <Text style={styles.footer}>Activity from saved records · BranchSuite</Text>
      </>}
    </ScrollView>
    {!desktop && <AdminBottomNavigation />}
  </View><Modal visible={branchPicker} transparent animationType="fade" onRequestClose={() => setBranchPicker(false)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.headerRow}><Text style={[styles.eventTitle, styles.flex]}>Choose branch</Text><Pressable accessibilityRole="button" accessibilityLabel="Close audit branch picker" onPress={() => setBranchPicker(false)} style={styles.branchButton}><Text style={styles.link}>Close</Text></Pressable></View><ScrollView>{['', ...branches].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Select ${value || 'All branches'}`} accessibilityState={{ selected: branch === value }} onPress={() => { setBranch(value); setBranchPicker(false); }} style={styles.branchOption}><Text style={styles.filterText}>{value || 'All branches'}</Text></Pressable>)}</ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 },
  header: { padding: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#8192ad' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, minHeight: 34, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 10, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#f7f9ff' }, filterText: { fontSize: 11, color: '#405573', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingTop: 24, paddingBottom: 32, gap: 12 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }, back: { width: 36, height: 36, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, backGlyph: { fontSize: 24, color: '#405573' }, eyebrow: { fontSize: 9, letterSpacing: 1.5, fontWeight: '700', color: '#71829c' }, title: { fontSize: 25, lineHeight: 33, fontWeight: '800', color: '#20334f', marginTop: 6 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 }, branchButton: { minHeight: 44, padding: 10, justifyContent: 'center' }, link: { fontSize: 11, lineHeight: 17, fontWeight: '600', color: '#345cf2' },
  auditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, auditCard: { minWidth: 0, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' }, eventTitle: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#20334f' }, eventDetail: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 12 }, eventFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 6, borderTopWidth: 1, borderTopColor: '#edf1f8', marginTop: 16, paddingTop: 12 }, actor: { flexShrink: 1, fontSize: 10, lineHeight: 16, color: '#71829c' }, timestamp: { flexShrink: 1, fontSize: 10, lineHeight: 16, color: '#71829c' },
  empty: { padding: 20, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', gap: 8 }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' }, footer: { fontSize: 10, lineHeight: 16, textAlign: 'center', color: '#8192ad', marginTop: 20 },
  navigation: { flexDirection: 'row', padding: 6, borderTopWidth: 1, borderTopColor: '#e4eaf5', backgroundColor: '#fff' }, navItem: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 4 }, navIcon: { width: 48, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navLabel: { fontSize: 9, lineHeight: 14, color: '#71829c', marginTop: 3 }, nativeIcon: { fontSize: 20, color: '#71829c' },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, backgroundColor: '#fff', borderRadius: 18 }, branchOption: { minHeight: 48, padding: 12, justifyContent: 'center' },
});
