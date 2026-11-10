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
import { env } from '../../../core/config/env';
import { canComposeInternalNote } from '../../../core/permissions/queryAccess';
import { useAuth } from '../../../core/auth/AuthContext';
import { SupportOperationsPanel } from '../components/SupportOperationsPanel';
import { replySchema, type ReplyForm } from '../schemas/reply.schema';
import { allowedTicketStatuses, canSubmitTicketMessage } from '../ticket-controls';
import { AUTHOR_ROLE_LABELS, TICKET_PRIORITIES, type Ticket } from '../types';

/** APK `platform-ticket/<id>`: conversation, reply composer, visibility and status. */
export function TicketDetailsScreen({ id }: { id: string }) {
  const ticket = useTicket(id);
  if (ticket.isPending) return <Screen><Skeleton height={60} style={{ marginBottom: 20 }} /><Skeleton height={200} style={{ marginBottom: 16 }} /><Skeleton height={260} /></Screen>;
  if (ticket.error || !ticket.data)
    return <Screen><PageHeader title="Support ticket" back="/support" /><ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} /></Screen>;
  return <TicketBody ticket={ticket.data} refetch={ticket.refetch} />;
}

function TicketBody({ ticket, refetch }: { ticket: Ticket; refetch: () => Promise<unknown> }) {
  const { user } = useAuth();
  // Internal notes are stored with INTERNAL visibility and only ever returned to platform staff.
  const canNote = canComposeInternalNote(env.dataMode, user?.role);
  const canStatus = usePermission('support.changeStatus');
  const controls = useUpdateTicketControls(ticket.id);
  const reply = useReplyTicket(ticket.id);
  const toast = useToast();
  const formError = useFormError();
  const defaults: ReplyForm = { message: '', visibility: 'Customer reply', status: ticket.status, priority: ticket.priority };
  const form = useForm<ReplyForm>({ resolver: zodResolver(replySchema), defaultValues: defaults });
  const visibility = useWatch({ control: form.control, name: 'visibility' });
  const status = useWatch({ control: form.control, name: 'status' });
  const priority = useWatch({ control: form.control, name: 'priority' });
  const busy = React.useRef(false);
  const canSend = canSubmitTicketMessage(ticket.status, visibility === 'Internal note', canNote);

  useEffect(() => {
    form.reset({ ...form.getValues(), status: ticket.status, priority: ticket.priority });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.status, ticket.priority]);

  const submit = form.handleSubmit(async (values) => {
    if (busy.current || !canSend) return;
    busy.current = true;
    formError.clear();
    try {
      await reply.mutateAsync({
        message: values.message,
        internal: values.visibility === 'Internal note',
      });
      // Refetching the conversation can finish before mutation invalidation does.
      // Preserve any next draft/visibility choice made while that save was pending.
      if (form.getValues('message') === values.message) form.resetField('message', { defaultValue: '' });
      toast(savedMessage(values.visibility === 'Internal note' ? 'Internal note saved' : 'Reply sent'));
    } catch (error) {
      formError.set(error);
    } finally { busy.current = false; }
  });

  return (
    <Screen onRefresh={refetch}>
      <PageHeader title={ticket.subject} subtitle={[ticket.id, ticket.category, ticket.status, ticket.priority + ' priority'].join(' · ')} back="/support" />
      {ticket.customerName || ticket.company || ticket.requester ? (
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.by}>Business context</Text>
          <Text style={styles.text}>
            {[
              ticket.customerName ? 'Business: ' + ticket.customerName : null,
              ticket.company ? 'Company: ' + ticket.company : null,
              ticket.branch ? 'Branch: ' + ticket.branch : null,
              ticket.requester ? 'Requested by: ' + ticket.requester : null,
            ].filter(Boolean).join('\n')}
          </Text>
        </Card>
      ) : null}
      <SupportOperationsPanel key={ticket.id} ticket={ticket} />
      <Card style={{ marginBottom: 16 }}>
        {ticket.messages.length ? (
          ticket.messages.map((m) => (
            <View key={m.id} style={[styles.message, m.internal ? styles.internal : null]}>
              <View style={styles.between}>
                <Text style={styles.by}>{m.authorRole ? m.by + ' · ' + AUTHOR_ROLE_LABELS[m.authorRole] : m.by}</Text>
                <Text style={styles.time}>{m.internal ? 'Internal note · ' + m.time : m.time}</Text>
              </View>
              <Text style={styles.text}>{m.text}</Text>
            </View>
          ))
        ) : (
          <EmptyState title="No messages yet" text="The first reply will start the conversation." />
        )}
      </Card>
      {ticket.history?.length ? (
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.by}>Ticket history</Text>
          {ticket.history.map((h) => (
            <View key={h.id} style={{ marginTop: 10 }}>
              <Text style={styles.text}>{h.summary}</Text>
              <Text style={styles.time}>{h.actorName + ' · ' + AUTHOR_ROLE_LABELS[h.actorRole] + ' · ' + h.time}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <FormText control={form.control} name="message" label={canNote ? 'Reply / internal note' : 'Your reply'} required multiline />
        <Grid columns={{ base: 1, medium: canNote ? 2 : 1 }} gap={14}>
          {canNote ? <FormSelect control={form.control} name="visibility" label="Message visibility" options={['Customer reply', 'Internal note']} /> : null}
          {canStatus ? <FormSelect control={form.control} name="status" label="Ticket status" options={allowedTicketStatuses(ticket.status)} /> : null}
          {canStatus ? <FormSelect control={form.control} name="priority" label="Priority" options={TICKET_PRIORITIES} /> : null}
        </Grid>
        {canStatus ? <Button label="Save status" variant="secondary" full loading={controls.isPending} disabled={status === ticket.status || reply.isPending} onPress={async () => {
          formError.clear();
          try {
            await controls.mutateAsync({ status: form.getValues('status'), expectedStatus: ticket.status });
            toast(savedMessage('Ticket status saved'));
          } catch (error) { formError.set(error); void refetch(); }
        }} /> : null}
        {canStatus ? <Button label="Save priority" variant="secondary" full loading={controls.isPending} disabled={priority === ticket.priority || reply.isPending} onPress={async () => {
          formError.clear();
          try {
            await controls.mutateAsync({ priority: form.getValues('priority'), expectedPriority: ticket.priority });
            toast(savedMessage('Ticket priority saved'));
          } catch (error) { formError.set(error); void refetch(); }
        }} /> : null}
        {ticket.status === 'Closed' ? <Note tone="warning">Reopen this ticket before sending another reply.</Note> : null}
        <Note>{visibility === 'Internal note' ? 'Internal notes are visible to the platform team only.' : 'Replies are visible to the customer in their support inbox.'}</Note>
        <FormError message={formError.message} />
        <Button label={visibility === 'Internal note' ? 'Save note' : 'Send reply'} full onPress={submit} loading={reply.isPending} disabled={!canSend || controls.isPending} />
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
