import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useWorkspace } from '../../../core/providers/AppProviders';
import AppCard, { AdminPage, RecordLink } from '../../../shared/components/AppCard';
import AppInput from '../../../shared/components/AppInput';
import AppButton from '../../../shared/components/AppButton';
import ErrorState from '../../../shared/components/ErrorState';
import type { Plan } from '../types';

const limits = ['monthly', 'annual', 'employees', 'branches', 'companies', 'users', 'trialDays'] as const;
const labels = { monthly: 'Monthly price (INR)', annual: 'Annual price (INR)', employees: 'Employees', branches: 'Branches', companies: 'Companies', users: 'Users', trialDays: 'Trial days' };
export default function PlanForm({ id }: { id?: string }) {
  const { db, command } = useWorkspace();
  const existing = db?.plans.find(plan => plan.id === id);
  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [features, setFeatures] = useState(existing?.features || { crm: true, people: true, payroll: true, reports: true });
  const [values, setValues] = useState(() => Object.fromEntries(limits.map(key => [key, String(existing?.[key] ?? (key === 'monthly' || key === 'annual' ? 0 : 1))])) as Record<typeof limits[number], string>);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (id && !existing) return <AdminPage title="Plan unavailable"><RecordLink title="Back to plans" href="/(admin)/plans" /></AdminPage>;
  async function save() {
    if (saving) return;
    setSaving(true); setError('');
    try {
      if (limits.some(key => !values[key].trim())) throw Error('Complete every price and limit.');
      const input = { name, description, enabled, features, ...Object.fromEntries(limits.map(key => [key, Number(values[key])])) } as Plan;
      await command(id ? 'editPlan' : 'createPlan', id, input);
      router.replace('/(admin)/plans');
    } catch (error) { setError(error instanceof Error ? error.message : 'Plan could not be saved.'); }
    finally { setSaving(false); }
  }
  return <AdminPage title={id ? 'Edit plan' : 'Create plan'} subtitle="Prices and limits are local demo settings. Existing customer usage is checked before saving.">
    <RecordLink title="Back to plans" href="/(admin)/plans" />
    <AppCard><AppInput label="Plan name" value={name} onChangeText={setName} /><AppInput label="Description" value={description} onChangeText={setDescription} multiline />
      {limits.map(key => <AppInput key={key} label={labels[key]} keyboardType="numeric" value={values[key]} onChangeText={value => setValues(current => ({ ...current, [key]: value }))} />)}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text>Plan enabled</Text><Switch accessibilityLabel="Plan enabled" value={enabled} onValueChange={setEnabled} /></View>
      {Object.entries(features).map(([key, value]) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text>{key.toUpperCase()}</Text><Switch accessibilityLabel={key + ' module'} value={value} onValueChange={value => setFeatures(current => ({ ...current, [key]: value }))} /></View>)}
      {!!error && <ErrorState message={error} />}<AppButton title={saving ? 'Saving…' : 'Save plan'} disabled={saving} onPress={() => void save()} />
    </AppCard>
  </AdminPage>;
}

