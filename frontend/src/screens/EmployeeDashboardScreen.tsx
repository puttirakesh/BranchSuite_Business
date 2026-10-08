import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSession } from '../store/session';
import { getEmployeeDashboard, recordAttendance, type EmployeeDashboard } from '../services/employee';
import { errorMessage } from '../services/api';
import { Badge, Button, Card, ErrorNotice, StateView, money, styles } from '../components/ui';
import { colors } from '../constants/colors';

const tabs = ['My work', 'Attendance', 'My tasks', 'My payroll', 'Leave & requests', 'My profile'] as const;
type Tab = typeof tabs[number];
const time = (value: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const day = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function EmployeeDashboardScreen() {
  const { session, scope, membership, selectBranch, logout } = useSession();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('My work');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['employee-dashboard', scope], queryFn: ({ signal }) => getEmployeeDashboard(scope!, signal), enabled: !!scope });
  const attendance = useMutation({
    mutationFn: ({ selectedScope, action }: { selectedScope: NonNullable<typeof scope>; action: 'check-in' | 'check-out' }) => recordAttendance(selectedScope, action),
    onSuccess: async (_, variables) => { await client.invalidateQueries({ queryKey: ['employee-dashboard', variables.selectedScope] }); },
  });
  const data = query.data;
  const branch = membership?.branches.find((item) => item.id === scope?.branchId);
  const busy = attendance.isPending || query.isFetching || query.isRefetchError;
  function selectTab(next: Tab) { setTab(next); }
  function attendanceCard(value: EmployeeDashboard) {
    const entry = value.attendance;
    const action = entry.status === 'NOT_CHECKED_IN' ? 'check-in' : entry.status === 'CHECKED_IN' ? 'check-out' : null;
    return <Card><View style={local.between}><Text style={styles.heading}>Today's attendance</Text><Badge value={entry.status} /></View>
      <Text style={styles.muted}>{day(value.date)}</Text><Text style={local.shift}>{entry.shift ?? 'No shift scheduled'}</Text><Text style={styles.muted}>{branch?.name}</Text>
      <View style={local.times}><View style={{ flex: 1 }}><Text style={styles.muted}>Checked in</Text><Text style={styles.heading}>{time(entry.checkedInAt)}</Text></View><View style={{ flex: 1 }}><Text style={styles.muted}>Checked out</Text><Text style={styles.heading}>{time(entry.checkedOutAt)}</Text></View></View>
      {action ? <Button title={action === 'check-in' ? 'Check in' : 'Check out'} busy={attendance.isPending} disabled={busy} onPress={() => { if (scope) attendance.mutate({ selectedScope: scope, action }); }} /> : <Text style={styles.muted}>{entry.status === 'CHECKED_OUT' ? 'Your shift is recorded.' : 'No attendance action is needed today.'}</Text>}
      {attendance.isError && <ErrorNotice message={errorMessage(attendance.error)} />}
    </Card>;
  }
  function taskList(value: EmployeeDashboard, limit?: number) {
    const tasks = tab === 'My work' ? value.tasks.filter((task) => task.status !== 'COMPLETED') : value.tasks;
    return <Card><View style={local.between}><Text style={styles.heading}>{tab === 'My work' ? 'Your next tasks' : 'Assigned tasks'}</Text>{tab === 'My work' && <Button title="View all tasks" variant="secondary" onPress={() => selectTab('My tasks')} />}</View>
      {tasks.length === 0 ? <Text style={styles.muted}>You're all caught up. Assigned tasks will appear here.</Text> : tasks.slice(0, limit ?? tasks.length).map((task) => <View key={task.id} style={local.record}><Text style={styles.label}>{task.title}</Text><View style={local.between}><Text style={styles.muted}>{task.dueAt ? `Due ${new Date(task.dueAt).toLocaleString()}` : 'No due date'}</Text><Badge value={task.status} /></View></View>)}
    </Card>;
  }
  function leaveCard(value: EmployeeDashboard) {
    return <Card><Text style={styles.heading}>Your leave balance</Text><View style={styles.wrap}>{[['Casual leave', value.leave.casual], ['Sick leave', value.leave.sick]].map(([label, count]) => <View key={label} style={{ flex: 1, minWidth: 100, gap: 6 }}><Text style={styles.muted}>{label}</Text><Text style={local.metric}>{count} days</Text></View>)}</View><Text style={styles.muted}>{value.leave.pendingRequests} pending requests</Text><Text style={styles.muted}>Contact your manager to request leave or review an existing request.</Text></Card>;
  }
  function payrollCard(value: EmployeeDashboard) {
    const slip = value.latestPayslip;
    return <Card><Text style={styles.heading}>Latest published payslip</Text>{slip ? <><Text style={styles.muted}>{slip.period}</Text><Text style={local.metric}>{money(slip.netPay, slip.currency)}</Text><Badge value={slip.status} /><Text style={styles.muted}>Net take-home pay</Text></> : <Text style={styles.muted}>No published payslip yet. Your pay will appear after payroll is published.</Text>}</Card>;
  }
  return <ScrollView style={styles.page} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { if (scope && !attendance.isPending) void query.refetch(); }} />} contentContainerStyle={[styles.content, { padding: width < 480 ? 16 : 28, maxWidth: 1200 }]}>
    <View style={local.between}><View style={{ flex: 1, gap: 4 }}><Text style={local.brand}>BranchSuite Business</Text><Text style={styles.muted}>Employee workspace</Text><Text style={styles.muted}>{membership?.companyName}</Text></View><Button title="Sign out" variant="secondary" onPress={() => { void logout(); }} /></View>
    <View accessibilityLabel="Employee navigation" style={local.navigation}>{tabs.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => selectTab(item)} style={[local.tab, tab === item && local.selectedTab]}><Text style={[local.tabText, tab === item && { color: '#FFF' }]}>{item}</Text></Pressable>)}</View>
    {(session?.memberships.reduce((count, item) => count + item.branches.length, 0) ?? 0) > 1 && <View style={styles.wrap}>{session?.memberships.flatMap((item) => item.branches.map((assignedBranch) => <Button key={`${item.id}-${assignedBranch.id}`} title={`${item.companyName} · ${assignedBranch.name}${scope?.membershipId === item.id && scope.branchId === assignedBranch.id ? ' (selected)' : ''}`} variant="secondary" disabled={attendance.isPending} onPress={() => { attendance.reset(); selectBranch(item.id, assignedBranch.id); }} />))}</View>}
    <View><Text style={styles.title}>{tab}</Text><Text style={styles.muted}>{data ? day(data.date) : 'Your personal workspace'}{branch ? ` · ${branch.name}` : ''}</Text></View>
    {!scope ? <StateView title="No branch assigned" message="Ask your company administrator to assign your employee account to a branch." /> : query.isPending ? <StateView loading title="Loading your workday…" /> : query.isError && !data ? <StateView title="Employee dashboard unavailable" message={errorMessage(query.error)} action="Try again" onAction={() => { void query.refetch(); }} /> : null}
    {data && <>
      {query.isRefetchError && <><ErrorNotice message="Could not refresh. Showing your last loaded information; refresh before recording attendance." /><Button title="Try again" variant="secondary" onPress={() => { void query.refetch(); }} /></>}
      {tab === 'My work' && <><View style={local.greeting}><Text style={local.eyebrow}>YOUR PERSONAL WORKSPACE</Text><Text style={local.hello}>Hello, {session?.user.name.split(' ')[0]}.</Text><Text style={local.greetingText}>One clear place for your day, tasks and pay.</Text></View>
        <View style={[local.columns, { flexDirection: width >= 800 ? 'row' : 'column' }]}><View style={local.column}>{attendanceCard(data)}<View style={local.tiles}><Tile title="Leave & requests" hint={`${data.leave.casual} casual · ${data.leave.sick} sick days`} onPress={() => selectTab('Leave & requests')} /><Tile title="My profile" hint="Your employment details" onPress={() => selectTab('My profile')} /></View></View>
          <View style={local.column}><View style={local.tiles}><Tile title="Tasks to do" hint={`${data.tasks.filter((task) => task.status !== 'COMPLETED').length} assigned to you`} onPress={() => selectTab('My tasks')} /><Tile title="Latest take-home" hint={data.latestPayslip ? money(data.latestPayslip.netPay, data.latestPayslip.currency) : 'No published payslip'} onPress={() => selectTab('My payroll')} /></View>{taskList(data, 3)}</View></View></>}
      {tab === 'Attendance' && attendanceCard(data)}
      {tab === 'My tasks' && taskList(data)}
      {tab === 'My payroll' && payrollCard(data)}
      {tab === 'Leave & requests' && leaveCard(data)}
      {tab === 'My profile' && <Card><Text style={styles.heading}>{session?.user.name}</Text><Text style={styles.muted}>{data.profile.designation} · {data.profile.department}</Text><Badge value="EMPLOYEE" />{[['Employee ID', data.profile.employeeId], ['Work email', session?.user.email], ['Branch', branch?.name], ['Manager', data.profile.manager], ['Joined', data.profile.joinedOn ? day(data.profile.joinedOn) : null]].map(([label, value]) => <View key={label} style={local.record}><Text style={styles.label}>{label}</Text><Text style={styles.muted}>{value ?? 'Not provided'}</Text></View>)}<Text style={styles.muted}>Ask your manager to update your employment details.</Text></Card>}
    </>}
  </ScrollView>;
}
function Tile({ title, hint, onPress }: { title: string; hint: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [local.tile, pressed && { opacity: 0.7 }]}><Text style={styles.heading}>{title}</Text><Text style={styles.muted}>{hint}</Text><Text style={local.tileLink}>Open →</Text></Pressable>;
}
const local = StyleSheet.create({
  brand: { color: colors.text, fontWeight: '800', fontSize: 20 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 6, backgroundColor: '#E7F2EF', borderRadius: 16 }, tab: { paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, borderRadius: 11 }, selectedTab: { backgroundColor: colors.employee }, tabText: { color: colors.employee, fontWeight: '600', fontSize: 13 },
  greeting: { padding: 24, borderRadius: 20, backgroundColor: '#0A645D', gap: 10 }, eyebrow: { color: '#AEE7D7', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }, hello: { color: '#FFF', fontSize: 30, fontWeight: '700' }, greetingText: { color: '#D4EEE7', lineHeight: 22, fontSize: 15 },
  columns: { gap: 20 }, column: { flex: 1, minWidth: 0, gap: 16 }, tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, tile: { flex: 1, minWidth: 130, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#D7E8E4', backgroundColor: '#EFF8F5', gap: 8 }, tileLink: { color: colors.employee, fontWeight: '700', fontSize: 13 },
  shift: { fontSize: 30, fontWeight: '700', color: colors.text }, metric: { fontSize: 26, fontWeight: '700', color: colors.employee }, times: { flexDirection: 'row', gap: 20, paddingVertical: 18, borderTopWidth: 1, borderTopColor: colors.border }, record: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
});
