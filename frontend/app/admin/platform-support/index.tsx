import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { WorkspaceSectionBranch } from '../../../src/ui/SectionBranchSelect';
import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { FloatingTextInput as TextInput } from '../../../src/ui/FloatingTextInput';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { useAdminScope } from '../../../src/core/admin/scope';
import { useAuth } from '../../../src/core/auth/AuthProvider';
import { companyRoles } from '../../../src/core/admin/role-capabilities';
import { isBusinessAdminRole } from '../../../src/core/admin/access';
import { getAvailableBranches, useAvailableBranches } from '../../../src/core/admin/available-branches';
import { supportTicketInput, SUPPORT_CATEGORIES } from '../../../src/core/admin/support-workflow';
import { canMoveSupportTicket, supportAuthorLabel, supportTicketsApi, type SupportTicketDto } from '../../../src/core/admin/workspace-records.api';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { SelectField } from '../../../src/ui/SelectField';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { SupportTracking } from '../../../src/features/support/SupportTracking';
import { SupportHistory } from '../../../src/features/support/SupportHistory';

export default function PlatformSupportPage() {
  const { styles } = useAdminLayout(baseStyles, 'page');
  const scope = useAdminScope();
  const { session } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ ticketId?: string }>();
  const targetId = typeof params.ticketId === 'string' ? params.ticketId : '';
  const companyId = scope?.companyId;
  const canManage = companyRoles(session, companyId).some(isBusinessAdminRole);
  const { branches, loading: branchesLoading, error: branchError, refresh: refreshBranches } = useAvailableBranches(companyId);
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useToastState('', 'error');
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState('');
  const [reply, setReply] = useState('');
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState('OTHER');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [branchId, setBranchId] = useState('');
  const busy = useRef(false);
  const currentCompany = useRef(companyId);
  currentCompany.current = companyId;
  useEffect(() => { setCreating(false); setSubject(''); setDescription(''); setBranchId(''); setReply(''); setExpanded(targetId); }, [companyId, targetId]);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!companyId) { setLoading(false); return () => { active = false; }; }
    setLoading(true); setTickets([]); setError('');
    const list = canManage ? supportTicketsApi.list(companyId, scope?.branchId || undefined) : supportTicketsApi.mine();
    // Notifications concern the requester. Load the target through the creator-only route
    // so another selected company/branch cannot hide it or grant company-wide access.
    Promise.all([list, targetId ? supportTicketsApi.mine(targetId) : Promise.resolve([])])
      .then(([items, target]) => { if (active) { setTickets([...target, ...items.filter(item => !target.some(t => t.id === item.id))]); if (targetId) setExpanded(targetId); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load support requests.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, companyId, scope?.branchId, canManage, targetId]));

  const createTicket = async () => {
    if (busy.current || !canManage || !companyId) return;
    busy.current = true; setSaving(true); setError('');
    const selectedCompany = companyId;
    try {
      // Validate required fields before any fetch, then recheck branch access immediately before submission.
      supportTicketInput(companyId, branchId, category, subject, description, branches.map(b => b.id));
      const available = branchId ? await getAvailableBranches(companyId) : [];
      const input = supportTicketInput(companyId, branchId, category, subject, description, available.map(b => b.id));
      const saved = await supportTicketsApi.create(input);
      if (currentCompany.current !== selectedCompany) return;
      setTickets(items => [saved, ...items.filter(item => item.id !== saved.id)]); setExpanded(saved.id);
      setCreating(false); setSubject(''); setDescription(''); setBranchId(''); setCategory('OTHER');
      router.setParams({ ticketId: saved.id });
      toast.success('Support request created.');
    } catch (cause) { if (currentCompany.current === selectedCompany) setError(cause instanceof Error ? cause.message : 'Could not create the support request.'); }
    finally { busy.current = false; setSaving(false); }
  };
  const update = async (ticket: SupportTicketDto, status?: SupportTicketDto['status']) => {
    if (busy.current || (status ? !canManage : !reply.trim())) return;
    busy.current = true; setSaving(true); setError('');
    const selectedCompany = companyId;
    try {
      const updated = status ? await supportTicketsApi.setStatus(ticket.id, status, ticket.status) : await supportTicketsApi.reply(ticket.id, reply.trim(), ticket.companyId);
      if (currentCompany.current !== selectedCompany) return;
      setTickets(items => items.map(item => item.id === ticket.id ? updated : item)); setReply('');
      toast.success(status ? 'Support request status updated.' : 'Support reply sent.');
    } catch (cause) { if (currentCompany.current === selectedCompany) setError(cause instanceof Error ? cause.message : 'Could not update the support request.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <AdminPageHeading title={canManage ? 'Platform support' : 'My support requests'} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} refreshDisabled={saving} branchControl={canManage ? <WorkspaceSectionBranch /> : undefined} />
      <Text style={styles.subtitle}>{canManage ? 'Raise an issue or manage requests for your company.' : 'Only requests you created are shown here.'}</Text>
      {canManage && <Pressable accessibilityRole="button" disabled={saving || !companyId} onPress={() => setCreating(value => !value)} style={styles.primary}><Text style={styles.primaryText}>{creating ? 'Cancel new request' : 'Raise issue'}</Text></Pressable>}
      {creating && canManage && <View style={styles.card}>
        <Text style={styles.cardTitle}>Create support ticket</Text>
        <SelectField label="Category" value={category} options={SUPPORT_CATEGORIES.map(value => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} onChange={setCategory} disabled={saving} />
        <SelectField label="Branch (optional)" value={branchId} options={[{ value: '', label: 'Company-wide request' }, ...branches.map(b => ({ value: b.id, label: b.name }))]} onChange={setBranchId} disabled={saving || branchesLoading} />
        {!!branchError && <Pressable disabled={saving} onPress={refreshBranches}><Text style={styles.error}>Could not load branches. Tap to retry, or submit a company-wide request.</Text></Pressable>}
        <TextInput accessibilityLabel="Support request subject" value={subject} onChangeText={setSubject} editable={!saving} maxLength={180} validation={{ required: true, minLength: 4, maxLength: 180 }} style={styles.input} />
        <TextInput accessibilityLabel="Describe support request" value={description} onChangeText={setDescription} editable={!saving} multiline maxLength={10000} validation={{ required: true, minLength: 10, maxLength: 10000 }} style={styles.input} />
        <Text style={styles.subtitle}>Subject: 4–180 characters. Description: 10–10,000 characters.</Text>
        <Pressable accessibilityRole="button" disabled={saving || !companyId} onPress={() => void createTicket()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Submitting…' : 'Create ticket'}</Text></Pressable>
      </View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!targetId && <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.setParams({ ticketId: '' })} style={styles.secondary}><Text style={styles.link}>Show support list without notification focus</Text></Pressable>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading support requests" /> : tickets.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>No support requests</Text><Text style={styles.subtitle}>{canManage ? 'Raise an issue to start a conversation with BranchSuite Support.' : 'Your requests will appear here.'}</Text></View> : tickets.map(ticket => <View key={ticket.id} style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={'Open ticket ' + ticket.subject} accessibilityState={{ expanded: expanded === ticket.id }} disabled={saving} onPress={() => { setExpanded(expanded === ticket.id ? '' : ticket.id); setReply(''); }}>
          <View style={styles.ticketHeading}><Text style={[styles.cardTitle, styles.flex]}>{ticket.subject}</Text><Text style={styles.status}>{ticket.status.replace('_', ' ')}</Text></View>
          <Text selectable style={styles.subtitle}>{ticket.id}</Text>
          <Text style={styles.subtitle}>{[ticket.company?.name, ticket.requester?.name, ticket.branch?.name || 'Company-wide', ticket.category, ticket.priority, new Date(ticket.createdAt).toLocaleString('en-IN')].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.link}>{expanded === ticket.id ? 'Close conversation' : 'Read conversation'}</Text>
        </Pressable>
        {expanded === ticket.id && <>
          {ticket.messages.map(message => <View key={message.id} style={styles.message}><Text style={styles.messageMeta}>{supportAuthorLabel(message, session?.user.id)} · {new Date(message.createdAt).toLocaleString('en-IN')}</Text><Text selectable style={styles.messageText}>{message.message}</Text></View>)}
          <SupportTracking ticket={ticket} />
          <SupportHistory history={ticket.history} />
          {canManage && ticket.companyId === companyId && <View style={styles.actions}>{(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).filter(status => canMoveSupportTicket(ticket.status, status)).map(status => <Pressable accessibilityRole="button" key={status} disabled={saving || ticket.status === status} onPress={() => void update(ticket, status)} style={[styles.statusButton, ticket.status === status && styles.selected]}><Text style={styles.statusButtonText}>{status.replace('_', ' ').toLowerCase()}</Text></Pressable>)}</View>}
          {ticket.status !== 'CLOSED' ? <><TextInput validation={{ required: true, maxLength: 10000 }} accessibilityLabel={'Reply to ' + ticket.subject} value={reply} onChangeText={setReply} editable={!saving} multiline maxLength={10000} style={styles.input} /><Pressable accessibilityRole="button" disabled={saving || !reply.trim()} onPress={() => void update(ticket)} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Sending…' : 'Send reply'}</Text></Pressable></> : <Text style={styles.subtitle}>This ticket is closed. A company administrator or BranchSuite Support can reopen it.</Text>}
        </>}
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
