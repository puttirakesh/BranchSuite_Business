import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../core/api/client';
import { apiErrorMessage } from '../core/admin/http';
import { useAuth } from '../core/auth/AuthProvider';
import { FloatingTextInput } from './FloatingTextInput';
import { useToastState } from './useToastState';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';

export type AdvancePayout = {
  id: string; amount: string; disbursedAt?: string | null; paymentReference?: string | null;
  recoveryMonthly?: string | null; recoveryStart?: string | null; employee?: { id: string };
  recoveries?: { amount: string; entry: { payment: { id: string } | null } }[];
};
export function AdvancePayoutForm({ advance, onSaved }: { advance: AdvancePayout; onSaved: () => void }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [monthly, setMonthly] = useState(advance.amount);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const currentMonth = parts.find(item => item.type === 'year')!.value + '-' + parts.find(item => item.type === 'month')!.value;
  const [start, setStart] = useState(currentMonth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useToastState('', 'error');
  const [, setNotice] = useToastState('', 'success');
  const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
  const save = async () => {
    if (saving) return;
    if (reference.trim().length < 3 || !/^\d{1,12}(\.\d{1,2})?$/.test(monthly) || Number(monthly) <= 0 || Number(monthly) > Number(advance.amount) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || start < currentMonth) {
      setError('Enter a payout reference, a positive recovery amount within the advance, and a recovery month starting this month or later.'); return;
    }
    setSaving(true); setError('');
    try {
      await api.post(`/advances/${advance.id}/disburse`, { reference: reference.trim(), recoveryMonthly: monthly, recoveryStart: start });
      setNotice('Advance payout recorded. Payroll recovery is scheduled.'); onSaved();
    } catch (cause) { setError(apiErrorMessage(cause, 'Could not record advance payout.')); } finally { setSaving(false); }
  };
  if (advance.disbursedAt) {
    const paid = (advance.recoveries ?? []).filter(item => item.entry.payment).reduce((sum, item) => sum + Number(item.amount), 0);
    const scheduled = (advance.recoveries ?? []).filter(item => !item.entry.payment).reduce((sum, item) => sum + Number(item.amount), 0);
    return <View style={{ gap: 6, padding: 12, backgroundColor: '#EDF7F4', borderRadius: 8 }}>
      <Text>Payout recorded: {new Date(advance.disbursedAt).toLocaleDateString('en-IN')}</Text>
      <Text>Reference: {advance.paymentReference}</Text>
      <Text>Monthly recovery: {money(Number(advance.recoveryMonthly))} from {advance.recoveryStart}</Text>
      <Text>Recovered: {money(paid)} · Scheduled in payroll: {money(scheduled)}</Text>
      <Text>Outstanding: {money(Math.max(0, Number(advance.amount) - paid))}</Text>
    </View>;
  }
  if (advance.employee?.id === session?.user.id) return <Text>Another payroll administrator must record your advance payout.</Text>;
  return <View style={styles.form}>
    <Pressable accessibilityRole="button" accessibilityLabel="Record advance payout" accessibilityState={{ expanded: open, disabled: saving }} onPress={() => setOpen(value => !value)} disabled={saving} style={[styles.secondary, saving && styles.disabled]}><Text style={styles.secondaryText}>Record advance payout</Text></Pressable>
    {open && <>
      <Text>Record this only after paying the employee. Payroll deducts up to the monthly amount from available take-home pay.</Text>
      <FloatingTextInput label="Payout reference" value={reference} onChangeText={setReference} maxLength={200} editable={!saving} />
      <FloatingTextInput label="Monthly recovery (INR)" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" editable={!saving} />
      <FloatingTextInput validation={{ kind: 'date', startsWith: 'digit', required: true, pattern: /^\d{4}-(0[1-9]|1[0-2])$/, patternMessage: 'Use YYYY-MM.' }} label="Recovery start month (YYYY-MM)" value={start} onChangeText={setStart} maxLength={7} editable={!saving} />
      {!!error && <Text accessibilityRole="alert" style={{ color: '#B42318' }}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Confirm paid advance and recovery" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={() => void save()} style={[styles.primary, saving && styles.disabled]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Confirm paid advance and recovery'}</Text></Pressable>
    </>}
  </View>;
}

const web = Platform.OS === 'web';
const styles = webWorkspaceStyles(StyleSheet.create({
  form: { minWidth: 0, gap: 16 },
  secondary: { minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: web ? webWorkspaceTheme.primaryLight : '#EDF7F4', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: web ? webWorkspaceTheme.primary : '#11786D', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  primary: { minHeight: 44, backgroundColor: web ? webWorkspaceTheme.primary : '#11786D', borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: 'white', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.5 },
}));
