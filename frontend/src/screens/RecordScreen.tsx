import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../store/session';
import { deleteRecord, getRecord } from '../services/business';
import { errorMessage } from '../services/api';
import { crmConfig } from '../utils/crm';
import type { EntityKind } from '../types';
import { RecordForm } from '../components/RecordForm';
import { RecordLink } from '../components/RecordLink';
import { Badge, Button, Card, ErrorNotice, Sheet, StateView, humanize, money, styles } from '../components/ui';

export default function RecordScreen({ kind, id, edit = false }: { kind: EntityKind; id?: string; edit?: boolean }) {
  const { scope, can } = useSession(); const client = useQueryClient(); const config = crmConfig[kind]; const [confirmDelete, setConfirmDelete] = useState(false);
  const query = useQuery({ queryKey: ['crm', scope, kind, 'record', id], queryFn: ({ signal }) => getRecord(scope!, kind, id!, signal), enabled: !!scope && !!id && can(`${kind}:read`) });
  const removal = useMutation({ mutationFn: () => deleteRecord(scope!, kind, id!), onSuccess: () => {
    client.removeQueries({ queryKey: ['crm', scope, kind, 'record', id] });
    void client.invalidateQueries({ queryKey: ['crm', scope] }); void client.invalidateQueries({ queryKey: ['dashboard', scope] }); router.replace(`/crm/${kind}`);
  } });
  if (!scope) return <StateView title="Choose a branch" />;
  if (!can(`${kind}:read`) || ((!id || edit) && !can(`${kind}:${id ? 'update' : 'create'}`))) return <StateView title="Access unavailable" message="Your membership does not permit this action." />;
  if (id && query.isPending) return <StateView loading title="Loading record…" />;
  if (id && query.isError) return <StateView title="Record unavailable" message={errorMessage(query.error)} action="Try again" onAction={() => { void query.refetch(); }} />;
  const record = query.data;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { maxWidth: 800 }]}>
    <Button title={`‹ Back to ${kind}`} variant="secondary" onPress={() => router.replace(`/crm/${kind}`)} />
    <View style={{ gap: 8 }}><Text style={styles.muted}>{config.title.toUpperCase()}</Text><Text style={styles.title}>{!id ? `New ${config.singular}` : edit ? `Edit ${record?.name}` : record?.name}</Text></View>
    {!id || edit ? <RecordForm key={id ?? 'new'} kind={kind} record={record} /> : record && <>
      <Card><Badge value={record.status} />{Object.entries(record).filter(([key, value]) => !['id', 'name', 'status', 'items', 'total', 'taxRate', 'amount', 'currency', 'contactId', 'customerId'].includes(key) && value != null && value !== '').map(([key, value]) => <View key={key} style={{ gap: 4 }}><Text style={styles.label}>{humanize(key.replace(/([A-Z])/g, ' $1'))}</Text><Text selectable style={styles.muted}>{key === 'createdAt' ? new Date(String(value)).toLocaleString() : String(value)}</Text></View>)}
        {kind === 'deals' && <Text style={styles.title}>{money(record.amount ?? 0, record.currency)}</Text>}
      </Card>
      {record.contactId && <RecordLink kind="contacts" id={record.contactId} />}
      {record.customerId && <RecordLink kind="customers" id={record.customerId} />}
      {kind === 'quotes' && <Card><Text style={styles.heading}>Quote details</Text>{record.items?.map((item, index) => <View key={index} style={{ gap: 4 }}><Text style={styles.label}>{item.description}</Text><Text style={styles.muted}>{item.quantity} × {money(item.unitPrice, record.currency)} = {money(item.quantity * item.unitPrice, record.currency)}</Text></View>)}<Text style={styles.muted}>Tax: {record.taxRate ?? 0}%</Text><Text style={styles.title}>Total: {money(record.total ?? 0, record.currency)}</Text></Card>}
      <View style={styles.wrap}>{can(`${kind}:update`) && <Button title={`Edit ${config.singular}`} onPress={() => router.push(`/crm/${kind}/${encodeURIComponent(record.id)}/edit`)} />}
        {can(`${kind}:delete`) && <Button title={`Delete ${config.singular}`} variant="danger" onPress={() => { removal.reset(); setConfirmDelete(true); }} />}</View>
      <Sheet visible={confirmDelete} title={`Delete ${config.singular}?`} onClose={() => { if (!removal.isPending) setConfirmDelete(false); }}>
        <Text style={styles.muted}>This permanently deletes “{record.name}”. This action cannot be undone.</Text>{removal.isError && <ErrorNotice message={errorMessage(removal.error)} />}
        <Button title="Delete permanently" variant="danger" busy={removal.isPending} onPress={() => { if (can(`${kind}:delete`)) removal.mutate(); }} />
        <Button title="Keep record" variant="secondary" disabled={removal.isPending} onPress={() => setConfirmDelete(false)} />
      </Sheet>
    </>}
  </ScrollView>;
}
