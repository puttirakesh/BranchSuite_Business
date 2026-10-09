import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { leadsKey, newLeadId, normalizeLeadStage, readLeads, type Lead, type LeadForm as Form } from '../../../src/core/leads';
type Picker = 'source' | 'owner' | 'branch' | 'stage';
const options: Record<Picker, string[]> = {
  source: ['Website', 'Referral', 'Social media', 'Walk-in', 'Other'],
  owner: ['Admin', 'Unassigned'],
  branch: ['Vijayawada'],
  stage: ['New', 'Contacted', 'Qualified', 'Proposal', 'Active', 'Inactive'],
};
const draftKey = 'branchsuite:teamlead:draft:v1';
const formatDate = (date: Date) => {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
const today = () => formatDate(new Date());
const emptyForm = (): Form => ({
  organisation: '', contactPerson: '', email: '', phone: '', source: 'Website', owner: 'Admin',
  branch: 'Vijayawada', stage: 'New', estimatedValue: '', followUpDate: today(), notes: '',
});
function validDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number(year) >= 1900 && date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
}

// Offline sample workspace matching the supplied reference. Leads are stored on this device.
export default function NewLeadPage() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [form, setForm] = useState<Form>(emptyForm);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [picker, setPicker] = useState<Picker | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState(false);
  const [draftStatus, setDraftStatus] = useState('Loading draft…');
  const savingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const scroll = useRef<ScrollView>(null);
  const cardY = useRef(0);
  const positions = useRef<Partial<Record<keyof Form, number>>>({});

  useEffect(() => {
    let active = true;
    setLoadError(''); setReady(false);
    (edit ? readLeads().then(leads => {
      const lead = leads.find(item => item.id === edit);
      if (!lead) throw new Error('Lead could not be found.');
      return JSON.stringify({ ...lead, estimatedValue: String(lead.estimatedValue) });
    }) : AsyncStorage.getItem(draftKey)).then(stored => {
      if (!active) return;
      if (stored) {
        const draft: unknown = JSON.parse(stored);
        const defaults = emptyForm();
        if (!draft || typeof draft !== 'object' || !Object.keys(defaults).every(key => typeof (draft as Record<string, unknown>)[key] === 'string')) {
          throw new Error('The saved draft could not be read.');
        }
        const restored = Object.fromEntries(Object.keys(defaults).map(key => [key, (draft as Record<string, string>)[key]])) as Form;
        if (!options.owner.includes(restored.owner)) restored.owner = defaults.owner;
        restored.stage = normalizeLeadStage(restored.stage);
        setForm(restored);
      }
      setReady(true);
      setDraftStatus(edit ? '' : stored ? 'Your saved draft was restored.' : 'Your draft is saved automatically on this device.');
    }).catch(() => {
      if (active) { setLoadError(edit ? 'Could not load this lead. Please retry.' : 'Could not load your draft. Please retry.'); setDraftStatus(edit ? '' : 'Draft saving is paused.'); }
    });
    return () => { active = false; };
  }, [attempt, edit]);

  useEffect(() => {
    if (!ready || saving || created || edit) return;
    setDraftStatus('Saving draft…');
    timer.current = setTimeout(() => {
      writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(draftKey, JSON.stringify(form)));
      writes.current.then(() => setDraftStatus('Your draft is saved automatically on this device.'))
        .catch(() => setDraftStatus('Could not save your draft. Your changes are still in the form.'));
    }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [form, ready, saving, created, edit]);

  const update = (key: keyof Form, value: string) => {
    if (key === 'phone') value = value.replace(/\D/g, '').slice(0, 10);
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setNotice('');
  };
  const openCalendar = () => {
    Keyboard.dismiss();
    const selected = validDate(form.followUpDate) ? form.followUpDate.trim().split('/').map(Number) : null;
    const date = selected ? new Date(selected[2], selected[1] - 1, selected[0]) : new Date();
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setCalendarOpen(true);
  };
  const chooseDate = (date: Date) => {
    update('followUpDate', formatDate(date));
    setCalendarOpen(false);
  };
  const monthLabel = calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = calendarMonth.getDay();
  const calendarWeeks = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const day = week * 7 + weekday - firstWeekday + 1;
      return day > 0 && day <= daysInMonth ? day : null;
    }));
  const back = async (destination?: '/admin/dashboard' | '/admin/employees') => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    try {
      await writes.current.catch(() => {});
      if (ready && !created && !edit) await AsyncStorage.setItem(draftKey, JSON.stringify(form));
      if (destination) router.push(destination);
      else if (router.canGoBack()) router.back();
      else router.replace('/admin/dashboard');
    } catch { setNotice('Could not save your draft. Please try again before leaving.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const createLead = async () => {
    if (!ready || savingRef.current) return;
    Keyboard.dismiss();
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.organisation.trim()) next.organisation = 'Enter an organisation.';
    if (!form.contactPerson.trim()) next.contactPerson = 'Enter a contact person.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!/^\d{10}$/.test(form.phone)) next.phone = 'Enter a 10-digit phone number.';
    if (!/^\d+(\.\d{1,2})?$/.test(form.estimatedValue.trim()) || !Number.isFinite(Number(form.estimatedValue))) next.estimatedValue = 'Enter a value of zero or more, with up to two decimal places.';
    if (!validDate(form.followUpDate)) next.followUpDate = 'Enter a valid date as DD/MM/YYYY.';
    for (const key of Object.keys(options) as Picker[]) if (!options[key].includes(form[key])) next[key] = 'Select an available option.';
    setErrors(next);
    if (Object.keys(next).length) {
      setNotice('Please complete the highlighted fields.');
      const first = Object.keys(next)[0] as keyof Form;
      scroll.current?.scrollTo({ y: Math.max(0, cardY.current + (positions.current[first] || 0) - 12), animated: true });
      return;
    }
    savingRef.current = true; setSaving(true); setNotice('');
    if (timer.current) clearTimeout(timer.current);
    try {
      await writes.current.catch(() => {});
      const leads = await readLeads();
      const existing = edit ? leads.find(item => item.id === edit) : undefined;
      if (edit && !existing) throw new Error('Lead could not be found.');
      const lead: Lead = {
        ...existing, ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as Form,
        estimatedValue: Number(form.estimatedValue), id: existing?.id || newLeadId(),
        createdAt: existing?.createdAt || new Date().toISOString(),
        history: existing ? [...(existing.history || []), { id: newLeadId(), kind: 'edit', note: 'Lead details updated.', createdAt: new Date().toISOString() }] : [],
      };
      await AsyncStorage.setItem(leadsKey, JSON.stringify(existing ? leads.map(item => item.id === lead.id ? lead : item) : [lead, ...leads]));
      setCreated(true);
      try { if (!edit) await AsyncStorage.removeItem(draftKey); setDraftStatus(''); }
      catch { setDraftStatus('Lead saved, but the old draft could not be cleared.'); }
      router.replace({ pathname: '/admin/teamlead/[id]', params: { id: lead.id } });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create the lead. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const field = (key: keyof Form, label: string, hint?: string, multiline = false) => (
    <View style={styles.field} onLayout={event => { positions.current[key] = event.nativeEvent.layout.y; }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} editable={ready && !saving} value={form[key]} onChangeText={value => update(key, value)}
        maxLength={key === 'phone' ? 10 : undefined}
        keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : key === 'estimatedValue' ? 'decimal-pad' : 'default'}
        autoCapitalize={key === 'email' ? 'none' : 'sentences'} autoCorrect={false} multiline={multiline}
        style={[styles.input, multiline && styles.multiline, errors[key] && styles.invalid]} />
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {errors[key] && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors[key]}</Text>}
    </View>
  );
  const select = (key: Picker, label: string) => (
    <View style={styles.field} onLayout={event => { positions.current[key] = event.nativeEvent.layout.y; }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${form[key]}`} disabled={!ready || saving} onPress={() => setPicker(key)} style={[styles.input, styles.row, errors[key] && styles.invalid]}>
        <Text style={styles.inputText}>{form[key]}</Text><Text style={styles.chevron}>{'\u2304'}</Text>
      </Pressable>
      {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.row}><View style={styles.flex}><Text style={styles.company}>5 Gen Educon</Text><Text style={styles.caption}>Business workspace</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>NI</Text></View></View>
            <View style={styles.filters}><View style={styles.filter}><Text style={styles.caption}>Company</Text><Text style={styles.filterText}>5 Gen Educon</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Select branch" disabled={!ready || saving || created} onPress={() => setPicker('branch')} style={[styles.filter, styles.branchFilter]}><Text style={styles.caption}>Branch</Text><Text style={styles.filterText}>{form.branch}</Text><Text style={styles.caption}>{'\u2304'}</Text></Pressable></View>
          </View>
          <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={saving} onPress={() => void back()} style={styles.back}><Text style={styles.backGlyph}>{'\u2039'}</Text></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>5 GEN WORKSPACE</Text><Text style={styles.title}>{edit ? 'Edit lead' : 'New lead'}</Text><Text style={styles.subtitle}>{edit ? 'Update your lead details.' : 'A few details. A new opportunity.'}</Text></View></View>
            {loadError !== '' && <View style={styles.card}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View>}
            {created ? <View style={styles.card}><Text accessibilityLiveRegion="polite" style={styles.title}>Lead created</Text><Text style={styles.subtitle}>{form.organisation} has been saved on this device.</Text><Pressable accessibilityRole="button" style={[styles.primary, styles.retry]} onPress={() => { setForm(emptyForm()); setCreated(false); setErrors({}); setNotice(''); }}><Text style={styles.primaryText}>Create another lead</Text></Pressable></View> : <>
              <View style={styles.card} onLayout={event => { cardY.current = event.nativeEvent.layout.y; }}>
                {field('organisation', 'Organisation *')}
                {field('contactPerson', 'Contact person *')}
                {field('email', 'Email *')}
                {field('phone', 'Phone *')}
                {select('source', 'Source')}
                {select('owner', 'Owner')}
                {select('branch', 'Branch')}
                {select('stage', 'Stage')}
                {field('estimatedValue', 'Estimated value (₹) *', 'Before tax.')}
                <View style={styles.field} onLayout={event => { positions.current.followUpDate = event.nativeEvent.layout.y; }}>
                  <Text style={styles.label}>Follow-up date *</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Follow-up date: ${form.followUpDate}. Open calendar`} disabled={!ready || saving} onPress={openCalendar} style={[styles.input, styles.row, errors.followUpDate && styles.invalid]}>
                    <Text style={styles.inputText}>{form.followUpDate || 'Select a date'}</Text>
                    <View accessible={false} style={styles.calendarIcon}>
                      <View style={[styles.calendarBinding, { left: 3 }]} />
                      <View style={[styles.calendarBinding, { right: 3 }]} />
                      <View style={styles.calendarDivider} />
                      <View style={styles.calendarDots}>{[0, 1, 2, 3].map(dot => <View key={dot} style={styles.calendarDot} />)}</View>
                    </View>
                  </Pressable>
                  {errors.followUpDate && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors.followUpDate}</Text>}
                </View>
                {field('notes', 'Notes', undefined, true)}
              </View>
              {notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
              <View style={styles.actions}><Pressable accessibilityRole="button" disabled={saving} onPress={() => void back()} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ busy: saving, disabled: !ready || saving }} disabled={!ready || saving} onPress={() => void createLead()} style={[styles.primary, (!ready || saving) && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : edit ? 'Save changes' : 'Create lead'}</Text></Pressable></View>
            </>}
            <Text accessibilityLiveRegion="polite" style={styles.draft}>{draftStatus}</Text>
            <Text style={styles.footer}>Offline sample workspace · v2.3</Text>
          </ScrollView>
          <View style={styles.navigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="Home" disabled={saving} onPress={() => void back('/admin/dashboard')} style={styles.navItem}><Text style={styles.navGlyph}>{'\u2302'}</Text><Text style={styles.navLabel}>Home</Text></Pressable>
            <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.navItem, styles.activeTab]}><Text style={[styles.navGlyph, styles.link]}>{'\u2197'}</Text><Text style={[styles.navLabel, styles.link]}>CRM</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="People" disabled={saving} onPress={() => void back('/admin/employees')} style={styles.navItem}><Text style={styles.navGlyph}>{'\u2659'}</Text><Text style={styles.navLabel}>People</Text></Pressable>
            <View style={styles.navItem}><Text style={styles.navGlyph}>{'\u25a4'}</Text><Text style={styles.navLabel}>Payroll</Text></View>
            <View style={styles.navItem}><Text style={styles.navGlyph}>···</Text><Text style={styles.navLabel}>More</Text></View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.row}><Text style={styles.modalTitle}>{picker ? { source: 'Source', owner: 'Owner', branch: 'Branch', stage: 'Stage' }[picker] : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={() => setPicker(null)} style={styles.back}><Text style={styles.backGlyph}>×</Text></Pressable></View>
          <ScrollView>{picker && options[picker].map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: form[picker] === value }} key={value} onPress={() => { update(picker, value); setPicker(null); }} style={styles.option}><Text style={styles.inputText}>{value}</Text><Text style={styles.link}>{form[picker] === value ? '✓' : ''}</Text></Pressable>)}</ScrollView>
        </View></View>
      </Modal>
      <Modal transparent visible={calendarOpen} animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.row}>
            <Text style={styles.modalTitle}>Follow-up date</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={() => setCalendarOpen(false)} style={styles.back}><Text style={styles.backGlyph}>{'\u00d7'}</Text></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.monthHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={calendarMonth.getFullYear() <= 1900 && calendarMonth.getMonth() === 0} onPress={() => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={styles.back}><Text style={styles.backGlyph}>{'\u2039'}</Text></Pressable>
              <Text accessibilityLiveRegion="polite" style={styles.monthTitle}>{monthLabel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={calendarMonth.getFullYear() >= 9999 && calendarMonth.getMonth() === 11} onPress={() => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={styles.back}><Text style={styles.backGlyph}>{'\u203a'}</Text></Pressable>
            </View>
            <View style={styles.calendarRow}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
            {calendarWeeks.map((week, index) => <View key={index} style={styles.calendarRow}>
              {week.map((day, weekday) => {
                if (day === null) return <View key={weekday} style={styles.calendarDay} />;
                const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const selected = formatDate(date) === form.followUpDate.trim();
                const isToday = formatDate(date) === today();
                return <Pressable key={weekday} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} accessibilityState={{ selected }} onPress={() => chooseDate(date)} style={[styles.calendarDay, isToday && styles.todayDay, selected && styles.selectedDay]}>
                  <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text>
                </Pressable>;
              })}
            </View>)}
            <Pressable accessibilityRole="button" accessibilityLabel="Select today" onPress={() => chooseDate(new Date())} style={styles.todayButton}><Text style={styles.link}>Today</Text></Pressable>
          </ScrollView>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, flex: { flex: 1 }, page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' },
  company: { fontSize: 14, fontWeight: '800', color: '#20334f' }, caption: { fontSize: 9, color: '#788aa5', marginTop: 4 },
  avatar: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff', borderWidth: 1, borderColor: '#dce5ff' }, avatarText: { fontSize: 13, fontWeight: '700', color: '#345cf2' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 14 }, filter: { flex: 1, minHeight: 34, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff', flexDirection: 'row', alignItems: 'center', gap: 5 }, filterText: { fontSize: 9, fontWeight: '600', color: '#20334f', flexShrink: 1 }, branchFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingBottom: 30 }, heading: { flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'flex-start' },
  back: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, backGlyph: { fontSize: 26, color: '#304560' },
  eyebrow: { fontSize: 8, letterSpacing: 1.5, fontWeight: '700', color: '#71829c', marginBottom: 8 }, title: { fontSize: 25, fontWeight: '800', color: '#20334f', letterSpacing: -0.7 }, subtitle: { fontSize: 12, color: '#71829c', marginTop: 6, lineHeight: 19 },
  card: { marginTop: 22, padding: 19, paddingBottom: 16, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' },
  field: { marginBottom: 20 }, label: { fontSize: 12, fontWeight: '600', color: '#405573', marginBottom: 8 },
  input: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 13, backgroundColor: '#fcfdff', fontSize: 14, color: '#20334f' }, inputText: { fontSize: 14, color: '#20334f', flexShrink: 1 }, chevron: { fontSize: 18, color: '#405573' }, multiline: { minHeight: 72, textAlignVertical: 'top' }, invalid: { borderColor: '#c64e60' },
  hint: { marginTop: 6, fontSize: 10, color: '#71829c', lineHeight: 16 }, error: { color: '#b94d61', fontSize: 11, marginTop: 6 }, notice: { color: '#b94d61', fontSize: 12, marginTop: 12 },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8, padding: 7, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e4eaf5' }, cancel: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#f1f4fa', justifyContent: 'center', alignItems: 'center' }, cancelText: { fontSize: 12, fontWeight: '700', color: '#405573' }, primary: { flex: 1.4, minHeight: 46, borderRadius: 13, backgroundColor: '#345cf2', justifyContent: 'center', alignItems: 'center' }, primaryText: { fontSize: 12, fontWeight: '700', color: '#fff' }, dim: { opacity: 0.55 },
  draft: { textAlign: 'center', fontSize: 10, color: '#71829c', marginTop: 10 }, footer: { textAlign: 'center', fontSize: 9, color: '#8192ad', marginTop: 38 },
  navigation: { flexDirection: 'row', padding: 8, gap: 6, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, minHeight: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 4 }, navGlyph: { fontSize: 22, color: '#657995' }, navLabel: { fontSize: 9, color: '#657995' }, activeTab: { backgroundColor: '#edf1ff' }, link: { color: '#345cf2', fontWeight: '600' },
  overlay: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '80%', alignSelf: 'center', padding: 20, borderRadius: 20, backgroundColor: '#fff' }, modalTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#20334f' }, option: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#edf1f8' }, retry: { marginTop: 16, padding: 12, minHeight: 44 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginVertical: 18 }, monthTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#20334f' },
  calendarIcon: { width: 19, height: 18, borderWidth: 1.5, borderColor: '#405573', borderRadius: 3, marginTop: 2 }, calendarBinding: { position: 'absolute', top: -4, width: 2, height: 6, borderRadius: 1, backgroundColor: '#405573' }, calendarDivider: { height: 1.5, backgroundColor: '#405573', marginTop: 4 }, calendarDots: { flexDirection: 'row', flexWrap: 'wrap', width: 9, gap: 3, alignSelf: 'center', marginTop: 3 }, calendarDot: { width: 3, height: 3, borderRadius: 0.5, backgroundColor: '#405573' },
  calendarRow: { flexDirection: 'row', gap: 3, marginBottom: 4 }, weekday: { flex: 1, textAlign: 'center', fontSize: 10, color: '#71829c', paddingVertical: 8 }, calendarDay: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, dayText: { fontSize: 14, color: '#20334f' }, todayDay: { borderColor: '#345cf2' }, selectedDay: { backgroundColor: '#345cf2' }, selectedDayText: { color: '#fff', fontWeight: '700' }, todayButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 10, backgroundColor: '#edf1ff' },
});
