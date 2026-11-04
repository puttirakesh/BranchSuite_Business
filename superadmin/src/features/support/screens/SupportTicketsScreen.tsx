import React, { useEffect, useState } from 'react';
import { Chips, EmptyState, ListScreen, PageHeader, SearchBox } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useTickets } from '../../../shared/hooks/queries';
import { TICKET_STATUSES, type TicketStatus } from '../types';
import { TicketRow } from '../components/TicketRow';

const FILTERS = ['All', ...TICKET_STATUSES] as const;

/** APK `platform-support`, plus a status filter. */
export function SupportTicketsScreen() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('All');
  const q = useDebounce(search);
  const tickets = useTickets({ search: q, status: status === 'All' ? undefined : (status as TicketStatus), page, limit: 20 });
  useEffect(() => setPage(1), [q, status]);
  return (
    <ListScreen
      header={
        <>
          <PageHeader title="Customer support" subtitle="Product, subscription and access enquiries." />
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search subject, status or business" />
          <Chips label="Ticket status" options={FILTERS} value={status} onChange={setStatus} />
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
        q || status !== 'All' ? <EmptyState title="No tickets match" text="Clear the search or choose another status." /> : <EmptyState title="All caught up" text="New customer enquiries will appear here." />
      }
    />
  );
}
