import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ToastModal as Modal } from './Toast';
import { FloatingTextInput } from './FloatingTextInput';
import { payrollApi } from '../core/admin/api';
import { getAvailableBranches } from '../core/admin/available-branches';
import { getAdminScope, resolveBranchId } from '../core/admin/scope';
import { apiErrorMessage } from '../core/admin/http';

export function PayrollReturnButton({ branch, period, disabled, onReturned }: { branch: string; period: string; disabled: boolean; onReturned: () => void }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const submit = async () => {
    if (saving || !reason.trim()) return;
    setSaving(true); setError('');
    try {
      const scope = await getAdminScope();
      const branchId = resolveBranchId(await getAvailableBranches(scope.companyId), branch);
      if (!branchId) throw new Error('Select an assigned branch.');
      const [year, month] = period.split('-').map(Number);
      const selected = (await payrollApi.periods(scope.companyId, branchId)).find(item => item.year === year && item.month === month);
      if (!selected?.run?.canApprove) throw new Error('Payroll is no longer available for your review. Refresh and retry.');
      await payrollApi.returnForChanges(selected.run.id, reason.trim());
      setOpen(false); setReason(''); onReturned();
    } catch (cause) { setError(apiErrorMessage(cause, 'Could not return payroll.')); } finally { setSaving(false); }
  };
  return <>
    <Pressable accessibilityRole="button" disabled={disabled || saving} onPress={() => { setError(''); setOpen(true); }} style={{ padding: 13, borderWidth: 1, borderColor: '#D6E0EF', borderRadius: 10, alignItems: 'center', marginVertical: 10 }}><Text style={{ color: '#345cf2', fontWeight: '700' }}>Return payroll for changes</Text></Pressable>
    <Modal transparent visible={open} onRequestClose={() => { if (!saving) setOpen(false); }} animationType="fade"><View style={{ flex: 1, backgroundColor: '#17263F80', justifyContent: 'center', alignItems: 'center', padding: 20 }}><View style={{ width: '100%', maxWidth: 480, padding: 24, backgroundColor: 'white', borderRadius: 16, gap: 16 }}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', color: '#20334f' }}>Return payroll for changes</Text>
      <Text style={{ color: '#607086', lineHeight: 20 }}>{branch} · {period}. The preparer must correct the inputs and calculate again before a manager can approve.</Text>
      <FloatingTextInput label="Reason for returning payroll" value={reason} onChangeText={setReason} multiline maxLength={1000} editable={!saving} />
      {!!error && <Text accessibilityRole="alert" style={{ color: '#B42318' }}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={saving || !reason.trim()} onPress={() => void submit()} style={{ backgroundColor: '#345cf2', padding: 14, borderRadius: 10, alignItems: 'center', opacity: saving || !reason.trim() ? 0.5 : 1 }}><Text style={{ color: 'white', fontWeight: '700' }}>{saving ? 'Returning…' : 'Confirm return for changes'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => setOpen(false)} style={{ padding: 10, alignItems: 'center' }}><Text>Cancel</Text></Pressable>
    </View></View></Modal>
  </>;
}
