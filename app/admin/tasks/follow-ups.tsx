import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FiSearch, FiList, FiPhone, FiCalendar, FiHome, FiTrendingUp, FiUserPlus, FiCreditCard, FiMoreHorizontal } from '../../../src/ui/FeatherIcons';
import { getEmployees, type Employee } from '../../../src/core/employees';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';
import type { Task } from './index';

const filters = ['All', 'Today', 'Open', 'In progress', 'Completed'] as const;
type Filter = typeof filters[number];
const statusLabel = (status: Task['status']) => status === 'pending' || status === 'open' ? 'Open' : status === 'in_progress' ? 'In progress' : status === 'completed' ? 'Completed' : 'Cancelled';
function parseDate(value: string) {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(+match[3], +match[2] - 1, +match[1]);
  return date.getDate() === +match[1] && date.getMonth() === +match[2] - 1 && date.getFullYear() === +match[3] ? date : null;
}
const icons = { search: FiSearch, Task: FiList, Call: FiPhone, Meeting: FiCalendar, 'Follow-up': FiPhone, Home: FiHome, CRM: FiTrendingUp, People: FiUserPlus, Payroll: FiCreditCard, More: FiMoreHorizontal };
function TaskIcon({ name }: { name: keyof typeof icons }) {
  if (Platform.OS === 'web') { const Icon = icons[name]; return <Icon size={15} color="#71829c" />; }
  return <Text style={baseStyles.glyph}>{name === 'Call' || name === 'Follow-up' ? '\u260e' : name === 'Home' ? '\u2302' : name === 'More' ? '\u00b7\u00b7\u00b7' : name === 'CRM' ? '\u2197' : '\u2637'}</Text>;
}

export default function FollowUpsPage() {
  const { styles, recordGrid } = useAdminLayout(baseStyles);
  const { desktop } = useAdminViewport();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [branch, setBranch] = useState('');
  const [branchPicker, setBranchPicker] = useState(false);
  const [page, setPage] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([AsyncStorage.getItem('branchsuite:tasks:v1'), getEmployees()]).then(([stored, records]) => {
      const parsed: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every(task => task && typeof task.id === 'string' && typeof task.title === 'string' && typeof task.employeeId === 'string')) throw new Error('Saved tasks could not be read.');
      if (active) { setTasks(parsed as Task[]); setEmployees(records); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load tasks.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));
  const employeeName = (task: Task) => employees.find(employee => employee.id === task.employeeId)?.fullName || 'Employee unavailable';
  const now = new Date();
  const isToday = (task: Task) => parseDate(task.dueDate)?.toDateString() === now.toDateString();
  const scoped = tasks.filter(task => !branch || task.branch === branch);
  const open = (task: Task) => ['pending', 'open', 'in_progress'].includes(task.status);
  const visible = scoped.filter(task => `${task.title} ${employeeName(task)} ${task.relatedLead || ''}`.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'All' || (filter === 'Today' ? isToday(task) : statusLabel(task.status) === filter)));
  const pageSize = 10;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / pageSize) - 1));
  const shown = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const branches = [...new Set([...tasks.map(task => task.branch), ...employees.map(employee => employee.branch)].filter(Boolean))].sort();
  const cardWidth = recordGrid.cardWidth;
  const updateBranch = (value: string) => { setBranch(value); setPage(0); setBranchPicker(false); };
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}>BranchSuite</Text><Text style={styles.headerCaption}>Business workspace</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Focus task search" onPress={() => searchRef.current?.focus()} style={styles.headerSearch}><TaskIcon name="search" /></Pressable><View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View></View>
      <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>BranchSuite</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Choose follow-ups branch" onPress={() => setBranchPicker(true)} style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.filterText}>{branch || 'All branches'}</Text><Text style={styles.headerCaption}>{'\u2304'}</Text></Pressable></View>
    </View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}><View style={styles.flex}><Text style={styles.title}>Tasks &amp; follow-ups</Text><Text style={styles.subtitle}>Assign an employee, set a due date and track the outcome.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Assign task" onPress={() => router.push('/admin/tasks')} style={styles.primary}><Text style={styles.primaryText}>Assign task</Text></Pressable></View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading follow-ups" color="#345cf2" /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={styles.link}>Retry</Text></Pressable></View> : <>
        <View style={styles.summary}>{[{ label: 'to do', value: scoped.filter(open).length }, { label: 'due today', value: scoped.filter(task => open(task) && isToday(task)).length }, { label: 'completed', value: scoped.filter(task => task.status === 'completed').length }].map((metric, index) => <View key={metric.label} style={[styles.summaryMetric, index > 0 && styles.metricDivider]}><Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.metricLabel}>{metric.label}</Text></View>)}</View>
        <View style={styles.searchBox}><TaskIcon name="search" /><TextInput ref={searchRef} accessibilityLabel="Search tasks or employee" placeholder="Search tasks or employee" value={query} onChangeText={value => { setQuery(value); setPage(0); }} style={styles.searchText} /></View>
        <View style={styles.filters}>{filters.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show ${value} tasks`} accessibilityState={{ selected: filter === value }} onPress={() => { setFilter(value); setPage(0); }} style={[styles.filter, filter === value && styles.selectedFilter]}><Text style={[styles.filterText, filter === value && styles.link]}>{value}</Text></Pressable>)}{desktop && <Pressable accessibilityRole="button" accessibilityLabel="Choose follow-ups branch" onPress={() => setBranchPicker(true)} style={styles.filter}><Text style={styles.filterText}>{branch || 'All branches'} {'\u2304'}</Text></Pressable>}</View>
        <Text style={styles.resultCount}>{visible.length} tasks{visible.length > 0 ? ` · showing ${currentPage * pageSize + 1}–${currentPage * pageSize + shown.length}` : ''}</Text>
        <View style={styles.taskGrid}>{shown.map(task => <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`Open task ${task.title}`} onPress={() => router.push({ pathname: '/admin/tasks/[id]', params: { id: task.id } })} style={({ pressed }) => [styles.taskCard, { width: cardWidth }, pressed && styles.pressed]}>
          <View style={styles.taskHeading}><View style={styles.taskType}><TaskIcon name={task.type in icons ? task.type as keyof typeof icons : 'Task'} /><Text style={styles.taskTypeText}>{task.type || 'Task'}</Text></View><View style={[styles.badge, task.status === 'completed' ? styles.completedBadge : task.status === 'in_progress' ? styles.progressBadge : task.status === 'cancelled' ? styles.cancelledBadge : null]}><Text style={styles.badgeText}>{statusLabel(task.status)}</Text></View></View>
          <Text style={styles.taskTitle}>{task.title}</Text><View style={styles.taskFooter}><Text style={styles.taskMeta}>{[parseDate(task.dueDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) || task.dueDate, task.dueTime, employeeName(task)].filter(Boolean).join(' · ')}</Text></View>
        </Pressable>)}</View>
        {!visible.length && <View style={styles.empty}><Text style={styles.taskTitle}>{tasks.length ? 'No matching tasks' : 'No tasks yet'}</Text><Text style={styles.subtitle}>{tasks.length ? 'Try another search, status or branch.' : 'Assign a task to start tracking your team’s follow-ups.'}</Text></View>}
        {visible.length > pageSize && <View style={styles.pagination}><Pressable accessibilityRole="button" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} style={styles.filter}><Text style={styles.filterText}>Previous</Text></Pressable><Text style={styles.resultCount}>Page {currentPage + 1} of {Math.ceil(visible.length / pageSize)}</Text><Pressable accessibilityRole="button" disabled={(currentPage + 1) * pageSize >= visible.length} onPress={() => setPage(currentPage + 1)} style={styles.filter}><Text style={styles.filterText}>Next</Text></Pressable></View>}
      </>}
    </ScrollView>
    {!desktop && <AdminBottomNavigation />}
  </View><Modal visible={branchPicker} transparent animationType="fade" onRequestClose={() => setBranchPicker(false)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.taskHeading}><Text style={styles.taskTitle}>Choose branch</Text><Pressable accessibilityRole="button" accessibilityLabel="Close branch picker" onPress={() => setBranchPicker(false)} style={styles.filter}><Text style={styles.filterText}>Close</Text></Pressable></View><ScrollView>{['', ...branches].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Select ${value || 'All branches'}`} onPress={() => updateBranch(value)} style={styles.branchOption}><Text style={styles.filterText}>{value || 'All branches'}</Text></Pressable>)}</ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#8192ad' },
  headerSearch: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700', color: '#345cf2' },
  headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, minHeight: 34, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 10, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 9, backgroundColor: '#f7f9ff' },
  content: { padding: 16, paddingTop: 24, paddingBottom: 32, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, title: { fontSize: 23, lineHeight: 30, fontWeight: '800', color: '#20334f' }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 5 },
  primary: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center' }, primaryText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  summary: { flexDirection: 'row', paddingVertical: 16, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, backgroundColor: '#fff', marginTop: 6 }, summaryMetric: { flex: 1, minWidth: 0, paddingHorizontal: 14 }, metricDivider: { borderLeftWidth: 1, borderLeftColor: '#edf1f8' }, metricValue: { fontSize: 21, fontWeight: '700', color: '#20334f' }, metricLabel: { fontSize: 10, lineHeight: 16, color: '#71829c', marginTop: 3 },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fff' }, searchText: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 13, color: '#20334f', paddingVertical: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, filter: { minHeight: 38, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 9, backgroundColor: '#fff', justifyContent: 'center' }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, filterText: { fontSize: 10, lineHeight: 15, fontWeight: '600', color: '#405573' }, link: { color: '#345cf2', fontSize: 11, fontWeight: '600' },
  resultCount: { fontSize: 10, lineHeight: 16, color: '#71829c' }, taskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, taskCard: { minWidth: 0, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' }, taskHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, taskType: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }, taskTypeText: { fontSize: 10, color: '#71829c' },
  badge: { maxWidth: '45%', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: '#fff1d9' }, completedBadge: { backgroundColor: '#def6ef' }, progressBadge: { backgroundColor: '#eee7ff' }, cancelledBadge: { backgroundColor: '#f2edf0' }, badgeText: { fontSize: 9, lineHeight: 13, color: '#405573', fontWeight: '600' }, taskTitle: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#20334f', marginTop: 12, flexShrink: 1 }, taskFooter: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#edf1f8' }, taskMeta: { fontSize: 10, lineHeight: 16, color: '#71829c' },
  pressed: { opacity: 0.75 }, empty: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', gap: 8 }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  navigation: { flexDirection: 'row', padding: 6, borderTopWidth: 1, borderTopColor: '#e4eaf5', backgroundColor: '#fff' }, navItem: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 4 }, navIcon: { width: 48, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navLabel: { fontSize: 9, lineHeight: 14, color: '#71829c', marginTop: 3 }, glyph: { fontSize: 17, color: '#71829c' },
  overlay: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, backgroundColor: '#fff', borderRadius: 18 }, branchOption: { minHeight: 48, padding: 12, justifyContent: 'center' },
});
