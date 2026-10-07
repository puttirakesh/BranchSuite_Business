import { createElement, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { asWorkforceError, employeeOptions, request, WorkforceError } from './api';
import { employeePhoneStyles as s } from './EmployeeOnboarding';
import { sampleEmployees } from './employeeSampleData';
import { can } from './session';
import { Field, Session, WorkforceRecord } from './types';
import { ErrorState, State } from './ui';
import { payload, validate } from './validation';
import WorkspaceIcon from './WorkspaceIcon';
import { LocalTask, readLocalTasks, saveLocalTask } from './localTasks';

const fields: Field[] = [
  { key: 'title', label: 'Task title', required: true, maxLength: 120 },
  { key: 'type', label: 'Type', required: true, options: ['TASK', 'FOLLOW_UP', 'CALL', 'MEETING'] },
  { key: 'assigneeId', label: 'Assign to employee', required: true },
  { key: 'dueDate', label: 'Due date', required: true, kind: 'date' },
  { key: 'dueTime', label: 'Due time', required: true },
  { key: 'priority', label: 'Priority', required: true, options: ['LOW', 'NORMAL', 'HIGH'] },
  { key: 'description', label: 'Instructions / expected outcome', maxLength: 2000 },
];
const labels: Record<string, string> = { TASK: 'Task', FOLLOW_UP: 'Follow-up', CALL: 'Call', MEETING: 'Meeting', LOW: 'Low', NORMAL: 'Normal', HIGH: 'High' };
type Picker = 'type' | 'priority' | 'employee';

export default function TaskAssignment({ session }: { session?: Session }) {
  const [values, setValues] = useState<Record<string, string>>({ title: '', type: 'TASK', assigneeId: '', dueDate: '', dueTime: '11:00', priority: 'NORMAL', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<WorkforceRecord[]>(session ? [] : sampleEmployees.filter(item => item.status === 'ACTIVE'));
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [optionError, setOptionError] = useState<WorkforceError | null>(null);
  const [error, setError] = useState<WorkforceError | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<LocalTask | null>(null);
  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const [validationMessage, setValidationMessage] = useState('');
  const scroll = useRef<ScrollView>(null);
  const [retry, setRetry] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const permitted = !session || can(session, 'tasks.create');
  const company = session?.scope.companyName || 'BranchSuite';
  const branch = session?.scope.branchName;
  const loadEmployees = async (append = false) => {
    if (!session || !permitted) return;
    abort.current?.abort();
    const current = new AbortController(); abort.current = current;
    setLoading(true); setOptionError(null);
    try {
      const page = await employeeOptions(session, 'tasks', search.trim(), append ? cursor ?? undefined : undefined, current.signal);
      if (!mounted.current || current.signal.aborted) return;
      setEmployees(previous => append ? [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))] : page.items);
      setCursor(page.nextCursor);
    } catch (cause) { if (mounted.current && !current.signal.aborted) setOptionError(asWorkforceError(cause)); }
    finally { if (mounted.current && !current.signal.aborted) setLoading(false); }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => {
    if (session) return;
    readLocalTasks().then(tasks => { if (mounted.current) setLocalTasks(tasks); }).catch(() => { if (mounted.current) setError(new WorkforceError('Unable to read saved tasks on this device.')); });
  }, [session]);
  useEffect(() => {
    if (!session || !permitted) return;
    const timer = setTimeout(() => void loadEmployees(), 250);
    return () => { clearTimeout(timer); abort.current?.abort(); };
  }, [session, search, permitted, retry]);
  const change = (key: string, value: string) => { setValues(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); setSaved(null); setValidationMessage(''); };
  const save = async () => {
    if (locked.current || !permitted) return;
    const nextErrors = validate(fields, values);
    if (values.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.dueTime)) nextErrors.dueTime = 'Enter a time in HH:mm format, such as 11:00.';
    if (!session && !employees.some(item => item.id === values.assigneeId)) nextErrors.assigneeId = 'Choose an active employee.';
    setErrors(nextErrors); setError(null); setValidationMessage('');
    if (Object.keys(nextErrors).length) {
      setValidationMessage(Object.values(nextErrors).join(' '));
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    locked.current = true; setSaving(true);
    try {
      if (!session) {
        const employee = employees.find(item => item.id === values.assigneeId)!;
        const task: LocalTask = {
          id: `local-task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, title: values.title.trim(), type: values.type,
          assigneeId: employee.id, assigneeName: String(employee.name), dueDate: values.dueDate, dueTime: values.dueTime,
          priority: values.priority, description: values.description.trim(), createdAt: new Date().toISOString(),
        };
        const tasks = await saveLocalTask(task);
        if (mounted.current) { setLocalTasks(tasks); setSaved(task); scroll.current?.scrollTo({ y: 0, animated: true }); }
        return;
      }
      const result = await request<WorkforceRecord>(session, 'post', '/tasks', { data: { ...payload(fields, values), status: 'TODO', relatedLeadId: null } });
      if (!result || typeof result.id !== 'string') throw new WorkforceError('The server did not return the saved task. Refresh tasks before retrying.');
      if (mounted.current) router.replace({ pathname: '/workforce/[resource]/[id]', params: { resource: 'tasks', id: result.id } });
    } catch (cause) { if (mounted.current) {
      setError(session ? axios.isAxiosError(cause) && cause.response?.status === 404
        ? new WorkforceError('The task assignment service is not available yet. Your task has not been saved.')
        : asWorkforceError(cause) : new WorkforceError('Unable to save the task on this device. Your details are still here; try again.'));
      scroll.current?.scrollTo({ y: 0, animated: true });
    } }
    finally { locked.current = false; if (mounted.current) setSaving(false); }
  };
  const newTask = () => {
    setSaved(null); setErrors({}); setError(null); setValidationMessage('');
    setValues({ title: '', type: 'TASK', assigneeId: '', dueDate: '', dueTime: '11:00', priority: 'NORMAL', description: '' });
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const home = () => router.push(session ? '/workforce' : '/');
  const people = () => router.push(session ? '/workforce/employees' : '/employees-preview');
  const account = session ? () => router.push('/workforce/account') : undefined;
  const payroll = session && can(session, 'payroll.read') ? () => router.push('/workforce/payroll') : undefined;
  if (!permitted) return <State title="Access restricted" message="Your role cannot assign tasks in the selected branch." />;
  const selectedEmployee = employees.find(item => item.id === values.assigneeId);
  const input = (key: string, title: string, options: { required?: boolean; multiline?: boolean; date?: boolean; time?: boolean } = {}) => <View style={s.field}>
    <Text style={s.fieldLabel}>{title}{options.required ? ' *' : ''}</Text>
    {Platform.OS === 'web' && (options.date || options.time) ? createElement('input', {
      type: options.date ? 'date' : 'time', 'aria-label': title, value: values[key], disabled: saving,
      onChange: (event: { target: { value: string } }) => change(key, event.target.value),
      style: { width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '12px 13px', border: '1px solid #DDE5F3', borderRadius: 13, background: '#FCFDFF', color: '#354B69', fontSize: 16, fontFamily: 'inherit' },
    }) : <TextInput accessibilityLabel={title} style={[s.input, options.multiline && t.textarea]} editable={!saving} value={values[key]} onChangeText={value => change(key, value)} multiline={options.multiline} maxLength={key === 'title' ? 120 : key === 'description' ? 2000 : undefined} placeholder={options.date ? 'YYYY-MM-DD' : options.time ? 'HH:mm' : undefined} />}
    {!!errors[key] && <Text style={s.error} accessibilityLiveRegion="polite">{errors[key]}</Text>}
  </View>;
  const select = (title: string, value: string, target: Picker | null, key?: string) => <View style={s.field}><Text style={s.fieldLabel}>{title}</Text><Pressable accessibilityRole="button" disabled={saving || !target} onPress={() => setPicker(target)} style={[s.input, t.select]}><Text style={[s.reviewValue, { flex: 1 }]}>{value}</Text>{target && <Text style={s.backText}>⌄</Text>}</Pressable>{!!key && !!errors[key] && <Text style={s.error}>{errors[key]}</Text>}</View>;
  const visibleEmployees = session ? employees : employees.filter(item => `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase()));
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.phone}>
    <View style={s.header}><View style={s.headerTop}><View style={{ flex: 1, gap: 5 }}><Text style={s.company}>{company}</Text><Text style={s.headerCaption}>Business workspace</Text></View><View style={s.avatar}><Text style={s.initials}>BS</Text></View></View>{branch && <View style={s.scopeRow}><View style={s.scope}><Text style={s.scopeLabel}>Company</Text><Text style={s.scopeValue} numberOfLines={1}>{company}</Text></View><View style={[s.scope, s.branch]}><Text style={s.scopeLabel}>Branch</Text><Text style={s.scopeValue} numberOfLines={1}>{branch}</Text></View></View>}</View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.back()} style={s.back}><Text style={s.backText}>‹  Back</Text></Pressable>
      <View style={{ gap: 8 }}><Text style={s.title}>Assign a task</Text><Text style={s.subtitle}>Give an employee clear instructions and a deadline.</Text></View>
      {!!validationMessage && <View style={t.info}><Text style={s.error} accessibilityLiveRegion="assertive">{validationMessage}</Text></View>}
      {error && <ErrorState error={error} retry={() => setError(null)} />}
      {saved ? <View style={s.card}><Text style={s.cardTitle}>Task saved on this device</Text><Text style={s.reviewValue}>{saved.title}</Text><Text style={s.reviewValue}>Assigned to: {saved.assigneeName}</Text><Text style={s.reviewValue}>Due: {saved.dueDate} at {saved.dueTime}</Text><Text style={s.hint}>This local task stays after refresh. Employee delivery requires the connected task service.</Text></View> : <View style={s.card}>
        {input('title', 'Task title', { required: true })}
        {select('Type', labels[values.type], 'type', 'type')}
        {select('Branch', branch || 'Current workspace', null)}
        {select('Assign to employee *', selectedEmployee ? String(selectedEmployee.name) : 'Select employee', 'employee', 'assigneeId')}
        {input('dueDate', 'Due date', { required: true, date: true })}
        {input('dueTime', 'Due time', { required: true, time: true })}
        {select('Priority', labels[values.priority], 'priority', 'priority')}
        {select('Related lead (optional)', 'No linked lead', null)}
        {input('description', 'Instructions / expected outcome', { multiline: true })}
        <View style={t.info}><Text style={t.infoSymbol}>ⓘ</Text><Text style={[s.hint, { flex: 1 }]}>Employee needs an enabled login and task access to view this assignment.</Text></View>
      </View>}
      {!session && localTasks.length > 0 && <View style={s.card}><Text style={s.cardTitle}>Tasks saved on this device</Text>{localTasks.map(task => <View key={task.id} style={s.review}><Text style={s.reviewValue}>{task.title}</Text><Text style={s.hint}>{task.assigneeName} · {task.dueDate} at {task.dueTime} · {labels[task.priority]}</Text></View>)}</View>}
    </ScrollView>
    <View style={s.actions}><Pressable accessibilityRole="button" disabled={saving} onPress={() => router.back()} style={s.cancel}><Text style={s.cancelText}>{saved ? 'Back' : 'Cancel'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={saved ? newTask : () => void save()} style={[s.continue, saving && { opacity: 0.5 }]}><Text style={s.continueText}>{saving ? 'Assigning…' : saved ? 'Assign another task' : 'Assign task'}</Text></Pressable></View>
    <View style={s.bottom}>{[{ title: 'Home', press: home }, { title: 'CRM', press: undefined }, { title: 'People', press: people }, { title: 'Payroll', press: payroll }, { title: 'More', press: account }].map(item => <Pressable key={item.title} accessibilityRole="button" accessibilityState={{ selected: item.title === 'People', disabled: saving || !item.press }} disabled={saving || !item.press} onPress={item.press} style={[s.nav, item.title === 'People' && { backgroundColor: '#EDF2FF' }]}><WorkspaceIcon size={24} name={item.title} color={item.title === 'People' ? '#315BF3' : !item.press ? '#B0BACA' : '#7A8CA6'} /><Text style={[s.navText, item.title === 'People' && { color: '#315BF3' }, !item.press && { color: '#B0BACA' }]}>{item.title}</Text></Pressable>)}</View>
    <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}><View style={s.modalOverlay}><View style={s.modalCard}><Text style={s.cardTitle}>{picker === 'employee' ? 'Choose employee' : picker === 'type' ? 'Task type' : 'Priority'}</Text>
      {picker === 'employee' && <TextInput accessibilityLabel="Find employee" style={s.input} value={search} onChangeText={setSearch} placeholder="Search employees" />}
      <ScrollView keyboardShouldPersistTaps="handled">{picker === 'employee' ? <>
        {loading && <Text style={s.hint}>Loading employees…</Text>}{optionError && <ErrorState error={optionError} retry={() => setRetry(value => value + 1)} />}
        {visibleEmployees.map(employee => <Pressable key={employee.id} accessibilityRole="button" onPress={() => { change('assigneeId', employee.id); setPicker(null); }} style={s.departmentOption}><Text style={s.reviewValue}>{String(employee.name)}</Text><Text style={s.hint}>{String(employee.email || employee.jobTitle || '')}</Text></Pressable>)}
        {!loading && !optionError && !visibleEmployees.length && <Text style={s.hint}>No employees found.</Text>}
        {cursor && <Pressable accessibilityRole="button" disabled={loading} onPress={() => void loadEmployees(true)} style={s.departmentOption}><Text style={s.reviewValue}>Load more employees</Text></Pressable>}
      </> : (fields.find(field => field.key === picker)?.options ?? []).map(option => <Pressable key={option} accessibilityRole="button" onPress={() => { change(picker!, option); setPicker(null); }} style={s.departmentOption}><Text style={s.reviewValue}>{labels[option]}</Text></Pressable>)}</ScrollView>
      <Pressable accessibilityRole="button" onPress={() => setPicker(null)} style={[s.cancel, { flex: 0 }]}><Text style={s.cancelText}>Close</Text></Pressable>
    </View></View></Modal>
  </View></KeyboardAvoidingView>;
}
const t = StyleSheet.create({ select: { flexDirection: 'row', alignItems: 'center', gap: 10 }, textarea: { minHeight: 112, textAlignVertical: 'top' }, info: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#F4F7FF', borderWidth: 1, borderColor: '#E6ECFA' }, infoSymbol: { color: '#315BF3', fontSize: 16 } });
