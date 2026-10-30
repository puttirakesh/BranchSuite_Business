import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useWorkspace } from '../../../core/providers/AppProviders';
import AppCard, { AdminPage, RecordLink } from '../../../shared/components/AppCard';
import AppInput from '../../../shared/components/AppInput';
import AppButton from '../../../shared/components/AppButton';
import ErrorState from '../../../shared/components/ErrorState';
export default function OfferForm({ id }: { id?: string }) {
  const { db, command } = useWorkspace();
  const existing = db?.coupons.find(offer => offer.id === id);
  const [code, setCode] = useState(existing?.code || '');
  const [percent, setPercent] = useState(String(existing?.percent ?? 10));
  const [maxUses, setMaxUses] = useState(String(existing?.maxUses ?? 100));
  const [expiresOn, setExpiresOn] = useState(existing?.expiresOn || '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (id && !existing) return <AdminPage title="Offer unavailable"><RecordLink title="Back to offers" href="/(admin)/offers" /></AdminPage>;
  async function save() {
    if (saving) return;
    setSaving(true); setError('');
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || new Date(expiresOn).toISOString().slice(0, 10) !== expiresOn) throw Error('Enter a valid expiry date as YYYY-MM-DD.');
      await command('editCoupon', id, { code, percent: Number(percent), maxUses: Number(maxUses), expiresOn, enabled });
      router.replace('/(admin)/offers');
    } catch (error) { setError(error instanceof Error ? error.message : 'Offer could not be saved.'); }
    finally { setSaving(false); }
  }
  return <AdminPage title={id ? 'Edit offer' : 'Create offer'} subtitle="Offer codes apply to local demo subscription invoices.">
    <RecordLink title="Back to offers" href="/(admin)/offers" />
    <AppCard><AppInput label="Offer code" value={code} onChangeText={setCode} autoCapitalize="characters" /><AppInput label="Discount (%)" value={percent} onChangeText={setPercent} keyboardType="numeric" /><AppInput label="Maximum uses" value={maxUses} onChangeText={setMaxUses} keyboardType="numeric" /><AppInput label="Expiry (YYYY-MM-DD)" value={expiresOn} onChangeText={setExpiresOn} />
    <Text>Completed uses: {existing?.used ?? 0}</Text><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text>Offer enabled</Text><Switch accessibilityLabel="Offer enabled" value={enabled} onValueChange={setEnabled} /></View>
    {!!error && <ErrorState message={error} />}<AppButton title={saving ? 'Saving…' : 'Save offer'} disabled={saving} onPress={() => void save()} /></AppCard>
  </AdminPage>;
}

