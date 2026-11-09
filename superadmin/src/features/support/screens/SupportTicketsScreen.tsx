import { useLocalSearchParams } from 'expo-router';
import { useSupportAgents } from '../../../shared/hooks/support-queries';
import React, { useEffect, useState } from 'react';
import { Chips, EmptyState, ListScreen, PageHeader, SearchBox, SelectField, DatePickerField } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useTickets } from '../../../shared/hooks/queries';
import { TICKET_STATUSES, TICKET_PRIORITIES, type TicketPriority, type TicketStatus } from '../types';
import { TicketRow } from '../components/TicketRow';

const FILTERS = ['All', ...TICKET_STATUSES] as const;

/** APK `platform-support`, plus a status filter. */
export function SupportTicketsScreen() {
  const params = useLocalSearchParams<{ companyId?: string }>();
  const agents = useSupportAgents();
  const [view, setView] = useState<'ALL' | 'MINE' | 'UNASSIGNED'>('ALL');
  const [assignedToId, setAssignedToId] = useState(''), [slaState, setSlaState] = useState(''), [escalationStatus, setEscalationStatus] = useState(''), [unread, setUnread] = useState('All activity');
  const [createdFrom, setCreatedFrom] = useState(''), [createdTo, setCreatedTo] = useState(''), [updatedFrom, setUpdatedFrom] = useState(''), [updatedTo, setUpdatedTo] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('All');
  const [priority, setPriority] = useState('All');
  const [companyId, setCompanyId] = useState(typeof params.companyId === 'string' ? params.companyId : '');
  useEffect(() => { setCompanyId(typeof params.companyId === 'string' ? params.companyId : ''); setBranchId(''); setPage(1); }, [params.companyId]);
  const [branchId, setBranchId] = useState('');
  const q = useDebounce(search);
  const tickets = useTickets({ view, assignedToId: assignedToId || undefined, slaState: slaState || undefined, escalationStatus: escalationStatus || undefined, unread: unread === 'Unread' ? 'true' : undefined, createdFrom, createdTo, updatedFrom, updatedTo, search: q, status: status === 'All' ? undefined : (status as TicketStatus), priority: priority === 'All' ? undefined : priority as TicketPriority, companyId: companyId || undefined, branchId: branchId || undefined, page, limit: 20 });
  useEffect(() => setPage(1), [q, status, priority, companyId, branchId, view, assignedToId, slaState, escalationStatus, unread, createdFrom, createdTo, updatedFrom, updatedTo]);
  return (
    <ListScreen
      header={
        <>
          <PageHeader title="Customer support" subtitle="Product, subscription and access enquiries." />
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search subject, business or requester" />
          <SelectField label="Ticket ownership" value={view} onChange={value => { setView(value as typeof view); setAssignedToId(''); }} options={[{ value: 'ALL', label: 'All tickets' }, { value: 'MINE', label: 'My tickets' }, { value: 'UNASSIGNED', label: 'Unassigned' }]} />
          <SelectField label="Assigned agent" value={assignedToId} onChange={value => { setAssignedToId(value); setView('ALL'); }} options={[{ value: '', label: 'Any agent' }, ...(agents.data ?? []).map(a => ({ value: a.id, label: a.name }))]} />
          <Chips label="Read status" options={['All activity','Unread']} value={unread} onChange={setUnread} />
          <SelectField label="Initial SLA state" value={slaState} onChange={setSlaState} options={[{ value: '', label: 'All SLA states' }, ...['ON_TRACK','DUE_SOON','OVERDUE','MET','NOT_TRACKED'].map(value => ({ value, label: value.replaceAll('_',' ').toLowerCase() }))]} />
          <SelectField label="Escalation filter" value={escalationStatus} onChange={setEscalationStatus} options={[{ value: '', label: 'All escalation stages' }, ...['NONE','REQUESTED','ACKNOWLEDGED','RESOLVED'].map(value => ({ value, label: value.toLowerCase() }))]} />
          <DatePickerField label="Created from" value={createdFrom} onChange={setCreatedFrom} maxDate={createdTo || undefined} clearable />
          <DatePickerField label="Created through" value={createdTo} onChange={setCreatedTo} minDate={createdFrom || undefined} clearable />
          <DatePickerField label="Updated from" value={updatedFrom} onChange={setUpdatedFrom} maxDate={updatedTo || undefined} clearable />
          <DatePickerField label="Updated through" value={updatedTo} onChange={setUpdatedTo} minDate={updatedFrom || undefined} clearable />
          <Chips label="Ticket status" options={FILTERS} value={status} onChange={setStatus} />
          <Chips label="Ticket priority" options={['All', ...TICKET_PRIORITIES]} value={priority} onChange={setPriority} />
          <SelectField label="Company" value={companyId} onChange={value => { setCompanyId(value); setBranchId(''); }} options={[{ value: '', label: 'All companies' }, ...(tickets.data?.filters?.companies ?? []).map(c => ({ value: c.id, label: c.name }))]} />
          <SelectField label="Branch" value={branchId} onChange={setBranchId} options={[{ value: '', label: 'All branches' }, ...(tickets.data?.filters?.branches ?? []).filter(b => !companyId || b.companyId === companyId).map(b => ({ value: b.id, label: b.name }))]} />
        </>
      }
      data={tickets.data?.items}
      isPending={tickets.isPending}
      error={tickets.error}
      refetch={tickets.refetch}
      pagination={tickets.data}
      onPageChange={setPage}
      keyOf={(t) => t.id}
      renderItem={(t) => <TicketRow ticket={t} />}
      empty={
        q || status !== 'All' || priority !== 'All' || companyId || branchId || view !== 'ALL' || assignedToId || slaState || escalationStatus || unread === 'Unread' || createdFrom || createdTo || updatedFrom || updatedTo ? <EmptyState title="No tickets match" text="Clear the search or choose another status." /> : <EmptyState title="All caught up" text="New customer enquiries will appear here." />
      }
    />
  );
}
