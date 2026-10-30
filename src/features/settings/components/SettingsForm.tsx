import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useWorkspace } from '../../../core/providers/AppProviders';
import AppCard, { AdminPage } from '../../../shared/components/AppCard';
import AppInput from '../../../shared/components/AppInput';
import AppButton from '../../../shared/components/AppButton';
import ErrorState from '../../../shared/components/ErrorState';
export default function SettingsForm() {
  const { db, command } = useWorkspace();
  const [brand, setBrand] = useState(db?.platformSettings.brand || '');
  const [supportEmail, setSupportEmail] = useState(db?.platformSettings.supportEmail || '');
  const [trialEnabled, setTrialEnabled] = useState(db?.platformSettings.trialEnabled ?? true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    if (saving) return;
    setSaving(true); setError(''); setMessage('');
    try { await command('saveSettings', undefined, { brand, supportEmail, trialEnabled }); setMessage('Platform settings saved.'); }
    catch (error) { setError(error instanceof Error ? error.message : 'Settings could not be saved.'); }
    finally { setSaving(false); }
  }
  return <AdminPage title="Platform settings" subtitle="Branding and support details for the admin workspace."><AppCard>
    <AppInput label="Platform brand" value={brand} onChangeText={setBrand} /><AppInput label="Support email" value={supportEmail} onChangeText={setSupportEmail} keyboardType="email-address" autoCapitalize="none" />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text>Allow trials</Text><Switch accessibilityLabel="Allow trials" value={trialEnabled} onValueChange={setTrialEnabled} /></View>
    <Text>{db?.platformSettings.billingNote}</Text>{!!error && <ErrorState message={error} />}{!!message && <Text accessibilityRole="alert">{message}</Text>}<AppButton title={saving ? 'Saving…' : 'Save settings'} disabled={saving} onPress={() => void save()} />
  </AppCard></AdminPage>;
}

