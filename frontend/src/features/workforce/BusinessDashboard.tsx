import WorkspaceIcon from './WorkspaceIcon';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { asWorkforceError, getEmployeeSummary, WorkforceError } from './api';
import { availableScopes, LoginScope } from './authApi';
import { summarizeEmployees } from './employeeDashboardModel';
import { sampleEmployees } from './employeeSampleData';
import { can } from './session';
import { EmployeeSummary, Resource, Session } from './types';
import { ErrorState } from './ui';

const palette = {
  blue: { ink: '#4869BC', tint: '#EDF2FF', wash: '#F7F9FF' },
  green: { ink: '#278D78', tint: '#E4F5EE', wash: '#F1FAF6' },
  purple: { ink: '#9A6ABC', tint: '#F2EAF9', wash: '#FAF6FF' },
  gold: { ink: '#C09447', tint: '#FFF1D8', wash: '#FFFAEF' },
};
type Tone = keyof typeof palette;

export default function BusinessDashboard({ session }: { session?: Session }) {
  const { width } = useWindowDimensions();
  const mobile = width < 700;
  const scroll = useRef<ScrollView>(null);
  const [summary, setSummary] = useState<EmployeeSummary | null>(() => session ? null : summarizeEmployees(sampleEmployees));
  const [scopes, setScopes] = useState<LoginScope[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WorkforceError | null>(null);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const company = session?.scope.companyName || 'BranchSuite';
  const branch = session?.scope.branchName;
  useFocusEffect(useCallback(() => {
    if (!session) return;
    const controller = new AbortController();
    let current = true;
    setLoading(true); setError(null); setSummary(null); setScopes([]);
    Promise.all([
      can(session, 'employees.read') ? getEmployeeSummary(session, controller.signal) : Promise.resolve(null),
      availableScopes(session),
    ]).then(([totals, branches]) => { if (current) { setSummary(totals); setScopes(branches); } })
      .catch(cause => { if (current) setError(asWorkforceError(cause)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [session, refresh]));
  const open = useCallback((resource: Resource, create = false) => {
    if (!session) {
      if (resource === 'employees') { router.push({ pathname: '/employees-preview', params: create ? { action: 'new' } : {} }); return; }
      if (resource === 'tasks' && create) { router.push('/tasks-preview'); return; }
      if (resource === 'attendance' || resource === 'leave') { router.push({ pathname: '/attendance-preview', params: { tab: resource } }); return; }
      setNotice('This workspace will be available when its service is connected.'); return;
    }
    if (!can(session, `${resource === 'payslips' ? 'payslips' : resource}.${create ? 'create' : 'read'}`)) {
      setNotice('Your account does not have access to this action in the selected branch.'); return;
    }
    router.push(create ? { pathname: '/workforce/[resource]/new', params: { resource } } : { pathname: '/workforce/[resource]', params: { resource } });
  }, [session]);
  const unavailable = () => setNotice('This workspace will be available when its service is connected.');
  const account = () => { if (session) router.push('/workforce/account'); else setNotice('Company and branch settings are available for an authenticated workspace.'); };
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Calcutta' }).toUpperCase();
  const branchCards = session ? scopes : [];

  return <View style={s.screen}>
    <View style={s.header}><View style={[s.headerInner, mobile && s.mobilePadding]}>
      <View style={s.row}><View style={{ flex: 1, gap: 5 }}><Text style={s.company}>{company}</Text><Text style={s.muted}>Business workspace</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Find employees" onPress={() => open('employees')} style={s.headerButton}><Text style={s.headerSymbol}>⌕</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Account and branches" onPress={account} style={[s.headerButton, { backgroundColor: '#EDF2FF' }]}><Text style={s.initials}>BS</Text></Pressable>
      </View>
      {session && <View style={[s.row, { flexWrap: 'wrap' }]}><Pressable accessibilityRole="button" accessibilityLabel="Select company" onPress={account} style={s.selector}><Text style={s.tiny}>Company</Text><Text style={s.selectorText} numberOfLines={1}>{company}</Text><Text style={s.muted}>⌄</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Select branch" onPress={account} style={[s.selector, { backgroundColor: '#EDF1FF' }]}><Text style={s.tiny}>Branch</Text><Text style={s.selectorText} numberOfLines={1}>{branch}</Text><Text style={s.muted}>⌄</Text></Pressable></View>}
    </View></View>
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={[s.content, mobile && s.mobilePadding]} refreshControl={session ? <RefreshControl refreshing={loading} onRefresh={() => setRefresh(value => value + 1)} /> : undefined}>
      <View style={s.main}>
        <View style={s.row}><View style={{ flex: 1, gap: 7 }}><Text style={s.eyebrow}>BUSINESS OVERVIEW</Text><Text style={s.greeting}>Hello, there.</Text><Text style={s.muted}>Your people, customers and priorities.</Text></View><View style={s.date}><Text style={s.dateText}>{date}</Text><Text style={s.tiny}>Today</Text></View></View>
        {!!notice && <View style={s.notice}><Text style={[s.muted, { flex: 1 }]} accessibilityLiveRegion="polite">{notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setNotice('')}><Text style={s.muted}>×</Text></Pressable></View>}
        {!!error && <ErrorState error={error} retry={() => setRefresh(value => value + 1)} />}
        <View style={s.quickActions}>{[
          { title: 'Add employee', symbol: '♙+', tone: 'blue' as Tone, press: () => open('employees', true) },
          { title: 'Add lead', symbol: '+', tone: 'green' as Tone, press: unavailable },
          { title: 'Assign task', symbol: '≡', tone: 'purple' as Tone, press: () => open('tasks', true) },
          { title: 'Attendance', symbol: '◷', tone: 'gold' as Tone, press: () => open('attendance') },
        ].map(action => <Pressable key={action.title} accessibilityRole="button" onPress={action.press} style={s.quickAction}><Glyph symbol={action.symbol} tone={action.tone} /><Text style={s.actionLabel}>{action.title}</Text></Pressable>)}</View>

        <Section title="At a glance" note={branch || 'Your workspace'} />
        <View style={s.grid}>{[
          { title: 'Active employees', value: summary?.active, detail: summary ? `${summary.total} employees in total` : loading ? 'Loading employees…' : 'Employee summary unavailable', tone: 'blue' as Tone, symbol: '♙', press: () => open('employees') },
          { title: 'Pending requests', value: null, detail: 'Leave service not connected', tone: 'gold' as Tone, symbol: '◷', press: () => open('leave') },
          { title: 'Net payroll', value: null, detail: 'Payroll service not connected', tone: 'green' as Tone, symbol: '▤', press: () => open('payroll') },
          { title: 'Open pipeline', value: null, detail: 'CRM service not connected', tone: 'purple' as Tone, symbol: '↗', press: unavailable },
        ].map(stat => <Pressable key={stat.title} accessibilityRole="button" onPress={stat.press} style={[s.stat, { backgroundColor: palette[stat.tone].wash }, !mobile && { width: '23.5%' }]}><View style={s.row}><Glyph tone={stat.tone} symbol={stat.symbol} small /><Text style={s.chevron}>›</Text></View><Text style={s.cardLabel}>{stat.title}</Text><Text style={s.statNumber}>{stat.value ?? '—'}</Text><Text style={s.tiny}>{stat.detail}</Text></Pressable>)}</View>

        <Section title="Your workspaces" />
        <View style={s.grid}>{[
          { title: 'CRM', description: 'Leads, deals & customers', note: 'Coming soon', tone: 'blue' as Tone, symbol: '↗', press: unavailable },
          { title: 'People', description: 'Team, attendance & leave', note: summary ? `${summary.total} people` : 'Your team', tone: 'green' as Tone, symbol: '♙', press: () => open('employees') },
          { title: 'Payroll', description: 'Pay runs, salaries & payslips', note: 'Salary workspace', tone: 'purple' as Tone, symbol: '▤', press: () => open('payroll') },
          { title: 'Reports', description: 'Insights & PDF exports', note: 'Coming soon', tone: 'gold' as Tone, symbol: '▥', press: unavailable },
        ].map(workspace => <Pressable key={workspace.title} accessibilityRole="button" onPress={workspace.press} style={[s.workspace, !mobile && { width: '23.5%' }]}><View style={s.row}><Glyph tone={workspace.tone} symbol={workspace.symbol} /><Text style={s.tiny}>{workspace.note}</Text></View><Text style={s.workspaceTitle}>{workspace.title}</Text><Text style={s.muted}>{workspace.description}</Text><View style={[s.row, s.workspaceFoot]}><Text style={[s.link, { color: palette[workspace.tone].ink }]}>Open workspace</Text><Text style={s.chevron}>›</Text></View></Pressable>)}</View>

        <Section title="Needs attention" />
        <Shortcut title="Requests to review" description="Leave requests and approvals" tone="gold" symbol="◷" onPress={() => open('leave')} />
        <Shortcut title="Payroll checks" description="Review salary runs and payment status" tone="purple" symbol="▤" onPress={() => open('payroll')} />
        <Shortcut title="Customer follow-ups" description="Keep track of customer conversations" tone="blue" symbol="≡" onPress={unavailable} />

        <Section title="Your personal space" />
        <Shortcut title="My attendance" description="Check attendance and daily records" tone="green" symbol="◷" onPress={() => open('attendance')} />
        <Shortcut title="My payslip" description="View your published payslips" tone="blue" symbol="▤" onPress={() => open('payslips')} />

        <Section title="Branch overview" />
        {loading && <ActivityIndicator color="#4169E1" />}
        {branchCards.map(scope => {
          const selected = scope.branchId === session?.scope.branchId;
          const totals = selected ? summary : null;
          const percent = totals?.total ? Math.round(totals.active / totals.total * 100) : 0;
          return <Pressable key={`${scope.companyId}:${scope.branchId}`} accessibilityRole="button" onPress={account} style={s.branchCard}><View style={s.row}><View style={[s.row, { justifyContent: 'flex-start' }]}><Glyph tone="blue" symbol="▥" small /><Text style={s.workspaceTitle}>{scope.branchName}</Text></View><Text style={s.chevron}>›</Text></View>
            <Text style={s.tiny}>{scope.companyName}{selected ? ' · Selected branch' : ' · Select to view totals'}</Text>
            <View style={s.branchMetrics}>{[{ title: 'Employees', value: totals?.total }, { title: 'Active', value: totals?.active }, { title: 'Inactive', value: totals?.inactive }].map(metric => <View key={metric.title} style={{ flex: 1, gap: 5 }}><Text style={s.branchNumber}>{metric.value ?? '—'}</Text><Text style={s.tiny}>{metric.title}</Text></View>)}</View>
            {totals && <><View style={s.track}><View style={[s.progress, { width: `${percent}%` }]} /></View><Text style={s.tiny}>{percent}% active employees</Text></>}
          </Pressable>;
        })}
        {!loading && !branchCards.length && <View style={s.branchCard}><View style={s.row}><Glyph tone="blue" symbol="▥" /><Text style={s.workspaceTitle}>Your branches</Text></View><Text style={s.muted}>Branch summaries appear when a business workspace is connected.</Text></View>}
        <Text style={s.footer}>One workspace for your people and priorities.</Text>
      </View>
    </ScrollView>
    <View style={s.bottom}>{[{ title: 'Home', press: () => scroll.current?.scrollTo({ y: 0, animated: true }) }, { title: 'CRM', press: unavailable }, { title: 'People', press: () => open('employees') }, { title: 'Payroll', press: () => open('payroll') }, { title: 'More', press: account }].map(item => <Pressable key={item.title} accessibilityRole="button" accessibilityState={{ selected: item.title === 'Home' }} onPress={item.press} style={[s.nav, item.title === 'Home' && { backgroundColor: '#EDF2FF' }]}><WorkspaceIcon size={24} name={item.title} color={item.title === "Home" ? "#4169E1" : "#7D8DA2"} /><Text style={[s.navLabel, item.title === 'Home' && { color: '#4169E1' }]}>{item.title}</Text></Pressable>)}</View>
  </View>;
}

function Glyph({ tone, symbol, small = false }: { tone: Tone; symbol: string; small?: boolean }) {
  return <View style={[s.glyph, { backgroundColor: palette[tone].tint }, small && { width: 30, height: 30, borderRadius: 10 }]} accessible={false}><Text style={{ color: palette[tone].ink, fontSize: small ? 17 : 22 }}>{symbol}</Text></View>;
}
function Section({ title, note }: { title: string; note?: string }) {
  return <View style={[s.row, { marginTop: 9 }]}><Text style={s.sectionTitle}>{title}</Text>{note && <Text style={s.tiny}>{note}</Text>}</View>;
}
function Shortcut({ title, description, tone, symbol, onPress }: { title: string; description: string; tone: Tone; symbol: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.shortcut}><Glyph tone={tone} symbol={symbol} /><View style={{ flex: 1, gap: 5 }}><Text style={s.shortcutTitle}>{title}</Text><Text style={s.tiny}>{description}</Text></View><Text style={s.chevron}>›</Text></Pressable>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F8FC' }, header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECF0F7', alignItems: 'center' }, headerInner: { width: '100%', maxWidth: 1180, padding: 26, gap: 18 }, mobilePadding: { paddingHorizontal: 18, paddingVertical: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, company: { fontSize: 17, fontWeight: '700', color: '#21354A' }, muted: { fontSize: 13, lineHeight: 20, color: '#7D8DA2' }, tiny: { fontSize: 11, lineHeight: 17, color: '#8A98AA', flexShrink: 1 }, headerButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#F5F7FB', alignItems: 'center', justifyContent: 'center' }, headerSymbol: { fontSize: 28, color: '#4E6381' }, initials: { fontSize: 15, color: '#4B6DC4', fontWeight: '700' },
  selector: { flex: 1, minWidth: 145, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#E9EEF7', padding: 13, borderRadius: 12 }, selectorText: { flex: 1, fontSize: 12, color: '#354961', fontWeight: '600' }, content: { padding: 30, alignItems: 'center', flexGrow: 1 }, main: { width: '100%', maxWidth: 1120, gap: 15 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: '#8592A6' }, greeting: { fontSize: 30, fontWeight: '700', color: '#20344A' }, date: { borderWidth: 1, borderColor: '#EBEFF6', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 13, alignItems: 'center', gap: 3 }, dateText: { fontSize: 12, color: '#677D98', fontWeight: '700' }, notice: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, backgroundColor: '#EBF1FF', borderRadius: 12 },
  quickActions: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 18, borderWidth: 1, borderColor: '#EDF1F7' }, quickAction: { flex: 1, alignItems: 'center', gap: 10 }, actionLabel: { fontSize: 11, color: '#364960', fontWeight: '600', textAlign: 'center' }, glyph: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, color: '#293F54', fontWeight: '700' }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, stat: { width: '48%', padding: 17, gap: 8, borderRadius: 17, borderWidth: 1, borderColor: '#EDF0F6' }, cardLabel: { fontSize: 12, fontWeight: '600', color: '#62798D' }, statNumber: { fontSize: 27, fontWeight: '700', color: '#2F465B' }, chevron: { color: '#A4B0C0', fontSize: 21 },
  workspace: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 17, borderWidth: 1, borderColor: '#EDF0F6', padding: 17, gap: 10 }, workspaceTitle: { color: '#334C61', fontWeight: '700', fontSize: 16 }, workspaceFoot: { borderTopWidth: 1, borderTopColor: '#F0F3F7', paddingTop: 10, marginTop: 10 }, link: { fontSize: 11, fontWeight: '600' },
  shortcut: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDF0F6', padding: 17, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 14 }, shortcutTitle: { color: '#3D5167', fontSize: 14, fontWeight: '600' },
  branchCard: { borderWidth: 1, borderColor: '#EDF0F6', backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, gap: 16 }, branchMetrics: { flexDirection: 'row', gap: 15 }, branchNumber: { color: '#344C63', fontWeight: '700', fontSize: 25 }, track: { height: 4, backgroundColor: '#EEF3F6', borderRadius: 3, overflow: 'hidden' }, progress: { height: 4, backgroundColor: '#87BCAF' }, footer: { textAlign: 'center', color: '#9CA8B8', fontSize: 11, paddingVertical: 20 }, bottom: { flexDirection: 'row', padding: 7, gap: 7, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EBEFF6' }, nav: { flex: 1, gap: 4, alignItems: 'center', paddingVertical: 9, borderRadius: 16 }, navLabel: { color: '#7D8DA2', fontSize: 12, fontWeight: '600' },
});
