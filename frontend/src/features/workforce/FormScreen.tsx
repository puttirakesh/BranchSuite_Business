import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { asWorkforceError, employeeOptions, getRecord, request, WorkforceError } from './api';
import { label, resources } from './resources';
import { can } from './session';
import { Field, Resource, Session, WorkforceRecord } from './types';
import { Button, ErrorState, SessionGate, State, styles } from './ui';
import { payload, validate } from './validation';
import { employeeErrorStep, employeeStepFields } from './employeeFlow';
import { confirmAction } from './confirm';
import EmployeeOnboarding from './EmployeeOnboarding';
import TaskAssignment from './TaskAssignment';

export default function FormScreen({ resource, id }: { resource: Resource; id?: string }) {
  if (resource === 'tasks' && !id) return <SessionGate>{session => <TaskAssignment key={`${session.userId}:${session.scope.branchId}:${session.accessToken}`} session={session} />}</SessionGate>;
  return <SessionGate>{session => <ScopedForm key={`${resource}:${id}:${session.userId}:${session.scope.tenantId}:${session.scope.companyId}:${session.scope.branchId}:${session.accessToken}`} resource={resource} id={id} session={session} />}</SessionGate>;
}
function ScopedForm({ resource, id, session }: { resource: Resource; id?: string; session: Session }) {
  const config = resources[resource];
  const permitted = can(session, `${config.permission}.${id ? 'update' : 'create'}`) && (id ? config.editable : !!config.createLabel);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<WorkforceError | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [employees, setEmployees] = useState<WorkforceRecord[]>([]);
  const [employeeCursor, setEmployeeCursor] = useState<string | null>(null);
  const [employeeError, setEmployeeError] = useState<WorkforceError | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const employeeController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const hasEmployee = config.fields.some(field => field.kind === 'employee');
  async function loadEmployees(append = false) {
    employeeController.current?.abort();
    const controller = new AbortController(); employeeController.current = controller;
    setEmployeeLoading(true); setEmployeeError(null);
    try {
      const page = await employeeOptions(session, resource, employeeSearch.trim(), append ? employeeCursor ?? undefined : undefined, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      setEmployees(previous => append ? [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))] : page.items);
      setEmployeeCursor(page.nextCursor);
    } catch (cause) { if (mounted.current && !controller.signal.aborted) setEmployeeError(asWorkforceError(cause)); }
    finally { if (mounted.current && !controller.signal.aborted) setEmployeeLoading(false); }
  }
  async function load() {
    if (!permitted) { setLoading(false); return; }
    setLoading(true); setError(null); setLoaded(false);
    try {
      const record = id ? await getRecord(session, resource, id) : null;
      if (!mounted.current) return;
      setOriginalStatus(record?.status ? String(record.status) : null);
      setValues(Object.fromEntries(config.fields.map(field => [field.key,
        record?.[field.key] != null ? String(record[field.key]) : field.options?.[0] ?? '',
      ])));
      setLoaded(true);
    } catch (cause) { if (mounted.current) setError(asWorkforceError(cause)); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; employeeController.current?.abort(); }; }, []);
  useEffect(() => {
    if (!hasEmployee || !permitted) return;
    const timer = setTimeout(() => void loadEmployees(), 300);
    return () => { clearTimeout(timer); employeeController.current?.abort(); };
  }, [employeeSearch]);
  const persist = async () => {
    if (!mounted.current || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const record = await request<WorkforceRecord>(session, id ? 'patch' : 'post', `${config.endpoint}${id ? `/${encodeURIComponent(id)}` : ''}`, { data: payload(config.fields, values) });
      if (!record || typeof record.id !== 'string') throw new WorkforceError('The server did not return the saved record. Refresh the list before retrying.');
      if (mounted.current) router.replace({ pathname: '/workforce/[resource]/[id]', params: { resource, id: record.id } });
    } catch (cause) { if (mounted.current) setError(asWorkforceError(cause)); }
    finally { savingRef.current = false; if (mounted.current) setSaving(false); }
  };
  const save = () => {
    if (savingRef.current) return;
    const nextErrors = validate(config.fields, values); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (resource === 'employees') { const first = employeeErrorStep(nextErrors); if (first >= 0) setStep(first); }
      return;
    }
    if (resource === 'employees' && id && originalStatus === 'ACTIVE' && values.status === 'INACTIVE') {
      confirmAction('Mark employee inactive?', `Save ${values.name.trim()} as inactive in this branch?`, 'Mark inactive', () => void persist());
    } else void persist();
  };
  const continueEmployee = () => {
    const nextErrors = validate(employeeStepFields(config.fields, step), values);
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) setStep(previous => Math.min(previous + 1, 2));
  };
  if (!permitted) return <State title="Access restricted" message="Your role cannot make this change in the selected branch." />;
  if (loading) return <State title="Loading form" busy />;
  if (!loaded && error) return <ErrorState error={error} retry={() => void load()} />;
  if (resource === 'employees') return <EmployeeOnboarding step={step} values={values} errors={errors} editing={!!id} saving={saving} error={error?.message}
    branchName={session.scope.branchName} companyName={session.scope.companyName}
    onChange={(key, value) => { setValues(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); }}
    onContinue={continueEmployee} onSave={save} onBack={() => setStep(previous => Math.max(0, previous - 1))}
    onCancel={() => router.back()} onPeople={() => router.push('/workforce/employees')} onHome={() => router.push('/workforce')} onAccount={() => router.push('/workforce/account')}
    onPayroll={can(session, 'payroll.read') ? () => router.push('/workforce/payroll') : undefined} />;
  function renderField(field: Field) {
    const value = values[field.key] ?? '';
    const change = (next: string) => { setValues(previous => ({ ...previous, [field.key]: next })); setErrors(previous => ({ ...previous, [field.key]: '' })); };
    return <View key={field.key} style={styles.field}>
      <Text style={styles.fieldLabel}>{field.label}{field.required ? ' *' : ''}</Text>
      {field.hint && <Text style={styles.description}>{field.hint}</Text>}
      {field.kind === 'choice' ? <View style={styles.row}>{field.options?.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: value === option, disabled: saving }} disabled={saving}
        onPress={() => change(option)} style={[styles.choice, value === option && styles.chosen]}><Text style={styles.description}>{label(option)}</Text></Pressable>)}</View>
      : field.kind === 'employee' ? <View style={{ gap: 8 }}>
        <TextInput style={styles.input} value={employeeSearch} onChangeText={setEmployeeSearch} placeholder="Find an employee" accessibilityLabel="Find an employee" editable={!saving} />
        {value && <Text style={styles.description}>Selected: {String(employees.find(item => item.id === value)?.name ?? 'Current employee')}</Text>}
        {employeeLoading && <Text style={styles.description}>Loading employees…</Text>}
        {employeeError && <ErrorState error={employeeError} retry={() => void loadEmployees()} />}
        {!employeeLoading && !employeeError && !employees.length && <Text style={styles.description}>No employees found in this branch.</Text>}
        {employees.map(item => <Pressable key={item.id} disabled={saving} accessibilityRole="radio" accessibilityState={{ selected: value === item.id }}
          onPress={() => change(item.id)} style={[styles.choice, value === item.id && styles.chosen]}><Text style={styles.description}>{String(item.name)} · {String(item.jobTitle ?? '')}</Text></Pressable>)}
        {employeeCursor && <Button title="More employees" secondary disabled={employeeLoading || saving} onPress={() => void loadEmployees(true)} />}
      </View> : <TextInput style={styles.input} value={value} onChangeText={change} editable={!saving}
        maxLength={field.maxLength} autoCorrect={field.kind !== 'email' && field.kind !== 'phone' && field.kind !== 'date' && field.kind !== 'datetime'}
        accessibilityLabel={field.label} autoCapitalize={field.key === 'currency' ? 'characters' : field.kind === 'email' || field.kind === 'datetime' ? 'none' : 'sentences'}
        keyboardType={field.kind === 'email' ? 'email-address' : field.kind === 'phone' ? 'phone-pad' : field.kind === 'money' ? 'decimal-pad' : 'default'}
        placeholder={field.kind === 'date' ? 'YYYY-MM-DD' : field.kind === 'datetime' ? '2026-10-07T09:00:00+05:30' : field.label} />}
      {!!errors[field.key] && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors[field.key]}</Text>}
    </View>;
  }
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{session.scope.branchName}</Text><Text style={styles.heading}>{id ? `Edit ${config.singular.toLowerCase()}` : config.createLabel}</Text>
      <Text style={styles.description}>Fields marked * are required.</Text>
      {config.fields.map(renderField)}
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error.message}</Text>}
      <Button title={saving ? "Saving?" : "Save"} disabled={saving} onPress={save} />
      <Button title="Cancel" secondary disabled={saving} onPress={() => router.back()} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
