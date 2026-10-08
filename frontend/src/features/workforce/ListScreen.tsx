import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { asWorkforceError, getEmployeeSummary, listRecords, WorkforceError } from './api';
import { label, resources } from './resources';
import { can } from './session';
import { EmployeeStatus, EmployeeSummary, Resource, Session, WorkforceRecord } from './types';
import { Button, ErrorState, SessionGate, State, styles } from './ui';
import EmployeeDashboard from './EmployeeDashboard';
import AttendanceLeaveScreen from './AttendanceLeaveScreen';

export default function ListScreen({ resource }: { resource: Resource }) {
  if (resource === 'attendance' || resource === 'leave') return <SessionGate>{session => <AttendanceLeaveScreen key={`${session.userId}:${session.scope.branchId}:${session.accessToken}:${resource}`} session={session} initialTab={resource} />}</SessionGate>;
  return <SessionGate>{session => <ScopedList key={`${resource}:${session.userId}:${session.scope.tenantId}:${session.scope.companyId}:${session.scope.branchId}:${session.accessToken}`} resource={resource} session={session} />}</SessionGate>;
}
function ScopedList({ resource, session }: { resource: Resource; session: Session }) {
  const config = resources[resource];
  const [items, setItems] = useState<WorkforceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus | undefined>();
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WorkforceError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const readable = can(session, `${config.permission}.read`);
  const load = async (append = false) => {
    if (!readable) { setLoading(false); return; }
    const ticket = ++sequence.current;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setError(null);
    try {
      const [page, totals] = await Promise.all([
        listRecords(session, resource, query, append ? cursor ?? undefined : undefined, current.signal, employeeStatus),
        resource === 'employees' && !append ? getEmployeeSummary(session, current.signal) : Promise.resolve(null),
      ]);
      if (ticket !== sequence.current || current.signal.aborted) return;
      setItems(previous => append ? [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))] : page.items);
      setCursor(page.nextCursor);
      if (totals) setSummary(totals);
    } catch (cause) { if (!current.signal.aborted && ticket === sequence.current) {
      const failure = asWorkforceError(cause);
      if (resource === 'employees') setSummary(null);
      if (failure.kind === 'auth' || failure.kind === 'forbidden') { setItems([]); setCursor(null); }
      setError(failure);
    } }
    finally { if (!current.signal.aborted && ticket === sequence.current) setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  useFocusEffect(useCallback(() => { setItems([]); setCursor(null); void load(); return () => { controller.current?.abort(); sequence.current++; }; }, [query, resource, readable, employeeStatus]));
  if (!readable) return <State title="Access restricted" message="Your role cannot view this module in the selected branch." />;
  if (resource === 'employees' && error?.kind === 'auth') return <ErrorState error={error} retry={() => void load()} />;
  if (resource === 'employees') return <EmployeeDashboard employees={items} summary={summary} branchName={session.scope.branchName} companyName={session.scope.companyName}
    search={search} status={employeeStatus} onSearch={setSearch} onStatus={setEmployeeStatus} loading={loading} error={error?.message}
    onOpen={employee => router.push({ pathname: '/workforce/[resource]/[id]', params: { resource, id: employee.id } })}
    onAdd={can(session, 'employees.create') ? () => router.push({ pathname: '/workforce/[resource]/new', params: { resource } }) : undefined}
    onHome={() => router.push('/workforce')} onAccount={() => router.push('/workforce/account')} onPayroll={can(session, 'payroll.read') ? () => router.push('/workforce/payroll') : undefined} hasMore={!!cursor} onLoadMore={() => void load(true)} onRefresh={() => void load()} />;
  return <View style={styles.screen}>
    <FlatList data={items} keyExtractor={item => item.id} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={() => void load()} />}
      ListHeaderComponent={<View style={{ gap: 14 }}>
        <Text style={styles.eyebrow}>{session.scope.branchName}</Text>
        <Text style={styles.heading}>{config.title}</Text><Text style={styles.description}>{config.description}</Text>
        {config.createLabel && can(session, `${config.permission}.create`) && <Button title={config.createLabel} onPress={() => router.push({ pathname: '/workforce/[resource]/new', params: { resource } })} />}
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder={`Search ${config.title.toLowerCase()}`} accessibilityLabel={`Search ${config.title.toLowerCase()}`} autoCorrect={false} />
        {items.length > 0 && error && <ErrorState error={error} retry={() => void load()} />}
      </View>}
      ListEmptyComponent={loading ? <State title="Loading records" busy /> : error ? <ErrorState error={error} retry={() => void load()} /> : <View>
        <State title={query || employeeStatus ? 'No matching records' : `No ${config.title.toLowerCase()} yet`} message={query || employeeStatus ? 'Try another search or status filter.' : 'Records for this branch will appear here.'} />
        {(query || employeeStatus) && <Button title="Clear filters" secondary onPress={() => { setSearch(''); setQuery(''); setEmployeeStatus(undefined); }} />}
      </View>}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${String(item[config.titleKey] || config.singular)}`}
        style={styles.card} onPress={() => router.push({ pathname: '/workforce/[resource]/[id]', params: { resource, id: item.id } })}>
        <View style={styles.row}><Text style={styles.title}>{String(item[config.titleKey] || config.singular)}</Text>
          {(item.paymentStatus || item.status) && <Text style={styles.badge}>{label(String(item.paymentStatus || item.status))}</Text>}
        </View>
        <Text style={styles.description}>{[item.department, item.jobTitle, item.dueDate, item.date, item.periodStart, item.type].filter(Boolean).join(' · ') || 'View details'}</Text>
      </Pressable>}
      ListFooterComponent={items.length > 0 && cursor ? <Button title={loading ? 'Loading…' : 'Load more'} disabled={loading} secondary onPress={() => void load(true)} /> : null} />
  </View>;
}
