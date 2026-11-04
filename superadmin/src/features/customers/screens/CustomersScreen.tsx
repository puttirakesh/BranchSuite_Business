import { env } from '../../../core/config/env';
import { useAuth } from '../../../core/auth/AuthContext';
import { Screen, Note } from '../../../shared/components';
import React, { useEffect, useState } from 'react';
import { ListScreen, Chips, SelectField, EmptyState, PageHeader, SearchBox } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useCustomers, usePlans } from '../../../shared/hooks/queries';
import { CustomerCard } from '../components/CustomerCard';

/** APK `platform-customers`. Search runs on the server in API mode. */
export function CustomersScreen() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [accountStatus, setAccountStatus] = useState<'All' | 'ACTIVE' | 'INACTIVE'>('All');
  const [sort, setSort] = useState('name');
  const q = useDebounce(search);
  const customers = useCustomers({ search: q, status: accountStatus === 'All' ? undefined : accountStatus, page, limit: 20 });
  const plans = usePlans();
  useEffect(() => setPage(1), [q, accountStatus]);
  const { user } = useAuth();
  if (env.dataMode === 'api' && user?.role === 'PLATFORM_SUPPORT') return <Screen><PageHeader title="Customer businesses" /><Note>Customer directory access is currently limited to platform administrators. Open Support to help a customer through their ticket.</Note></Screen>;
  return (
    <ListScreen
      header={
        <>
          <PageHeader title="Customer businesses" subtitle="Independent workspaces, licence states and capacity." />
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search business, industry or owner" />
          <Chips label="Account status" options={['All', 'ACTIVE', 'INACTIVE'] as const} value={accountStatus} onChange={setAccountStatus} />
          <SelectField label="Sort this page" value={sort} onChange={setSort} options={[{ value: 'name', label: 'Business name' }, { value: 'created', label: 'Newest first' }]} />
        </>
      }
      data={customers.data?.items.slice().sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : (b.createdOn ?? '').localeCompare(a.createdOn ?? ''))}
      isPending={customers.isPending}
      error={customers.error}
      refetch={customers.refetch}
      pagination={customers.data}
      onPageChange={setPage}
      keyOf={(c) => c.id}
      columns={{ base: 1, medium: 2, sidebar: 3 }}
      gap={14}
      renderItem={(c) => <CustomerCard customer={c} plans={plans.data} />}
      empty={
        q ? (
          <EmptyState title="No customer matches this search" text="Try a business name, owner or industry." />
        ) : (
          <EmptyState title="No customer businesses yet" text="Businesses appear here once they start a trial or are onboarded." />
        )
      }
    />
  );
}
