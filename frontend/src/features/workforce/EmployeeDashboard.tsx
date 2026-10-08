import WorkspaceIcon from './WorkspaceIcon';
﻿import { useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { EmployeeCard } from './EmployeeUI';
import { EmployeeStatus, EmployeeSummary, WorkforceRecord } from './types';
import { Button, State, styles } from './ui';

interface Props {
  employees: WorkforceRecord[]; summary: EmployeeSummary | null; branchName: string; companyName?: string;
  search: string; status?: EmployeeStatus; onSearch: (value: string) => void; onStatus: (value?: EmployeeStatus) => void;
  onOpen: (employee: WorkforceRecord) => void; onAdd?: () => void; onAccount?: () => void; onPayroll?: () => void; onHome?: () => void;
  preview?: boolean; notice?: string; loading?: boolean; error?: string;
  hasMore?: boolean; onLoadMore?: () => void; onRefresh?: () => void;
}
export default function EmployeeDashboard(props: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 650;
  const searchInput = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const company = props.companyName || 'BranchSuite';
  const goToPeople = () => { props.onSearch(''); props.onStatus(undefined); scroll.current?.scrollTo({ y: 0, animated: true }); };
  const nav = [
    { title: 'Home', onPress: props.onHome ?? goToPeople },
    { title: 'CRM', onPress: undefined },
    { title: 'People', onPress: goToPeople },
    { title: 'Payroll', onPress: props.onPayroll },
    { title: 'More', onPress: props.onAccount },
  ];
  return <View style={s.screen}>
    <View style={s.header}><View style={[s.headerInner, compact && { paddingHorizontal: 20 }]}>
      <View style={s.headerTop}>
        <View style={{ flex: 1, gap: 6 }}><Text style={s.workspaceName}>{company}</Text><Text style={s.small}>Business workspace</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Focus employee search" style={s.searchButton} onPress={() => searchInput.current?.focus()}><WorkspaceIcon name="Search" color="#243952" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Account and branches" disabled={!props.onAccount} onPress={props.onAccount} style={s.account}><View style={s.avatar}><Text style={s.avatarText}>BS</Text></View>{!compact && <Text style={s.workspaceName}>Business workspace</Text>}</Pressable>
      </View>
      {!props.preview && <View style={s.scopeRow}>
        <Pressable disabled={!props.onAccount} onPress={props.onAccount} accessibilityRole="button" accessibilityLabel="Select company" style={s.scope}><Text style={s.scopeLabel}>Company</Text><Text numberOfLines={1} style={s.scopeValue}>{company}</Text><Text style={s.chevron}>⌄</Text></Pressable>
        <Pressable disabled={!props.onAccount} onPress={props.onAccount} accessibilityRole="button" accessibilityLabel="Select branch" style={[s.scope, s.branch]}><Text style={s.scopeLabel}>Branch</Text><Text numberOfLines={1} style={s.scopeValue}>{props.branchName}</Text><Text style={s.chevron}>⌄</Text></Pressable>
      </View>}
    </View></View>
    <ScrollView ref={scroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, compact && { padding: 20 }]}
      refreshControl={props.onRefresh ? <RefreshControl refreshing={!!props.loading && props.employees.length > 0} onRefresh={props.onRefresh} /> : undefined}>
      <View style={s.main}>
        <View style={s.titleRow}><View style={{ flex: 1, minWidth: 180, gap: 8 }}><Text style={s.title}>Employees</Text><Text style={s.description}>Create a profile and manage your team.</Text></View>
          {props.onAdd && <Pressable accessibilityRole="button" onPress={props.onAdd} style={({ pressed }) => [s.add, pressed && { opacity: 0.8 }]}><Text style={s.addText}>Add employee</Text></Pressable>}
        </View>
        <View style={s.summary}>{[{ label: 'employees', value: props.summary?.total, status: undefined }, { label: 'active', value: props.summary?.active, status: 'ACTIVE' as const }, { label: 'inactive', value: props.summary?.inactive, status: 'INACTIVE' as const }].map((item, index) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`Filter ${item.label}`} onPress={() => props.onStatus(item.status)} style={[s.metric, { flexWrap: 'nowrap', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }, compact && { paddingHorizontal: 8 }, index > 0 && s.metricBorder]}><Text numberOfLines={1} style={[s.metricNumber, compact && { fontSize: 20, flexShrink: 1 }]}>{item.value ?? '—'}</Text><Text numberOfLines={1} style={[s.metricLabel, compact && { fontSize: 12 }]}>{item.label}</Text></Pressable>)}</View>
        {!!props.notice && <Text style={s.small} accessibilityLiveRegion="polite">{props.notice}</Text>}
        {!!props.error && <View style={styles.card}><Text style={styles.error} accessibilityLiveRegion="polite">{props.error}</Text>{props.onRefresh && <Button title="Retry" secondary onPress={props.onRefresh} />}</View>}
        <View style={s.searchField}><WorkspaceIcon name="Search" /><TextInput ref={searchInput} style={s.searchInput} accessibilityLabel="Search employees" placeholder="Search name, email or department" placeholderTextColor="#8793A5" value={props.search} onChangeText={props.onSearch} autoCorrect={false} /></View>
        <View style={s.filters}>{(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(option => {
          const selected = option === 'ALL' ? !props.status : props.status === option;
          return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => props.onStatus(option === 'ALL' ? undefined : option)} style={[s.filter, selected && s.filterSelected]}><Text style={[s.filterText, selected && s.selectedText]}>{option === 'ALL' ? 'All' : option === 'ACTIVE' ? 'Active' : 'Inactive'}</Text></Pressable>;
        })}</View>
        <View style={s.grid}>{props.employees.map(employee => <View key={employee.id} style={[s.person, compact && { width: '100%' }]}><EmployeeCard employee={employee} branchName={props.branchName} onPress={() => props.onOpen(employee)} /></View>)}</View>
        {!props.employees.length && (props.loading ? <State title="Loading employees" busy /> : !props.error ? <State title={props.search || props.status ? 'No matching employees' : 'Your team starts here'} message={props.search || props.status ? 'Try another search or status filter.' : 'Add your first employee to build your team.'} /> : null)}
        {props.hasMore && props.onLoadMore && <Button title={props.loading ? 'Loading…' : 'Load more employees'} secondary disabled={props.loading} onPress={props.onLoadMore} />}
      </View>
    </ScrollView>
    <View style={s.bottom}><View style={s.bottomInner}>{nav.map(item => <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`${item.title}${!item.onPress ? ' — unavailable' : ''}`} accessibilityState={{ selected: item.title === 'People', disabled: !item.onPress }} disabled={!item.onPress} onPress={item.onPress} style={[s.nav, item.title === 'People' && s.navSelected]}><WorkspaceIcon size={24} name={item.title} color={item.title === "People" ? "#315BF3" : !item.onPress ? "#ADB8C9" : "#657C98"} /><Text style={[s.navLabel, item.title === 'People' && s.selectedText, !item.onPress && s.unavailable]}>{item.title}</Text></Pressable>)}</View></View>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FC' }, header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E6EBF4', alignItems: 'center' }, headerInner: { width: '100%', maxWidth: 1360, paddingHorizontal: 40, paddingVertical: 20, gap: 18 }, headerTop: { flexDirection: 'row', alignItems: 'center', gap: 16 }, workspaceName: { color: '#1D304A', fontWeight: '700', fontSize: 17 }, small: { color: '#7A8CA5', fontSize: 13, lineHeight: 20 },
  searchButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#F5F7FB', alignItems: 'center', justifyContent: 'center' }, searchIcon: { color: '#637995', fontSize: 30 }, account: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 19, backgroundColor: '#E8EEFF', borderWidth: 3, borderColor: '#F4F7FF', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#4163BE', fontSize: 17, fontWeight: '700' },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, scope: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 15, borderWidth: 1, borderColor: '#E3E9F4', borderRadius: 13, backgroundColor: '#F8FAFE' }, branch: { backgroundColor: '#E9EEFF', borderColor: '#D3DEFF' }, scopeLabel: { color: '#8897AE', fontSize: 12 }, scopeValue: { color: '#243952', fontWeight: '600', flex: 1, fontSize: 14 }, chevron: { color: '#788BA7', fontSize: 20 },
  content: { padding: 40, paddingBottom: 32, alignItems: 'center', flexGrow: 1 }, main: { width: '100%', maxWidth: 1280, gap: 22 }, titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginBottom: 8 }, title: { fontSize: 34, fontWeight: '700', color: '#1D304A' }, description: { color: '#6C809C', fontSize: 17, lineHeight: 25 }, add: { borderRadius: 17, paddingHorizontal: 24, paddingVertical: 19, backgroundColor: '#315BF3' }, addText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  summary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4EAF4', borderRadius: 23, flexDirection: 'row', paddingVertical: 24 }, metric: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 20 }, metricBorder: { borderLeftWidth: 1, borderLeftColor: '#E9EDF5' }, metricNumber: { color: '#304968', fontSize: 26, fontWeight: '700' }, metricLabel: { color: '#6C809C', fontSize: 15 },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E1E8F3', backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 20, minHeight: 64 }, searchInput: { flex: 1, minWidth: 0, color: '#243952', fontSize: 18, paddingVertical: 16 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, filter: { borderWidth: 1, borderColor: '#E2E8F4', borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingVertical: 13 }, filterSelected: { backgroundColor: '#E7EEFF', borderColor: '#D1DFFF' }, filterText: { color: '#687C98', fontSize: 15, fontWeight: '600' }, selectedText: { color: '#315BF3' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, person: { width: '48.8%', flexGrow: 1, minWidth: 0 }, bottom: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E8EDF5', paddingVertical: 7, paddingHorizontal: 14, alignItems: 'center' }, bottomInner: { width: '100%', maxWidth: 1280, flexDirection: 'row', gap: 8 }, nav: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 4, borderRadius: 22 }, navSelected: { backgroundColor: '#ECF1FF' }, navIcon: { color: '#657C98', fontSize: 27, lineHeight: 31 }, navLabel: { color: '#657C98', fontSize: 12, fontWeight: '700' }, unavailable: { color: '#ADB8C9' },
});
