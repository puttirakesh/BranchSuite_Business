import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { employeesApi, leaveApi, type LeaveRequestDto } from '../core/admin/api';
import { reportingManagerOptions } from '../core/admin/reporting-managers';
import { useAuth } from '../core/auth/AuthProvider';
import { companyRoles } from '../core/admin/role-capabilities';
import { apiErrorMessage } from '../core/admin/http';
import { SelectField } from './SelectField';
import { FloatingTextInput } from './FloatingTextInput';

export function LeaveReassignment({ request, onChanged }: { request: LeaveRequestDto; onChanged: () => unknown }) {
  const { session } = useAuth();
  const permitted = companyRoles(session, request.companyId).some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<{ value: string; label: string }[]>([]);
  const [manager, setManager] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    employeesApi.reportingManagers(request.companyId).then(users => { if (active) setOptions(reportingManagerOptions(users.filter(user => user.id !== request.userId), [], request.companyId, request.branchId)); })
      .catch(cause => { if (active) setError(apiErrorMessage(cause, 'Unable to load managers.')); });
    return () => { active = false; };
  }, [open, request.companyId, request.branchId, request.userId]);
  if (!permitted || request.status !== 'PENDING') return null;
  async function save() {
    if (busy) return;
    if (!manager || reason.trim().length < 3) { setError('Choose a manager and explain the reassignment.'); return; }
    setBusy(true); setError('');
    try { await leaveApi.reassign(request.id, manager, reason.trim()); setOpen(false); onChanged(); }
    catch (cause) { setError(apiErrorMessage(cause, 'Unable to reassign leave.')); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text>Reviewer: {request.reportingTo?.name ?? 'Not assigned'}</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => setOpen(value => !value)}><Text>{open ? 'Close reassignment' : 'Reassign reviewer'}</Text></Pressable>
    {open && <>
      <SelectField label="New approving manager" value={manager} options={options} onChange={setManager} disabled={busy} />
      <FloatingTextInput label="Reason for reassignment" value={reason} onChangeText={setReason} maxLength={500} editable={!busy} />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void save(); }}><Text>{busy ? 'Saving…' : 'Save reviewer'}</Text></Pressable>
    </>}
  </View>;
}
