import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { asWorkforceError, getRecord, request, WorkforceError } from './api';
import { label, resources } from './resources';
import { can } from './session';
import { Action, Field, Resource, Session, WorkforceRecord } from './types';
import { Button, ErrorState, SessionGate, State, styles } from './ui';
import { isTimestamp } from './validation';
import { EmployeeAvatar, EmployeeStatus, employeeStyles } from './EmployeeUI';
import { employeeStepFields } from './employeeFlow';
import { confirmAction } from './confirm';

export default function DetailScreen({ resource, id }: { resource: Resource; id: string }) {
  return <SessionGate>{session => <ScopedDetail key={`${resource}:${id}:${session.userId}:${session.scope.tenantId}:${session.scope.companyId}:${session.scope.branchId}:${session.accessToken}`} resource={resource} id={id} session={session} />}</SessionGate>;
}
function ScopedDetail({ resource, id, session }: { resource: Resource; id: string; session: Session }) {
  const config = resources[resource];
  const [record, setRecord] = useState<WorkforceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<WorkforceError | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const alive = useRef(false);
  const mutationLock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const readable = can(session, `${config.permission}.read`);
  const load = async () => {
    if (!readable) { setLoading(false); return; }
    controller.current?.abort(); const current = new AbortController(); controller.current = current;
    setLoading(true); setError(null);
    try {
      const result = await getRecord(session, resource, id, current.signal);
      if (alive.current && !current.signal.aborted) setRecord(result);
    } catch (cause) {
      if (alive.current && !current.signal.aborted) { setRecord(null); setError(asWorkforceError(cause)); }
    } finally { if (alive.current && !current.signal.aborted) setLoading(false); }
  };
  useFocusEffect(useCallback(() => {
    alive.current = true; void load();
    return () => { alive.current = false; controller.current?.abort(); };
  }, [resource, id, readable]));
  const mutate = async (path: string, body?: Record<string, string>) => {
    if (!alive.current || mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setError(null);
    try {
      await request(session, 'post', `${config.endpoint}/${encodeURIComponent(id)}/${path}`, { data: body ?? {} });
      if (alive.current) { setPaymentReference(''); setPaidAt(''); await load(); }
    } catch (cause) { if (alive.current) setError(asWorkforceError(cause)); }
    finally { mutationLock.current = false; if (alive.current) setBusy(false); }
  };
  const confirm = (action: Action) => confirmAction(action.label, `Confirm this action for ${String(record?.[config.titleKey] ?? config.singular)} in ${session.scope.branchName}?`, 'Confirm', () => void mutate(action.path, action.body));
  const markPaid = () => {
    if (!paymentReference.trim() || paymentReference.trim().length > 200 || !isTimestamp(paidAt.trim())) {
      setPaymentError('Enter a payment reference (up to 200 characters) and a valid payment time with timezone.'); return;
    }
    if (Date.parse(paidAt.trim()) > Date.now()) { setPaymentError('The payment time cannot be in the future.'); return; }
    setPaymentError('');
    confirmAction('Confirm salary payment', 'Only confirm once the salary transfer has succeeded. This records payment status; it does not transfer money.', 'Record payment', () => void mutate('payment-status', { paymentStatus: 'PAID', paymentReference: paymentReference.trim(), paidAt: paidAt.trim() }));
  };
  if (!readable) return <State title="Access restricted" message="Your role cannot view this record in the selected branch." />;
  if (loading) return <State title="Loading details" busy />;
  if (!record) return error ? <ErrorState error={error} retry={() => void load()} /> : <State title="Record unavailable" />;
  const fields = [...config.fields, ...config.detailFields];
  const display = (field: Field) => {
    const value = record[field.key];
    if (value == null || value === '') return '—';
    if (field.kind === 'employee') return String(record.employeeName ?? record.assigneeName ?? 'Assigned employee');
    if (field.kind === 'money') return `${String(record.currency ?? '')} ${String(value)}`.trim();
    if (field.options || ['status', 'paymentStatus'].includes(field.key)) return label(String(value));
    return String(value);
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>{session.scope.branchName}</Text><Text style={styles.heading}>{String(record[config.titleKey] ?? config.singular)}</Text>
    {resource === 'employees' ? <>
      <View style={styles.card}>
        <View style={employeeStyles.personRow}>
          <EmployeeAvatar name={String(record.name ?? 'Employee')} large />
          <View style={employeeStyles.personText}><Text style={styles.title}>{String(record.name ?? 'Employee')}</Text>
            <Text style={styles.description}>{String(record.jobTitle ?? record.department ?? '')}</Text>
            {record.status && <EmployeeStatus status={String(record.status)} />}
          </View>
        </View>
      </View>
      {[{ title: 'Contact details', step: 0 }, { title: 'Employment details', step: 1 }].map(section => <View key={section.title} style={styles.card}>
        <Text style={styles.title}>{section.title}</Text>
        {employeeStepFields(config.fields, section.step).filter(field => !['name', 'status'].includes(field.key)).map(field => <View key={field.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{field.label}</Text><Text selectable style={styles.description}>{display(field)}</Text>
        </View>)}
        {section.step === 1 && <View style={styles.field}><Text style={styles.fieldLabel}>Branch</Text><Text style={styles.description}>{session.scope.branchName}</Text></View>}
      </View>)}
    </> : <View style={styles.card}>{fields.map(field => <View key={field.key} style={styles.field}>
      <Text style={styles.fieldLabel}>{field.label}</Text><Text selectable style={styles.description}>{display(field)}</Text>
    </View>)}</View>}
    {error && <ErrorState error={error} retry={() => void load()} />}
    {config.editable && can(session, `${config.permission}.update`) && <Button title={`Edit ${config.singular.toLowerCase()}`} disabled={busy}
      onPress={() => router.push({ pathname: '/workforce/[resource]/[id]/edit', params: { resource, id } })} />}
    {config.actions?.filter(action => can(session, action.permission) && action.allowedStatuses.includes(String(record.status)))
      .map(action => <Button key={action.path} title={busy ? 'Processing…' : action.label} onPress={() => confirm(action)} disabled={busy} secondary />)}
    {resource === 'payslips' && can(session, 'payslips.payment.update') && ['UNPAID', 'PENDING', 'FAILED'].includes(String(record.paymentStatus)) && record.status === 'APPROVED' && <View style={styles.card}>
      <Text style={styles.title}>Record salary payment</Text>
      <Text style={styles.description}>Record a completed salary transfer against this payslip.</Text>
      <Text style={styles.fieldLabel}>Payment reference</Text>
      <TextInput style={styles.input} value={paymentReference} onChangeText={setPaymentReference} accessibilityLabel="Payment reference" editable={!busy} maxLength={200} />
      <Text style={styles.fieldLabel}>Paid on (with timezone)</Text>
      <TextInput style={styles.input} value={paidAt} onChangeText={setPaidAt} accessibilityLabel="Payment time" autoCapitalize="none" editable={!busy} placeholder="2026-10-07T09:00:00+05:30" />
      {!!paymentError && <Text style={styles.error} accessibilityLiveRegion="polite">{paymentError}</Text>}
      <Button title={busy ? 'Saving…' : 'Mark salary paid'} disabled={busy} onPress={markPaid} />
    </View>}
    <Button title="Refresh details" secondary disabled={busy} onPress={() => void load()} />
  </ScrollView>;
}
