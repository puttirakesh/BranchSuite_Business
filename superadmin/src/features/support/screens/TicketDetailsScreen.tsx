import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { colors, radius } from '../../../theme/tokens';
import { Button, Card, EmptyState, ErrorState, FormError, FormSelect, FormText, Grid, Note, PageHeader, Screen, Skeleton, useToast } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { useReplyTicket, useTicket, useUpdateTicketControls } from '../../../shared/hooks/queries';
import { usePermission } from '../../../core/permissions/usePermission';
import { savedMessage } from '../../../core/data/source';
import { replySchema, type ReplyForm } from '../schemas/reply.schema';
import { TICKET_PRIORITIES, TICKET_STATUSES, type Ticket } from '../types';

/** APK `platform-ticket/<id>`: conversation, reply composer, visibility and status. */
export function TicketDetailsScreen({ id }: { id: string }) {
  const ticket = useTicket(id);
  if (ticket.isPending) return <Screen><Skeleton height={60} style={{ marginBottom: 20 }} /><Skeleton height={200} style={{ marginBottom: 16 }} /><Skeleton height={260} /></Screen>;
  if (ticket.error || !ticket.data)
    return <Screen><PageHeader title="Support ticket" back="/support" /><ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} /></Screen>;
  return <TicketBody ticket={ticket.data} refetch={ticket.refetch} />;
}

function TicketBody({ ticket, refetch }: { ticket: Ticket; refetch: () => Promise<unknown> }) {
  const canNote = usePermission('support.internalNote');
  const canStatus = usePermission('support.changeStatus');
  const controls = useUpdateTicketControls(ticket.id);
  const reply = useReplyTicket(ticket.id);
  const toast = useToast();
  const formError = useFormError();
  const defaults: ReplyForm = { message: '', visibility: 'Customer reply', status: ticket.status, priority: ticket.priority };
  const form = useForm<ReplyForm>({ resolver: zodResolver(replySchema), defaultValues: defaults });
  const visibility = useWatch({ control: form.control, name: 'visibility' });

  useEffect(() => {
    form.reset({ ...form.getValues(), status: ticket.status, priority: ticket.priority });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.status, ticket.priority]);

  const submit = form.handleSubmit(async (values) => {
    formError.clear();
    try {
      await reply.mutateAsync({
        message: values.message,
        internal: values.visibility === 'Internal note',
      });
      form.reset({ ...values, message: '' });
      toast(savedMessage(values.visibility === 'Internal note' ? 'Internal note saved' : 'Reply sent'));
    } catch (error) {
      formError.set(error);
    }
  });

  return (
    <Screen onRefresh={refetch}>
      <PageHeader title={ticket.subject} subtitle={[ticket.id, ticket.category, ticket.status, ticket.priority + ' priority'].join(' · ')} back="/support" />
      <Card style={{ marginBottom: 16 }}>
        {ticket.messages.length ? (
          ticket.messages.map((m) => (
            <View key={m.id} style={[styles.message, m.internal ? styles.internal : null]}>
              <View style={styles.between}>
                <Text style={styles.by}>{m.by}</Text>
                <Text style={styles.time}>{m.internal ? 'Internal note' : m.time}</Text>
              </View>
              <Text style={styles.text}>{m.text}</Text>
            </View>
          ))
        ) : (
          <EmptyState title="No messages yet" text="The first reply will start the conversation." />
        )}
      </Card>
      <Card>
        <FormText control={form.control} name="message" label={canNote ? 'Reply / internal note' : 'Your reply'} required multiline />
        <Grid columns={{ base: 1, medium: canNote ? 2 : 1 }} gap={14}>
          {canNote ? <FormSelect control={form.control} name="visibility" label="Message visibility" options={['Customer reply', 'Internal note']} /> : null}
          {canStatus ? <FormSelect control={form.control} name="status" label="Ticket status" options={TICKET_STATUSES} /> : null}
          {canStatus ? <FormSelect control={form.control} name="priority" label="Priority" options={TICKET_PRIORITIES} /> : null}
        </Grid>
        {canStatus ? <Button label="Save status and priority" variant="secondary" full loading={controls.isPending} onPress={async () => {
          formError.clear();
          const values = form.getValues();
          try {
            await controls.mutateAsync({ status: values.status !== ticket.status ? values.status : undefined, priority: values.priority !== ticket.priority ? values.priority : undefined });
            toast(savedMessage('Ticket status and priority saved'));
          } catch (error) { formError.set(error); }
        }} /> : null}
        {ticket.status === 'Closed' ? <Note tone="warning">Reopen this ticket before sending another reply.</Note> : null}
        <Note>{visibility === 'Internal note' ? 'Internal notes are visible to the platform team only.' : 'Replies are visible to the customer in their support inbox.'}</Note>
        <FormError message={formError.message} />
        <Button label={visibility === 'Internal note' ? 'Save note' : 'Send reply'} full onPress={submit} loading={reply.isPending} disabled={ticket.status === 'Closed'} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { backgroundColor: colors.primarySoft, borderRadius: 14, padding: 18, marginBottom: 12 },
  internal: { backgroundColor: '#FFF0DA', borderWidth: 1, borderColor: '#EEDCC2' },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  by: { fontSize: 12, fontWeight: '700', color: colors.ink },
  time: { fontSize: 10, color: colors.subtle },
  text: { fontSize: 13, lineHeight: 20, color: colors.ink, marginTop: 10 },
  radius: { borderRadius: radius.md },
});
