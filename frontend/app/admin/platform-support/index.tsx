import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { useAdminScope } from '../../../src/core/admin/scope';
import { supportTicketsApi, type SupportTicketDto } from '../../../src/core/admin/workspace-records.api';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

export default function PlatformSupportPage() {
  const { styles } = useAdminLayout(baseStyles, 'page');
  const scope = useAdminScope();
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useToastState('', 'error');
  const [attempt, setAttempt] = useState(0);
  const [replyFor, setReplyFor] = useState('');
  const [reply, setReply] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!scope?.companyId) return () => { active = false; };
    setLoading(true); setError('');
    setTickets([]);
    supportTicketsApi.list(scope.companyId).then(items => { if (active) setTickets(items.filter(item => !scope.branchId || item.branchId === scope.branchId)); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load support requests.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, scope?.companyId, scope?.branchId]));

  const sendReply = async (ticket: SupportTicketDto) => {
    if (!reply.trim() || saving) return;
    setSaving(true); setError('');
    try { const updated = await supportTicketsApi.reply(ticket.id, reply.trim()); setTickets(current => current.map(item => item.id === ticket.id ? updated : item)); setReply(''); setReplyFor(''); toast.success('Support reply sent.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send reply.'); }
    finally { setSaving(false); }
  };
  const setStatus = async (ticket: SupportTicketDto, status: SupportTicketDto['status']) => {
    if (saving || ticket.status === status) return;
    setSaving(true); setError('');
    try { const updated = await supportTicketsApi.setStatus(ticket.id, status); toast.success('Support request status updated.'); setTickets(current => current.map(item => item.id === ticket.id ? updated : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update ticket status.'); }
    finally { setSaving(false); }
  };

  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <AdminPageHeading title="Support requests" />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading support requests" /> : tickets.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>No support requests</Text><Text style={styles.subtitle}>Employee requests will appear here when submitted.</Text></View> : tickets.map(ticket => <View key={ticket.id} style={styles.card}>
        <View style={styles.ticketHeading}><View style={styles.flex}><Text style={styles.cardTitle}>{ticket.subject}</Text><Text style={styles.subtitle}>{ticket.category} · {ticket.priority} · {new Date(ticket.createdAt).toLocaleDateString('en-IN')}</Text></View><Text style={styles.status}>{ticket.status.replace('_', ' ')}</Text></View>
        {ticket.messages.map(message => <View key={message.id} style={styles.message}><Text style={styles.messageMeta}>{message.authorId === ticket.createdById ? 'Employee' : 'Support'} · {new Date(message.createdAt).toLocaleString('en-IN')}</Text><Text style={styles.messageText}>{message.message}</Text></View>)}
        <View style={styles.actions}>{(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map(status => <Pressable key={status} disabled={saving} onPress={() => void setStatus(ticket, status)} style={[styles.statusButton, ticket.status === status && styles.selected]}><Text style={styles.statusButtonText}>{status.replace('_', ' ').toLowerCase()}</Text></Pressable>)}</View>
        {ticket.status !== 'CLOSED' && <>{replyFor === ticket.id ? <><TextInput validation={{ required: true, maxLength: 10000 }} accessibilityLabel={`Reply to ${ticket.subject}`} value={reply} onChangeText={setReply} editable={!saving} multiline style={styles.input} /><View style={styles.actions}><Pressable disabled={saving} onPress={() => void sendReply(ticket)} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Sending…' : 'Send reply'}</Text></Pressable><Pressable disabled={saving} onPress={() => { setReplyFor(''); setReply(''); }} style={styles.secondary}><Text style={styles.link}>Cancel</Text></Pressable></View></> : <Pressable accessibilityRole="button" onPress={() => setReplyFor(ticket.id)} style={styles.secondary}><Text style={styles.link}>Reply</Text></Pressable>}</>}
      </View>)}
    </ScrollView><AdminBottomNavigation disabled={saving} />
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 16 },
  card: { padding: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16, gap: formSpacing.field }, cardTitle: { fontSize: 17, fontWeight: '700', color: '#20334f' }, subtitle: { fontSize: 12, lineHeight: 19, color: '#607591', marginTop: 4 }, flex: { flex: 1, minWidth: 0 },
  ticketHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, status: { color: '#177f74', fontSize: 11, fontWeight: '700' }, message: { padding: 12, borderRadius: 10, backgroundColor: '#f6f8fd', gap: 5 }, messageMeta: { fontSize: 10, color: '#607591' }, messageText: { fontSize: 13, lineHeight: 20, color: '#20334f' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, statusButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#f2f5fc' }, selected: { backgroundColor: '#dcefe8' }, statusButtonText: { fontSize: 10, fontWeight: '600', color: '#405573' }, input: { minHeight: 90, borderWidth: 1, borderColor: '#ccd6e5', borderRadius: 10, padding: 12, textAlignVertical: 'top' },
  primary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#345cf2' }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }, link: { color: '#345cf2', fontWeight: '600' }, error: { color: '#b3261e', fontSize: 13, lineHeight: 20 },
});
