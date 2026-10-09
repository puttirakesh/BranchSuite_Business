import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEmployees, type Employee } from '../../../src/core/employees';

type Request = { type: string; status: string; branch?: string; employeeId?: string };

export default function PeoplePage() {
  const { styles } = useAdminLayout(baseStyles, 'page');
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [branch, setBranch] = useState('');
  const [modal, setModal] = useState<'branch' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([getEmployees(), AsyncStorage.getItem('branchsuite:my-attendance-requests:v1')]).then(([team, stored]) => {
      const records: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(records) || !records.every(item => item && typeof item.type === 'string' && typeof item.status === 'string')) throw new Error('Saved requests could not be read.');
      if (active) { setEmployees(team); setRequests(records); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your workspace.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));

  const branches = [...new Set([...employees.map(item => item.branch), ...requests.map(item => item.branch || '')].filter(Boolean))].sort();
  const team = employees.filter(item => !branch || item.branch === branch);
  const pending = requests.filter(item => item.status === 'pending' && ['leave', 'correction'].includes(item.type) && (!branch || (item.branch || employees.find(employee => employee.id === item.employeeId)?.branch) === branch)).length;
  const count = (value: number) => loading || error ? '—' : String(value);
  const workspaces = [
    { title: 'Employee directory', description: 'Profiles and team details', icon: '♧', tone: '#e8eeff', color: '#345cf2', badge: count(team.length), open: () => router.push('/admin/employees') },
    { title: 'Team attendance', description: 'Today’s shift and exceptions', icon: '◷', tone: '#def6ef', color: '#138f80', badge: '—', open: () => router.push({ pathname: '/admin/attendance/team', params: { branch } }) },
    { title: 'Approvals', description: 'Leave and correction requests', icon: '◇', tone: '#eee7ff', color: '#7853c8', badge: count(pending), open: () => router.push('/admin/approvals') },
    { title: 'People reports', description: 'Preview, PDF and CSV', icon: '▥', tone: '#e8eeff', color: '#345cf2', badge: '', open: () => router.push({ pathname: '/admin/reports', params: { branch } }) },
  ];

  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    <View style={styles.header}>
      <View style={[styles.row, styles.headerIdentity]}><View style={styles.flex}><Text style={styles.companyName}>{/* Your company name */}</Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.headerIcon}><Text style={styles.search}>⌕</Text></View><View style={styles.avatar} /></View>
      <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.chevron}>⌄</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Choose branch" onPress={() => setModal('branch')} style={[styles.headerFilter, styles.blueBackground]}><Text numberOfLines={1} style={styles.branchLabel}>{branch || 'All branches'}</Text><Text style={styles.chevron}>⌄</Text></Pressable></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}><Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={() => router.replace('/admin/dashboard')} style={styles.back}><Text style={styles.chevron}>‹</Text></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>People</Text><Text style={styles.subtitle}>Your team, attendance and approvals.</Text></View><Pressable accessibilityRole="button" onPress={() => router.push('/admin/employees/create')} style={styles.addButton}><Text style={styles.addText}>Add employee</Text></Pressable></View>
      <View style={styles.branchCard}><View style={styles.dot} /><View style={styles.flex}><Text style={styles.branchName}>{branch || 'All branches'}</Text><Text style={styles.small}>One branch, every module</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Change branch" onPress={() => setModal('branch')} style={styles.change}><Text style={styles.link}>Change</Text></Pressable></View>
      {loading && <ActivityIndicator color="#345cf2" accessibilityLabel="Loading People" />}
      {error !== '' && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.change}><Text style={styles.link}>Retry</Text></Pressable></View>}
      <View style={styles.grid}>{workspaces.map(workspace => <Pressable key={workspace.title} accessibilityRole="button" accessibilityLabel={workspace.title} onPress={workspace.open} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.cardBody}><View style={styles.row}><View style={[styles.icon, { backgroundColor: workspace.tone }]}><Text style={[styles.glyph, { color: workspace.color }]}>{workspace.icon}</Text></View>{workspace.badge !== '' ? <View style={styles.countBadge}><Text style={styles.count}>{workspace.badge}</Text></View> : <Text style={styles.chevron}>›</Text>}</View><Text style={styles.cardTitle}>{workspace.title}</Text><Text style={styles.subtitle}>{workspace.description}</Text></View><View style={styles.cardFooter}><Text style={styles.link}>Open workspace</Text><Text style={styles.link}>›</Text></View></Pressable>)}</View>
      <View style={styles.coverage}><View style={styles.row}><Text style={styles.coverageTitle}>Today’s coverage</Text><View style={styles.coverageBadge}><Text style={styles.coverageText}>— present</Text></View></View><View style={styles.track} /><Text style={styles.subtitle}>Team attendance records will appear here when connected.</Text><View style={styles.legend}>{['On leave', 'Need review', 'Not checked in'].map((label, index) => <View key={label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: ['#39b8a7', '#e2a348', '#a0aec5'][index] }]} /><Text style={styles.small}>— {label}</Text></View>)}</View></View>
    </ScrollView>
    <View style={styles.navigation}>{[{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }].map(tab => <Pressable key={tab.label} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: tab.label === 'People' }} onPress={tab.label === 'Home' ? () => router.replace('/admin/dashboard') : tab.label === 'CRM' ? () => router.push('/admin/crm') : tab.label === 'Payroll' ? () => router.push('/admin/payroll') : undefined} style={styles.navItem}><View style={[styles.navIcon, tab.label === 'People' && styles.blueBackground]}><Text style={[styles.navGlyph, tab.label === 'People' && styles.link]}>{tab.icon}</Text></View><Text style={[styles.navLabel, tab.label === 'People' && styles.link]}>{tab.label}</Text></Pressable>)}</View>
  </View><Modal transparent visible={modal !== null} animationType="fade" onRequestClose={() => setModal(null)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.row}><Text style={styles.coverageTitle}>Choose branch</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={() => setModal(null)} style={styles.back}><Text style={styles.chevron}>×</Text></Pressable></View><ScrollView>{['', ...branches].map(value => <Pressable key={value} accessibilityRole="button" onPress={() => { setBranch(value); setModal(null); }} style={styles.option}><Text style={styles.branchName}>{value || 'All branches'}</Text><Text style={styles.link}>{branch === value ? '✓' : ''}</Text></Pressable>)}</ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }, flex: { flex: 1 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, companyName: { minHeight: 18, color: '#20334f', fontWeight: '800', fontSize: 14 }, headerCaption: { fontSize: 9, color: '#8192ad', marginTop: 4 }, headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' }, search: { fontSize: 26, color: '#405573' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff' }, branchLabel: { flex: 1, fontSize: 10, color: '#405573' }, blueBackground: { backgroundColor: '#eaf0ff' }, chevron: { fontSize: 23, color: '#607591' },
  content: { padding: 16, paddingTop: 22, paddingBottom: 32, gap: 16 }, titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, back: { width: 36, height: 36, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e4eaf5', alignItems: 'center', justifyContent: 'center' }, eyebrow: { fontSize: 8, letterSpacing: 2, fontWeight: '700', color: '#8192ad' }, title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.7, color: '#20334f', marginTop: 8 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#7a8ba5', marginTop: 5 }, addButton: { minHeight: 42, paddingHorizontal: 13, backgroundColor: '#345cf2', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, addText: { fontSize: 11, fontWeight: '700', color: '#fff' }, branchCard: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', padding: 12, borderRadius: 17, borderWidth: 1, borderColor: '#e4eaf5' }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#39b8a7' }, branchName: { color: '#20334f', fontSize: 12, fontWeight: '600' }, small: { fontSize: 9, lineHeight: 15, color: '#8192ad' }, change: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }, link: { fontSize: 10, fontWeight: '600', color: '#345cf2' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { width: '46%', flexGrow: 1, borderWidth: 1, borderColor: '#e0e8f5', borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden' }, cardBody: { padding: 14, minHeight: 140 }, icon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, glyph: { fontSize: 23 }, countBadge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#f2f5fc' }, count: { fontSize: 10, fontWeight: '600', color: '#718ab5' }, cardTitle: { fontSize: 13, fontWeight: '700', color: '#20334f', marginTop: 14 }, cardFooter: { minHeight: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f0f3f9', backgroundColor: '#fcfdff' }, pressed: { opacity: 0.7 },
  coverage: { borderWidth: 1, borderColor: '#e0e8f5', borderRadius: 18, padding: 18, backgroundColor: '#fff' }, coverageTitle: { fontSize: 15, fontWeight: '700', color: '#20334f' }, coverageBadge: { backgroundColor: '#e1f3eb', borderRadius: 6, padding: 6 }, coverageText: { color: '#34856c', fontSize: 9 }, track: { height: 4, borderRadius: 2, backgroundColor: '#e8edf5', marginTop: 16 }, legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, legendDot: { width: 5, height: 5, borderRadius: 3 }, errorBox: { padding: 12, backgroundColor: '#fff', borderRadius: 12 }, error: { fontSize: 12, color: '#b94d61' },
  navigation: { flexDirection: 'row', paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navIcon: { width: 46, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, navGlyph: { fontSize: 22, color: '#71829c' }, navLabel: { fontSize: 9, color: '#71829c' }, overlay: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { padding: 22, width: '100%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', borderRadius: 20, backgroundColor: '#fff' }, option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#edf1f8' }, report: { paddingTop: 16 },
});
