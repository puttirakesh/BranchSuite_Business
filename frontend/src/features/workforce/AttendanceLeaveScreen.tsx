import { ReactNode, useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { asWorkforceError, listRecords, WorkforceError } from './api';
import { employeePhoneStyles as s } from './EmployeeOnboarding';
import { sampleEmployees } from './employeeSampleData';
import { AttendanceLeaveModule, leaveDays, readLocalAttendanceLeave, saveLocalAttendanceLeave, validateAttendance, validateLeave, workedMinutes } from './localAttendanceLeave';
import { can } from './session';
import { confirmAction } from './confirm';
import { Session, WorkforceRecord } from './types';
import { ErrorState, State } from './ui';
import WorkforceDateInput from './WorkforceDateInput';
import WorkspaceIcon from './WorkspaceIcon';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Calcutta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const initialValues = () => ({ employeeId: '', date: today(), checkIn: '09:00', checkOut: '', notes: '', type: 'ANNUAL', startDate: today(), endDate: today(), reason: '' });
const titleCase = (value: unknown) => String(value ?? '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

export default function AttendanceLeaveScreen({ session, initialTab = 'attendance' }: { session?: Session; initialTab?: AttendanceLeaveModule }) {
  const [tab, setTab] = useState(initialTab);
  const [records, setRecords] = useState<WorkforceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [date, setDate] = useState(today);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<WorkforceRecord | null>(null);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<WorkforceError | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const readable = !session || can(session, `${tab}.read`);
  const create = !session || can(session, `${tab}.create`);
  const company = session?.scope.companyName || 'BranchSuite';
  useFocusEffect(useCallback(() => {
    if (!readable) { setRecords([]); setLoading(false); return; }
    const current = ++generation.current;
    const controller = new AbortController(); abort.current = controller;
    setRecords([]); setCursor(null); setLoading(true); setError(null);
    (session ? listRecords(session, tab, '', undefined, controller.signal) : readLocalAttendanceLeave(tab).then(items => ({ items, nextCursor: null })))
      .then(page => { if (current === generation.current && !controller.signal.aborted) { setRecords(page.items); setCursor(page.nextCursor); } })
      .catch(cause => { if (current === generation.current && !controller.signal.aborted) setError(session ? asWorkforceError(cause) : new WorkforceError('Unable to read records saved on this device.')); })
      .finally(() => { if (current === generation.current && !controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); abort.current?.abort(); generation.current++; };
  }, [session, tab, refresh, readable]));
  const more = async () => {
    if (!session || !cursor || loading) return;
    const current = generation.current;
    const controller = new AbortController(); abort.current = controller;
    setLoading(true); setError(null);
    try {
      const page = await listRecords(session, tab, '', cursor, controller.signal);
      if (current === generation.current && !controller.signal.aborted) { setRecords(previous => [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))]); setCursor(page.nextCursor); }
    } catch (cause) { if (current === generation.current && !controller.signal.aborted) {
      const failure = asWorkforceError(cause);
      if (failure.kind === 'auth' || failure.kind === 'forbidden') { setRecords([]); setCursor(null); }
      setError(failure);
    } }
    finally { if (current === generation.current && !controller.signal.aborted) setLoading(false); }
  };
  const change = (key: string, value: string) => { setValues(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); };
  const openForm = (record?: WorkforceRecord) => {
    if (session) {
      router.push(record ? { pathname: '/workforce/[resource]/[id]', params: { resource: tab, id: record.id } } : { pathname: '/workforce/[resource]/new', params: { resource: tab } }); return;
    }
    setEditing(record ?? null); setErrors({}); setError(null); setNotice('');
    setValues(record ? { ...initialValues(), ...Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value == null ? '' : String(value)])) } : { ...initialValues(), date });
    setForm(true); scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const save = async () => {
    if (session || lock.current) return;
    const nextErrors = tab === 'attendance' ? validateAttendance(values) : validateLeave(values);
    const employee = sampleEmployees.find(item => item.id === values.employeeId && (item.status === 'ACTIVE' || editing?.employeeId === item.id));
    if (!employee) nextErrors.employeeId = 'Choose an active employee.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setNotice(Object.values(nextErrors).join(' ')); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    lock.current = true; setSaving(true); setError(null);
    try {
      const common = { id: editing?.id ?? `local-${tab}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, employeeId: employee!.id, employeeName: String(employee!.name) };
      const record: WorkforceRecord = tab === 'attendance' ? { ...common, date: values.date, checkIn: values.checkIn, checkOut: values.checkOut || null, notes: values.notes.trim(), workedMinutes: workedMinutes(values.checkIn, values.checkOut), status: values.checkOut ? 'PRESENT' : 'CHECKED_IN' }
        : { ...common, type: values.type, startDate: values.startDate, endDate: values.endDate, reason: values.reason.trim(), days: leaveDays(values.startDate, values.endDate), status: 'PENDING' };
      const updated = await saveLocalAttendanceLeave(tab, record);
      setRecords(updated); setDate(values.date); setSearch(''); setStatus('ALL'); setForm(false); setEditing(null);
      setNotice(`${tab === 'attendance' ? 'Attendance' : 'Leave request'} saved on this device. Server submission requires the connected service.`);
      scroll.current?.scrollTo({ y: 0, animated: true });
    } catch (cause) { setError(new WorkforceError(cause instanceof Error ? cause.message : 'Unable to save on this device.')); scroll.current?.scrollTo({ y: 0, animated: true }); }
    finally { lock.current = false; setSaving(false); }
  };
  const cancelLeave = (record: WorkforceRecord) => confirmAction('Cancel leave request?', `Cancel ${String(record.employeeName)}'s locally saved request?`, 'Cancel request', () => {
    if (lock.current) return;
    lock.current = true; setSaving(true);
    saveLocalAttendanceLeave('leave', { ...record, status: 'CANCELLED' }).then(setRecords).catch(() => setError(new WorkforceError('Unable to cancel this local request.'))).finally(() => { lock.current = false; setSaving(false); });
  });
  const visible = records.filter(record => (!search || `${record.employeeName} ${record.type || ''} ${record.reason || ''}`.toLowerCase().includes(search.toLowerCase()))
    && (tab === 'attendance' ? record.date === date : status === 'ALL' || record.status === status));
  const activeEmployee = sampleEmployees.find(item => item.id === values.employeeId);
  const account = session ? () => router.push('/workforce/account') : undefined;
  const home = () => router.push(session ? '/workforce' : '/');
  const people = () => router.push(session ? '/workforce/employees' : '/employees-preview');
  const payroll = session && can(session, 'payroll.read') ? () => router.push('/workforce/payroll') : undefined;
  const field = (key: string, label: string, content: ReactNode) => <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>{content}{!!errors[key] && <Text style={s.error}>{errors[key]}</Text>}</View>;
  const dateField = (key: string, label: string, time = false) => field(key, `${label}${key !== 'checkOut' ? ' *' : ' (optional)'}`, <WorkforceDateInput label={label} value={values[key]} onChange={value => change(key, value)} time={time} disabled={saving} />);
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.phone}>
    <View style={s.header}><View style={s.headerTop}><View style={{ flex: 1, gap: 5 }}><Text style={s.company}>{company}</Text><Text style={s.headerCaption}>{session?.scope.branchName || 'People workspace'}</Text></View><View style={s.avatar}><Text style={s.initials}>BS</Text></View></View></View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} refreshControl={!form ? <RefreshControl refreshing={loading} onRefresh={() => setRefresh(value => value + 1)} /> : undefined}>
      {form && <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setForm(false); setNotice(''); setError(null); }}><Text style={s.backText}>‹  Back</Text></Pressable>}
      <View style={{ gap: 8 }}><Text style={s.title}>{form ? tab === 'attendance' ? editing ? 'Edit attendance' : 'Record attendance' : 'Request leave' : 'Attendance & leave'}</Text><Text style={s.subtitle}>{tab === 'attendance' ? 'Track check-ins, check-outs and work hours.' : 'Plan time off and follow request status.'}</Text></View>
      {!form && <View style={t.tabs}>{(['attendance', 'leave'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === tab }} disabled={saving} onPress={() => { setTab(item); setSearch(''); setStatus('ALL'); setNotice(''); setError(null); }} style={[t.tab, item === tab && t.selected]}><Text style={[s.cancelText, item === tab && { color: '#315BF3' }]}>{item === 'attendance' ? 'Attendance' : 'Leave'}</Text></Pressable>)}</View>}
      {!!notice && <View style={t.info}><Text style={s.hint} accessibilityLiveRegion="polite">{notice}</Text></View>}
      {error && <ErrorState error={error} retry={() => form ? setError(null) : setRefresh(value => value + 1)} />}
      {!readable ? <State title="Access restricted" message="Your role cannot view this module in the selected branch." /> : form ? <View style={s.card}>
        <Text style={s.cardTitle}>{tab === 'attendance' ? 'Employee attendance' : 'Leave details'}</Text>
        {field('employeeId', 'Employee *', <Pressable accessibilityRole="button" disabled={saving} onPress={() => setPicker(true)} style={[s.input, t.row]}><Text style={s.reviewValue}>{activeEmployee ? String(activeEmployee.name) : 'Select employee'}</Text><Text style={s.backText}>⌄</Text></Pressable>)}
        {tab === 'attendance' ? <>{dateField('date', 'Work date')}{dateField('checkIn', 'Check-in', true)}{dateField('checkOut', 'Check-out', true)}{field('notes', 'Attendance note (optional)', <TextInput accessibilityLabel="Attendance note" style={[s.input, t.textarea]} multiline editable={!saving} value={values.notes} onChangeText={value => change('notes', value)} maxLength={2000} />)}</>
          : <>{field('type', 'Leave type *', <View style={s.choices}>{['ANNUAL', 'SICK', 'UNPAID'].map(type => <Pressable key={type} accessibilityRole="radio" accessibilityState={{ selected: values.type === type }} disabled={saving} onPress={() => change('type', type)} style={[s.choice, values.type === type && s.choiceSelected]}><Text style={s.choiceText}>{titleCase(type)}</Text></Pressable>)}</View>)}{dateField('startDate', 'From')}{dateField('endDate', 'To')}{field('reason', 'Reason *', <TextInput accessibilityLabel="Leave reason" style={[s.input, t.textarea]} multiline editable={!saving} value={values.reason} onChangeText={value => change('reason', value)} maxLength={2000} />)}<Text style={s.hint}>Requests are pending until reviewed. Local saving does not send an approval request.</Text></>}
      </View> : <>
        {tab === 'attendance' && <View style={s.field}><Text style={s.fieldLabel}>Work date</Text><WorkforceDateInput label="Attendance date filter" value={date} onChange={setDate} /></View>}
        <View style={t.summary}>{[{ title: tab === 'attendance' ? 'Records' : 'Requests', count: visible.length }, { title: tab === 'attendance' ? 'Checked in' : 'Pending', count: visible.filter(item => item.status === (tab === 'attendance' ? 'CHECKED_IN' : 'PENDING')).length }, { title: tab === 'attendance' ? 'Completed' : 'Approved', count: visible.filter(item => tab === 'attendance' ? !!item.checkOut : item.status === 'APPROVED').length }].map(metric => <View key={metric.title} style={t.metric}><Text style={t.number}>{metric.count}</Text><Text style={s.hint}>{metric.title}</Text></View>)}</View>
        <Text style={s.hint}>{session ? 'Counts cover the loaded records matching your filters.' : 'Records saved on this device.'}</Text>
        {create && <Pressable accessibilityRole="button" onPress={() => openForm()} style={t.addButton}><Text style={s.continueText}>{tab === 'attendance' ? '+ Record attendance' : '+ Request leave'}</Text></Pressable>}
        <TextInput accessibilityLabel="Search attendance or leave" style={s.input} placeholder="Search employee" value={search} onChangeText={setSearch} />
        {tab === 'leave' && <View style={s.choices}>{['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: option === status }} onPress={() => setStatus(option)} style={[s.choice, option === status && s.choiceSelected]}><Text style={s.choiceText}>{titleCase(option)}</Text></Pressable>)}</View>}
        {loading && <State title="Loading records" busy />}
        {!loading && !error && !visible.length && <State title={search || status !== 'ALL' ? 'No matching records' : tab === 'attendance' ? 'No attendance for this date' : 'No leave requests yet'} message="Records will appear here when you add them." />}
        {visible.map(record => <View key={record.id} style={[s.card, { gap: 12 }]}><Pressable accessibilityRole="button" disabled={saving || (!session && tab === 'leave')} onPress={() => openForm(record)}><View style={t.row}><Text style={s.cardTitle}>{String(record.employeeName)}</Text><Text style={t.badge}>{titleCase(record.status)}</Text></View><Text style={s.reviewValue}>{tab === 'attendance' ? String(record.date) : `${record.startDate} → ${record.endDate}`}</Text>
          <Text style={s.hint}>{tab === 'attendance' ? `In: ${record.checkIn || '—'} · Out: ${record.checkOut || '—'}` : `${titleCase(record.type)} · ${record.days ?? leaveDays(String(record.startDate), String(record.endDate))} calendar days`}</Text>
          {tab === 'attendance' && typeof record.workedMinutes === 'number' && <Text style={s.hint}>{Math.floor(record.workedMinutes / 60)}h {record.workedMinutes % 60}m worked</Text>}{tab === 'leave' && <Text style={s.hint}>{String(record.reason || '')}</Text>}</Pressable>
          {!session && tab === 'leave' && record.status === 'PENDING' && <Pressable accessibilityRole="button" disabled={saving} onPress={() => cancelLeave(record)} style={t.secondary}><Text style={s.cancelText}>Cancel request</Text></Pressable>}
        </View>)}
        {cursor && <Pressable accessibilityRole="button" disabled={loading} onPress={() => void more()} style={t.secondary}><Text style={s.cancelText}>Load more</Text></Pressable>}
      </>}
    </ScrollView>
    {form && <View style={s.actions}><Pressable accessibilityRole="button" disabled={saving} onPress={() => setForm(false)} style={s.cancel}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={s.continue}><Text style={s.continueText}>{saving ? 'Saving…' : tab === 'attendance' ? 'Save attendance' : 'Save request'}</Text></Pressable></View>}
    <View style={s.bottom}>{[{ title: 'Home', press: home }, { title: 'CRM', press: undefined }, { title: 'People', press: people }, { title: 'Payroll', press: payroll }, { title: 'More', press: account }].map(item => <Pressable key={item.title} accessibilityRole="button" accessibilityState={{ selected: item.title === 'People', disabled: saving || !item.press }} disabled={saving || !item.press} onPress={item.press} style={[s.nav, item.title === 'People' && t.selected]}><WorkspaceIcon size={24} name={item.title} color={item.title === 'People' ? '#315BF3' : !item.press ? '#B0BACA' : '#7A8CA6'} /><Text style={[s.navText, item.title === "People" && { color: "#315BF3" }, !item.press && { color: "#B0BACA" }]}>{item.title}</Text></Pressable>)}</View>
    <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}><View style={s.modalOverlay}><View style={s.modalCard}><Text style={s.cardTitle}>Choose employee</Text><ScrollView>{sampleEmployees.filter(item => item.status === 'ACTIVE' || editing?.employeeId === item.id).map(employee => <Pressable key={employee.id} accessibilityRole="button" onPress={() => { change('employeeId', employee.id); setPicker(false); }} style={s.departmentOption}><Text style={s.reviewValue}>{String(employee.name)}</Text><Text style={s.hint}>{String(employee.email)}</Text></Pressable>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => setPicker(false)} style={t.secondary}><Text style={s.cancelText}>Close</Text></Pressable></View></View></Modal>
  </View></KeyboardAvoidingView>;
}
const t = StyleSheet.create({ addButton: { backgroundColor: '#315BF3', borderRadius: 12, padding: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: '#F3F6FB', borderRadius: 12, padding: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, tabs: { flexDirection: 'row', gap: 8, padding: 5, backgroundColor: '#FFFFFF', borderRadius: 15 }, tab: { flex: 1, padding: 13, alignItems: 'center', borderRadius: 12 }, selected: { backgroundColor: '#EDF2FF' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, info: { padding: 14, borderRadius: 14, backgroundColor: '#EDF3FF' }, textarea: { minHeight: 100, textAlignVertical: 'top' }, summary: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EBF5', padding: 16, borderRadius: 20 }, metric: { flex: 1, gap: 5 }, number: { color: '#354B69', fontSize: 24, fontWeight: '700' }, badge: { color: '#315BF3', fontSize: 11, padding: 7, borderRadius: 8, backgroundColor: '#EDF2FF' } });
