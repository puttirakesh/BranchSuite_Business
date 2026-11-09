import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chips, EmptyState, ErrorState, ListScreen, PageHeader, SearchBox, SelectField, Screen } from '../../../shared/components';
import { env } from '../../../core/config/env';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useSupportBusiness, useSupportBusinesses } from '../../../shared/hooks/support-queries';

export function SupportBusinessesScreen() {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [sort, setSort] = useState('LATEST'), [openOnly, setOpenOnly] = useState('All'), [selected, setSelected] = useState('');
  const q = useDebounce(search);
  const businesses = useSupportBusinesses({ search: q, page, sort, openOnly: openOnly === 'Open work' ? 'true' : undefined });
  const detail = useSupportBusiness(selected);
  useEffect(() => { setPage(1); setSelected(''); }, [q, sort, openOnly]);
  if (env.dataMode !== 'api') return <Screen><PageHeader title="Support businesses" subtitle="Connect the Support service to view the business directory." /></Screen>;
  return <ListScreen header={<>
    <PageHeader title="Support businesses" subtitle="Read-only businesses with Support tickets. No billing or account administration." />
    <SearchBox value={search} onChangeText={setSearch} placeholder="Search business or company" />
    <Chips label="Business ticket filter" options={['All', 'Open work']} value={openOnly} onChange={setOpenOnly} />
    <SelectField label="Sort businesses" value={sort} onChange={setSort} options={[{ value: 'LATEST', label: 'Latest ticket activity' }, { value: 'NAME', label: 'Business name' }, { value: 'OPEN', label: 'Open ticket count' }]} />
    {selected && <Card style={{ marginVertical: 12 }}>{detail.isPending ? <Text>Loading ticket context…</Text> : detail.error ? <ErrorState error={detail.error} onRetry={() => void detail.refetch()} /> : detail.data ? <View style={{ gap: 10 }}>
      <Text style={{ fontWeight: '700' }}>{detail.data.company.tenant.name} / {detail.data.company.name}</Text>
      <Text>Ticket branches: {detail.data.branches.map(b => b.name).join(', ') || 'Company-wide only'}</Text>
      <Text>Requesters (up to {detail.data.requesterLimit}): {detail.data.requesters.map(p => p.name).join(', ')}</Text>
      <Button label="Open business tickets" onPress={() => router.push(('/support?companyId=' + encodeURIComponent(selected)) as never)} />
      <Button label="Close business context" variant="secondary" onPress={() => setSelected('')} />
    </View> : null}</Card>}
  </>} data={businesses.data?.items} isPending={businesses.isPending} error={businesses.error} refetch={businesses.refetch} pagination={businesses.data} onPageChange={setPage}
    keyOf={b => b.id} renderItem={b => <Card><Text style={{ fontSize: 18, fontWeight: '700' }}>{b.businessName}</Text><Text>{b.companyName}</Text><Text>{b.ticketCount} tickets / {b.openTicketCount} open</Text><Text>Latest activity: {new Date(b.latestActivity).toLocaleString()}</Text><Button label={'View support context for ' + b.companyName} variant="secondary" onPress={() => setSelected(b.id)} /></Card>}
    empty={<EmptyState title="No ticket-associated businesses" text="Businesses appear here when they have Support tickets matching these filters." />} />;
}
