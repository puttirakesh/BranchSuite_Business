import { CompanyName, UserInitials } from '../../../src/core/admin/scope';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '../../../src/core/admin/storage';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';

const categories = ['Billing', 'Access', 'Product'] as const;
type Category = typeof categories[number];
type Ticket = { id: string; subject: string; category: Category; message: string; replies: string[] };
const storageKey = 'branchsuite:platform-support:v1';
const sample: Ticket[] = [{ id: 'BS-TK-101', subject: 'Help with annual subscription', category: 'Billing', message: 'I would like help switching our subscription to annual billing.', replies: [] }];

function isTicket(value: unknown): value is Ticket {
  if (!value || typeof value !== 'object') return false;
  const ticket = value as Ticket;
  return typeof ticket.id === 'string' && typeof ticket.subject === 'string' && categories.includes(ticket.category) && typeof ticket.message === 'string' && Array.isArray(ticket.replies) && ticket.replies.every(reply => typeof reply === 'string');
}

export default function PlatformSupportPage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const [tickets, setTickets] = useState<Ticket[]>(sample);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'new' | string | null>(null);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<Category>('Billing');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(raw => {
      const saved: unknown = raw ? JSON.parse(raw) : sample;
      if (!Array.isArray(saved) || !saved.every(isTicket)) throw new Error('Invalid support tickets');
      if (active) { setTickets(saved); setLoaded(true); }
    }).catch(() => { if (active) setError('Saved tickets could not be loaded. Reopen this page to try again.'); });
    return () => { active = false; };
  }, []);
  const selected = tickets.find(ticket => ticket.id === dialog);
  const visible = tickets.filter(ticket => `${ticket.subject} ${ticket.id} ${ticket.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { if (!saving) { setDialog(null); setReply(''); if (loaded) setError(''); } };
  const persist = async (next: Ticket[]) => {
    if (!loaded || saving) return;
    setSaving(true);
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); setTickets(next); setDialog(null); setSubject(''); setMessage(''); setReply(''); setError(''); }
    catch { setError('Your ticket could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  const create = () => {
    if (!subject.trim() || !message.trim()) { setError('Enter a subject and message.'); return; }
    const number = Math.max(101, ...tickets.map(ticket => Number(ticket.id.replace('BS-TK-', '')) || 0)) + 1;
    void persist([...tickets, { id: `BS-TK-${number}`, subject: subject.trim(), category, message: message.trim(), replies: [] }]);
  };
  const sendReply = () => {
    if (!selected || !reply.trim()) { setError('Enter a reply.'); return; }
    void persist(tickets.map(ticket => ticket.id === selected.id ? { ...ticket, replies: [...ticket.replies, reply.trim()] } : ticket));
  };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={!loaded || saving} onPress={action} style={[styles.primary, (!loaded || saving) && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : label}</Text></Pressable>;

  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}><View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}><CompanyName /> <Text style={styles.down}>{'\u2304'}</Text></Text><Text style={styles.headerCaption}>Business workspace</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Search support tickets" onPress={() => setSearchOpen(value => !value)} style={styles.searchButton}><View style={styles.searchIcon}><View style={styles.searchHandle} /></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open my profile" onPress={() => router.push('/admin/profile')} style={styles.avatar}><Text style={styles.avatarText}><UserInitials /></Text></Pressable></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}><CompanyName /></Text><Text style={styles.down}>{'\u2304'}</Text></View><View style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.headerCaption}>Branch</Text><Text style={styles.filterText}>Vijayawada</Text><Text style={styles.down}>{'\u2304'}</Text></View></View></View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}><View style={styles.flex}><Text style={styles.eyebrow}>BRANCHSUITE</Text><Text accessibilityRole="header" style={styles.title}>Platform support</Text><Text style={styles.subtitle}>Subscription, access and product help.</Text></View>{button('+ Ticket', () => { setError(''); setCategory('Billing'); setDialog('new'); })}</View>
      {(searchOpen || desktop) && <TextInput accessibilityLabel="Search support tickets" placeholder="Search tickets…" value={query} onChangeText={setQuery} style={styles.input} />}
      <View style={styles.info}><Text style={styles.infoIcon}>{'\u24d8'}</Text><Text style={styles.infoText}>Platform help is separate from your own customer support module. Replies are saved locally.</Text></View>
      {error && !dialog ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {visible.map(ticket => <Pressable key={ticket.id} accessibilityRole="button" accessibilityLabel={`Open ticket ${ticket.id}: ${ticket.subject}`} onPress={() => { setDialog(ticket.id); if (loaded) setError(''); }} style={({ pressed }) => [styles.ticket, pressed && styles.dim]}><View style={styles.flex}><Text style={styles.ticketTitle}>{ticket.subject}</Text><Text style={styles.subtitle}>{ticket.category}{' · '}{ticket.id}</Text></View><View style={styles.status}><Text style={styles.statusText}>Open</Text></View></Pressable>)}
      {!visible.length && <Text style={styles.subtitle}>{query.trim() ? 'No matching tickets.' : 'No tickets yet. Create a ticket to get started.'}</Text>}
      <Text style={styles.footer}>Offline sample workspace · 3 Oct 2026 · v2.3</Text>
    </ScrollView><AdminBottomNavigation />
  </View><Modal transparent visible={dialog !== null} animationType="fade" onRequestClose={close}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}><View style={styles.headerRow}><Text accessibilityRole="header" style={[styles.modalTitle, styles.flex]}>{dialog === 'new' ? 'New support ticket' : selected?.subject}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close support dialog" disabled={saving} onPress={close} style={styles.close}><Text style={styles.link}>Close</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
    {dialog === 'new' ? <><Text style={styles.label}>Subject</Text><TextInput accessibilityLabel="Ticket subject" value={subject} onChangeText={setSubject} editable={!saving} maxLength={160} style={styles.input} /><Text style={styles.label}>Category</Text><View style={styles.categories}>{categories.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} disabled={saving} onPress={() => setCategory(value)} style={[styles.category, category === value && styles.selectedFilter]}><Text style={styles.link}>{value}</Text></Pressable>)}</View><Text style={styles.label}>Message</Text><TextInput accessibilityLabel="Ticket message" value={message} onChangeText={setMessage} editable={!saving} multiline style={[styles.input, styles.message]} /><Text style={styles.subtitle}>This demo ticket is saved on your device.</Text>{button('Create ticket', create)}</> : selected ? <><Text style={styles.subtitle}>{selected.category} · {selected.id} · Open</Text><View style={styles.messageCard}><Text style={styles.dialogText}>{selected.message}</Text></View>{selected.replies.map((value, index) => <View key={index} style={styles.messageCard}><Text style={styles.label}>Your reply</Text><Text style={styles.dialogText}>{value}</Text></View>)}<Text style={styles.label}>Reply</Text><TextInput accessibilityLabel="Ticket reply" value={reply} onChangeText={setReply} editable={!saving} multiline style={[styles.input, styles.message]} /><Text style={styles.subtitle}>Replies are saved locally.</Text>{button('Save reply', sendReply)}</> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 },
  header: { padding: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#71829c' }, down: { fontSize: 13, color: '#607591', marginLeft: 'auto' }, avatar: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 12 }, headerFilter: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, padding: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, fontWeight: '600', color: '#20334f', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  searchButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f6f8fd', alignItems: 'center', justifyContent: 'center' }, searchIcon: { width: 13, height: 13, borderWidth: 1.3, borderColor: '#20334f', borderRadius: 7 }, searchHandle: { position: 'absolute', width: 7, height: 1.3, backgroundColor: '#20334f', right: -5, bottom: -3, transform: [{ rotate: '45deg' }] },
  content: { padding: 16, paddingTop: 22, paddingBottom: 30, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, eyebrow: { fontSize: 8, lineHeight: 12, letterSpacing: 1.5, fontWeight: '700', color: '#71829c' }, title: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: '#20334f', marginTop: 6 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#607591', marginTop: 5 }, primary: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center' }, primaryText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  info: { flexDirection: 'row', gap: 10, padding: 15, borderRadius: 14, backgroundColor: '#eaf0ff', marginTop: 7 }, infoIcon: { fontSize: 15, color: '#405e9c' }, infoText: { flex: 1, fontSize: 10, lineHeight: 17, color: '#405e9c' }, ticket: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, padding: 16, minHeight: 74, backgroundColor: '#fff' }, ticketTitle: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#20334f' }, status: { borderRadius: 6, backgroundColor: '#fff0d8', paddingHorizontal: 9, paddingVertical: 5 }, statusText: { fontSize: 9, lineHeight: 13, color: '#946113' }, footer: { fontSize: 9, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 20 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 500, maxHeight: '85%', padding: 20, borderRadius: 20, backgroundColor: '#fff' }, modalTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: '#20334f' }, close: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#345cf2' }, dialogContent: { paddingTop: 14, gap: 12 }, label: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#20334f' }, input: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10, backgroundColor: '#fff', fontSize: 14, color: '#20334f' }, message: { minHeight: 100, textAlignVertical: 'top' }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10 }, messageCard: { padding: 14, borderRadius: 12, backgroundColor: '#f6f8fd', gap: 6 }, dialogText: { fontSize: 14, lineHeight: 22, color: '#405573' }, error: { fontSize: 12, lineHeight: 19, color: '#b94d61' }, dim: { opacity: 0.65 },
});
