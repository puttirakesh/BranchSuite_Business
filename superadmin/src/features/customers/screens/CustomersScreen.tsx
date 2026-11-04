import React, { useState } from 'react';
import { ListScreen, EmptyState, PageHeader, SearchBox } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useCustomers, usePlans } from '../../../shared/hooks/queries';
import { CustomerCard } from '../components/CustomerCard';

/** APK `platform-customers`. Search runs on the server in API mode. */
export function CustomersScreen() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const customers = useCustomers({ search: q, limit: 100 });
  const plans = usePlans();
  return (
    <ListScreen
      header={
        <>
          <PageHeader title="Customer businesses" subtitle="Independent workspaces, licence states and capacity." />
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search business, industry or owner" />
        </>
      }
      data={customers.data?.items}
      isPending={customers.isPending}
      error={customers.error}
      refetch={customers.refetch}
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
