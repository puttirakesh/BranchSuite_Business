import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, SelectField, TextField } from '../../../shared/components';
import { useAuth } from '../../../core/auth/AuthContext';
import { useSupportAction, useSupportAgents, useSupportFocus } from '../../../shared/hooks/support-queries';
import { env } from '../../../core/config/env';
import type { Ticket } from '../types';

export function SupportOperationsPanel({ ticket }: { ticket: Ticket }) {
  const { user } = useAuth();
  const agents = useSupportAgents();
  const action = useSupportAction(), read = useSupportAction();
  const focused = useSupportFocus();
  const [agentId, setAgentId] = useState(ticket.assignedToId ?? '');
  const [reason, setReason] = useState(''), [error, setError] = useState('');
  const lock = useRef(false), acknowledged = useRef(new Map<string, number>());
  useEffect(() => setAgentId(ticket.assignedToId ?? ''), [ticket.assignedToId]);
  useEffect(() => {
    const version = ticket.customerActivityVersion;
    if (focused && env.dataMode === 'api' && version && (acknowledged.current.get(ticket.id) ?? 0) < version) {
      // The detail body is committed/visible before acknowledging exactly its observed version.
      read.mutate({ path: `tickets/${ticket.id}/read`, method: 'POST', body: { customerActivityVersion: version } }, { onSuccess: () => { acknowledged.current.set(ticket.id, version); } });
    }
  }, [focused, ticket.id, ticket.customerActivityVersion]);
  if (env.dataMode !== 'api' || ticket.supportRevision === undefined) return null;
  const admin = user?.role === 'PLATFORM_ADMIN';
  async function perform(suffix: string, method: 'POST' | 'PATCH', body: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true; setError('');
    try { await action.mutateAsync({ path: `tickets/${ticket.id}/${suffix}`, method, body: { ...body, expectedRevision: ticket.supportRevision } }); setReason(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update Support operations.'); }
    finally { lock.current = false; }
  }
  const pending = action.isPending;
  return <Card style={{ marginBottom: 16 }}><View style={{ gap: 12 }}>
    <Text style={{ fontWeight: '700' }}>Ownership and service targets</Text>
    <Text>Assigned agent: {ticket.assignedTo?.name ?? 'Unassigned'}{ticket.assignedTo && ticket.assignedTo.status !== 'ACTIVE' ? ' (inactive)' : ''}</Text>
    {admin ? <><SelectField label="Assign Support agent" value={agentId} onChange={setAgentId} disabled={pending} options={[{ value: '', label: 'Unassigned' }, ...(agents.data ?? []).map(a => ({ value: a.id, label: a.name }))]} />
      <Button label="Save assignment" variant="secondary" disabled={pending || agentId === (ticket.assignedToId ?? '')} onPress={() => void perform('assignment', 'PATCH', { agentId: agentId || null })} />
    </> : !ticket.assignedToId ? <Button label="Claim unassigned ticket" disabled={pending} onPress={() => void perform('claim', 'POST', {})} /> : null}
    {agents.error && <Text accessibilityRole="alert">Could not load active agents. Refresh the screen to retry.</Text>}
    <Text>Initial-cycle SLA: {(ticket.slaState ?? 'NOT_TRACKED').replaceAll('_', ' ').toLowerCase()}</Text>
    <Text>UTC calendar-hour development targets, not contractual commitments. Priority changes and reopening preserve these initial outcomes.</Text>
    {ticket.responseDueAt && <Text>First response due: {new Date(ticket.responseDueAt).toLocaleString()}</Text>}
    {ticket.resolutionDueAt && <Text>First resolution due: {new Date(ticket.resolutionDueAt).toLocaleString()}</Text>}
    {ticket.firstResponseAt && <Text>First public Support response: {new Date(ticket.firstResponseAt).toLocaleString()}</Text>}
    {ticket.resolvedAt && <Text>First resolution: {new Date(ticket.resolvedAt).toLocaleString()}</Text>}
    <Text>Escalation: {(ticket.escalationStatus ?? 'NONE').toLowerCase()}</Text>
    {ticket.escalationReason && <Text>Staff-only reason: {ticket.escalationReason}</Text>}
    {ticket.escalatedAt && <Text>Requested: {new Date(ticket.escalatedAt).toLocaleString()}</Text>}
    <TextField label="Staff-only escalation reason" value={reason} onChangeText={setReason} multiline maxLength={2000} editable={!pending} />
    {!['REQUESTED','ACKNOWLEDGED'].includes(ticket.escalationStatus ?? '') && <Button label="Request escalation" disabled={pending || reason.trim().length < 5} onPress={() => void perform('escalation', 'POST', { reason: reason.trim() })} />}
    {admin && ticket.escalationStatus === 'REQUESTED' && <Button label="Acknowledge escalation" disabled={pending} onPress={() => void perform('escalation', 'PATCH', { status: 'ACKNOWLEDGED', ...(reason.trim() ? { reason: reason.trim() } : {}) })} />}
    {admin && ['REQUESTED','ACKNOWLEDGED'].includes(ticket.escalationStatus ?? '') && <Button label="Resolve escalation" disabled={pending} onPress={() => void perform('escalation', 'PATCH', { status: 'RESOLVED', ...(reason.trim() ? { reason: reason.trim() } : {}) })} />}
    {!!error && <Text accessibilityRole="alert">{error}</Text>}
    {read.error && <Text accessibilityRole="alert">Unread acknowledgement failed. Reopen this ticket to retry.</Text>}
  </View></Card>;
}
