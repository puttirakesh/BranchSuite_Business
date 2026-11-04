import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Chips, EmptyState, Grid, ListScreen, Note, PageHeader, SearchBox, StatCard, TextField, useToast } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useBillingSummary, useInvoices } from '../../../shared/hooks/queries';
import { isValidIsoDate } from '../../../core/domain/dates';
import { exportCsv } from '../../../shared/utils/csv';
import { money } from '../../../shared/utils/format';
import { InvoiceRow } from '../components/InvoiceRow';

const STATUS = ['All', 'Paid', 'Unpaid', 'Issued', 'Overdue'] as const;

/** APK `platform-billing` plus status and issue-date filters required by the brief. */
export function BillingScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS)[number]>('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useDebounce(search);
  const range = { from: isValidIsoDate(from) ? from : undefined, to: isValidIsoDate(to) ? to : undefined };
  const invoices = useInvoices({ search: q, limit: 100, ...range });
  const summary = useBillingSummary();
  const toast = useToast();
  const rows = useMemo(() => invoices.data?.items.filter((i) => status === 'All' || i.status === status), [invoices.data, status]);
  const filtered = !!q || status !== 'All' || !!range.from || !!range.to;

  const download = async () => {
    if (!rows?.length) return toast('There are no invoices to export.');
    await exportCsv(
      'BranchSuite_Subscription_Invoices.csv',
      ['Invoice', 'Customer', 'Plan', 'Cycle', 'Status', 'Amount', 'Currency', 'Issued', 'Due', 'Paid'],
      rows.map((i) => [i.number, i.customerName ?? i.customerId, i.planName, i.cycle, i.status, i.amount, i.currency, i.issuedOn, i.dueOn, i.paidOn]),
    );
    toast('Exported ' + rows.length + ' invoices to CSV.');
  };

  return (
    <ListScreen
      header={
        <>
          <PageHeader
            title="Subscription billing"
            subtitle="Customer licence invoices and collections."
            action={<Button label="CSV" variant="secondary" small icon="download" onPress={download} />}
          />
          <Grid columns={{ base: 2 }} gap={14} style={{ marginBottom: 20 }}>
            <StatCard label="Paid invoices" value={summary.data ? money(summary.data.paid, summary.data.currency) : summary.isPending ? '…' : '—'} hint="All recorded payments" icon="wallet" tone="mint" />
            <StatCard label="Outstanding" value={summary.data ? money(summary.data.outstanding, summary.data.currency) : summary.isPending ? '…' : '—'} hint="Unpaid subscription documents" icon="quote" tone="amber" />
          </Grid>
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search invoice or customer" />
          <Chips label="Invoice status" options={STATUS} value={status} onChange={setStatus} />
          <Grid columns={{ base: 2, sidebar: 4 }} gap={12}>
            <TextField label="Issued from" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" maxLength={10} error={from && !isValidIsoDate(from) ? 'Use YYYY-MM-DD' : undefined} />
            <TextField label="Issued to" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" maxLength={10} error={to && !isValidIsoDate(to) ? 'Use YYYY-MM-DD' : undefined} />
          </Grid>
          <View style={{ height: 4 }} />
        </>
      }
      data={rows}
      isPending={invoices.isPending}
      error={invoices.error}
      refetch={() => Promise.all([invoices.refetch(), summary.refetch()])}
      keyOf={(i) => i.id}
      columns={{ base: 1, sidebar: 2 }}
      renderItem={(i) => <InvoiceRow invoice={i} />}
      empty={
        filtered ? <EmptyState title="No invoices match these filters" text="Clear the search or widen the date range." /> : <EmptyState title="No subscription invoices yet" text="Invoices appear when a business starts a paid subscription." />
      }
      footer={<View style={{ marginTop: 16 }}><Note>Invoice records come from the billing service. This screen does not collect payments.</Note></View>}
    />
  );
}
