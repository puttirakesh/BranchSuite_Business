import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { EmployeeAvatar, EmployeeStatus, employeeStyles } from './EmployeeUI';
import { employeeErrorStep, employeeStepFields } from './employeeFlow';
import { resources } from './resources';
import { WorkforceRecord } from './types';
import { Button, styles } from './ui';
import { payload, validate } from './validation';
import EmployeeDashboard from './EmployeeDashboard';
import { summarizeEmployees } from './employeeDashboardModel';
import { sampleEmployees } from './employeeSampleData';
import EmployeeOnboarding from './EmployeeOnboarding';

// Fictional records only. This preview never reads a session or calls a live API.
const fields = resources.employees.fields;
export default function EmployeePreview() {
  const { action } = useLocalSearchParams<{ action?: string }>();
  const [employees, setEmployees] = useState(() => sampleEmployees.map(employee => ({ ...employee })));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<WorkforceRecord | null>(null);
  const [editing, setEditing] = useState(action === 'new');
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(field => [field.key, field.options?.[0] ?? ''])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const startForm = (employee: WorkforceRecord | null) => {
    setSelected(employee); setStep(0); setErrors({}); setNotice('');
    setValues(Object.fromEntries(fields.map(field => [field.key, employee?.[field.key] != null ? String(employee[field.key]) : field.options?.[0] ?? ''])));
    setEditing(true);
  };
  const next = () => {
    const nextErrors = validate(employeeStepFields(fields, step), values); setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) setStep(previous => Math.min(2, previous + 1));
  };
  const savePreview = () => {
    const nextErrors = validate(fields, values); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setStep(Math.max(0, employeeErrorStep(nextErrors))); return; }
    const employee: WorkforceRecord = { id: selected?.id ?? `sample-${Date.now()}`, ...payload(fields, values) };
    setEmployees(previous => selected ? previous.map(item => item.id === selected.id ? employee : item) : [...previous, employee]);
    setSelected(null); setEditing(false); setSearch(''); setStatus('ALL');
    setNotice('Saved locally. Changes reset when you refresh the page.');
  };
  const matches = employees.filter(employee => (status === 'ALL' || employee.status === status)
    && [employee.name, employee.email, employee.department, employee.jobTitle].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  if (!editing && !selected) return <EmployeeDashboard employees={matches} summary={summarizeEmployees(employees)} branchName=""
    search={search} status={status === 'ALL' ? undefined : status as 'ACTIVE' | 'INACTIVE'} onSearch={setSearch} onStatus={value => setStatus(value ?? 'ALL')}
    onOpen={setSelected} onAdd={() => startForm(null)} onHome={() => router.push('/')} preview notice={notice} />;
  if (editing) return <EmployeeOnboarding step={step} values={values} errors={errors} editing={!!selected}
    onChange={(key, value) => { setValues(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); }}
    onContinue={next} onSave={savePreview} onBack={() => setStep(previous => Math.max(0, previous - 1))}
    onCancel={() => setEditing(false)} onPeople={() => { setEditing(false); setSelected(null); }} onHome={() => router.push('/')} />;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { maxWidth: 1040, width: '100%', alignSelf: 'center' }]}>
      <Text style={styles.eyebrow}>BranchSuite Business · Employees</Text>
      <Text style={styles.heading}>{editing ? selected ? 'Edit employee' : 'Add employee' : selected ? String(selected.name) : 'Employees'}</Text>
      {!!notice && <Text style={styles.description} accessibilityLiveRegion="polite">{notice}</Text>}
      {selected ? <>
        <View style={styles.card}><View style={employeeStyles.personRow}><EmployeeAvatar name={String(selected.name)} large />
          <View style={employeeStyles.personText}><Text style={styles.title}>{String(selected.name)}</Text><Text style={styles.description}>{String(selected.jobTitle)}</Text><EmployeeStatus status={String(selected.status)} /></View>
        </View></View>
        {[{ title: 'Contact details', step: 0 }, { title: 'Employment details', step: 1 }].map(section => <View key={section.title} style={styles.card}>
          <Text style={styles.title}>{section.title}</Text>
          {employeeStepFields(fields, section.step).filter(field => !['name', 'status'].includes(field.key)).map(field => <View key={field.key} style={styles.field}><Text style={styles.fieldLabel}>{field.label}</Text><Text style={styles.description}>{String(selected[field.key] ?? '—')}</Text></View>)}
        </View>)}
        <Button title="Edit employee" onPress={() => startForm(selected)} />
        <Button title="Back to Employees" secondary onPress={() => setSelected(null)} />
      </> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}
