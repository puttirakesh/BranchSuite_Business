import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Shift = { id: string; date: string; checkIn: string; checkOut: string; branch?: string; shiftStart?: string; shiftEnd?: string };
type RequestKind = 'correction' | 'leave';
const attendanceKey = 'branchsuite:my-attendance:v1';
const requestsKey = 'branchsuite:my-attendance-requests:v1';

function dateValue(value: string): string | null {
  const match = /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[4]), Number(match[3]) - 1, Number(match[1]));
  if (date.getFullYear() !== Number(match[4]) || date.getMonth() !== Number(match[3]) - 1 || date.getDate() !== Number(match[1])) return null;
  return `${match[4]}-${match[3]}-${match[1]}`;
}

export default function MyAttendancePage() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const shiftsPosition = useRef(0);
  const savingRef = useRef(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [request, setRequest] = useState<RequestKind | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [notice, setNotice] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    AsyncStorage.getItem(attendanceKey).then(stored => {
      const records: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(records) || !records.every(shift => shift && ['id', 'date', 'checkIn', 'checkOut'].every(field => typeof shift[field] === 'string'))) throw new Error('Saved attendance could not be read.');
      if (active) setShifts([...records].sort((first, second) => second.date.localeCompare(first.date)));
    }).catch(() => { if (active) setError('Could not load attendance. Please retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));

  const currentDate = new Date();
  const todayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const today = shifts.find(shift => shift.date === todayKey);
  const openRequest = (kind: RequestKind) => { setRequest(kind); setStartDate(''); setEndDate(''); setReason(''); setRequestError(''); setNotice(''); };
  const closeRequest = () => { if (!savingRef.current) setRequest(null); };
  const saveRequest = async () => {
    if (!request || savingRef.current) return;
    const start = dateValue(startDate), end = request === 'leave' ? dateValue(endDate) : start;
    if (!start || !end) { setRequestError('Enter valid dates as DD/MM/YYYY or DD-MM-YYYY.'); return; }
    if (end < start) { setRequestError('End date must be on or after the start date.'); return; }
    if (!reason.trim()) { setRequestError('Enter a reason for your request.'); return; }
    if (request === 'correction' && !shifts.some(shift => shift.date === start)) { setRequestError('Choose a date with a recorded shift.'); return; }
    savingRef.current = true; setSaving(true); setRequestError('');
    try {
      const stored = await AsyncStorage.getItem(requestsKey);
      const records: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(records)) throw new Error('Saved requests could not be read.');
      await AsyncStorage.setItem(requestsKey, JSON.stringify([{
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        type: request, startDate: start, endDate: end, reason: reason.trim(), status: 'pending', createdAt: new Date().toISOString(),
      }, ...records]));
      setNotice(request === 'leave' ? 'Leave request saved on this device.' : 'Correction request saved on this device.');
      setRequest(null);
    } catch { setRequestError('Could not save your request. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.between}><View style={styles.flex}><Text style={styles.companyName}>{/* Company name */}</Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.search}><Text style={styles.searchGlyph}>⌕</Text></View><View style={styles.avatar}>{/* Profile initial */}</View></View>
          <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerFilterLabel}>Company</Text><Text style={styles.chevron}>⌄</Text></View><View style={[styles.headerFilter, styles.branchFilter]}><Text style={styles.headerFilterLabel}>Personal branch</Text><Text numberOfLines={1} style={styles.headerBranch}>{today?.branch}</Text><Text style={styles.chevron}>⌄</Text></View></View>
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>My attendance</Text><Text style={styles.subtitle}>Your shifts and correction requests.</Text>
          {notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
          {loading ? <ActivityIndicator accessibilityLabel="Loading attendance" color="#345cf2" style={styles.loading} /> : error ? <View style={styles.card}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View> : <>
            <View style={styles.todayCard}>
              <View style={styles.between}><View style={styles.todayHeading}><View style={styles.clockIcon}><Text style={styles.clockGlyph}>◷</Text></View><Text style={styles.cardTitle}>Today’s attendance</Text></View><View style={styles.statusBadge}><Text style={styles.statusText}>{today?.checkOut ? 'Shift complete' : today?.checkIn ? 'Checked in' : 'Not recorded'}</Text></View></View>
              <Text style={styles.shiftDescription}>{today ? [today.branch, today.shiftStart && today.shiftEnd ? `${today.shiftStart}–${today.shiftEnd} shift` : ''].filter(Boolean).join(' · ') : 'No attendance recorded today.'}</Text>
              <View style={styles.times}><View style={styles.flex}><Text style={styles.timeLabel}>Check in</Text><Text style={styles.timeValue}>{today?.checkIn || '—'}</Text></View><View style={styles.timeLine} /><View style={styles.flex}><Text style={styles.timeLabel}>Check out</Text><Text style={styles.timeValue}>{today?.checkOut || '—'}</Text></View></View>
              <Pressable accessibilityRole="button" onPress={() => scrollRef.current?.scrollTo({ y: shiftsPosition.current, animated: true })} style={styles.viewButton}><Text style={styles.viewText}>View attendance</Text></Pressable>
            </View>
            <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => openRequest('correction')} style={styles.correctionButton}><Text style={styles.viewText}>Request correction</Text></Pressable><Pressable accessibilityRole="button" onPress={() => openRequest('leave')} style={styles.leaveButton}><Text style={styles.link}>Apply leave</Text></Pressable></View>
            <View onLayout={event => { shiftsPosition.current = event.nativeEvent.layout.y; }}><Text style={styles.sectionTitle}>Recorded shifts</Text>
              {shifts.length === 0 ? <View style={[styles.card, styles.empty]}><View style={styles.emptyIcon}><Text style={styles.clockGlyph}>◷</Text></View><Text style={styles.emptyTitle}>No recorded shifts yet</Text><Text style={styles.subtitle}>Your attendance records will appear here.</Text></View> : shifts.map(shift => <View style={styles.shiftCard} key={shift.id}><View style={styles.between}><Text style={styles.shiftDate}>{shift.date}</Text><View style={styles.presentBadge}><Text style={styles.presentText}>{shift.checkIn ? 'Present' : 'Not recorded'}</Text></View></View><Text style={styles.shiftTimes}>In {shift.checkIn || '—'} · Out {shift.checkOut || '—'}</Text>{shift.branch && <Text style={styles.subtitle}>{shift.branch}</Text>}</View>)}
            </View>
          </>}
        </ScrollView>
        <View style={styles.navigation}>{([{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }] as const).map(tab => <Pressable key={tab.label} accessibilityRole="tab" accessibilityState={{ selected: tab.label === 'More' }} onPress={tab.label === 'Home' ? () => router.replace('/admin/dashboard') : tab.label === 'People' ? () => router.push('/admin/employees') : undefined} style={styles.navItem}><View style={[styles.navIcon, tab.label === 'More' && styles.selectedNav]}><Text style={[styles.navGlyph, tab.label === 'More' && styles.link]}>{tab.icon}</Text></View><Text style={[styles.navLabel, tab.label === 'More' && styles.selectedText]}>{tab.label}</Text></Pressable>)}</View>
      </View>
      <Modal transparent visible={request !== null} animationType="fade" onRequestClose={closeRequest}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.modal}>
          <View style={styles.between}><Text style={styles.modalTitle}>{request === 'leave' ? 'Apply leave' : 'Request correction'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close request" disabled={saving} onPress={closeRequest} style={styles.close}><Text style={styles.chevron}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{request === 'leave' ? 'Start date *' : 'Shift date *'}</Text><TextInput accessibilityLabel={request === 'leave' ? 'Start date' : 'Shift date'} value={startDate} onChangeText={setStartDate} editable={!saving} placeholder="DD/MM/YYYY" placeholderTextColor="#98a4b7" style={styles.input} />
            {request === 'leave' && <><Text style={styles.label}>End date *</Text><TextInput accessibilityLabel="End date" value={endDate} onChangeText={setEndDate} editable={!saving} placeholder="DD/MM/YYYY" placeholderTextColor="#98a4b7" style={styles.input} /></>}
            <Text style={styles.label}>{request === 'leave' ? 'Reason *' : 'Requested correction / reason *'}</Text><TextInput accessibilityLabel="Request reason" value={reason} onChangeText={setReason} editable={!saving} multiline style={[styles.input, styles.multiline]} />
            <Text style={styles.subtitle}>Requests are saved on this device. Approval is not connected yet.</Text>
            {requestError !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{requestError}</Text>}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={saveRequest} style={[styles.submitButton, saving && styles.dim]}><Text style={styles.submitText}>{saving ? 'Saving…' : 'Save request'}</Text></Pressable>
        </View></KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, flex: { flex: 1 }, page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, companyName: { minHeight: 18, fontSize: 14, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, color: '#8794aa', marginTop: 4 }, search: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fc' }, searchGlyph: { fontSize: 26, color: '#304560' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' },
  headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff' }, branchFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, headerFilterLabel: { fontSize: 9, color: '#8492a9' }, headerBranch: { flex: 1, fontSize: 9, color: '#405573', paddingHorizontal: 6 }, chevron: { fontSize: 22, color: '#8798b1' },
  content: { padding: 16, paddingTop: 24, paddingBottom: 30 }, title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.7, color: '#20334f' }, subtitle: { fontSize: 11, lineHeight: 18, color: '#7a8ba5', marginTop: 6 }, loading: { marginTop: 30 }, notice: { padding: 14, marginTop: 16, borderRadius: 12, backgroundColor: '#e6f4ee', color: '#34856c', fontSize: 12 }, error: { fontSize: 12, color: '#b94d61', marginTop: 10 }, retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { fontSize: 12, fontWeight: '600', color: '#345cf2' },
  todayCard: { padding: 18, marginTop: 22, backgroundColor: '#f4fbf8', borderWidth: 1, borderColor: '#ddeee7', borderRadius: 20 }, todayHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }, clockIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#e1f5ee', alignItems: 'center', justifyContent: 'center' }, clockGlyph: { fontSize: 22, color: '#348c77' }, cardTitle: { fontSize: 15, fontWeight: '800', color: '#20334f', flexShrink: 1 }, statusBadge: { paddingVertical: 5, paddingHorizontal: 7, borderRadius: 7, backgroundColor: '#eee7fa' }, statusText: { fontSize: 8, color: '#8a70ae', fontWeight: '600' }, shiftDescription: { fontSize: 11, lineHeight: 18, color: '#7a8ba5', marginTop: 14 },
  times: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1ece7', padding: 15, borderRadius: 15, marginTop: 18 }, timeLabel: { fontSize: 9, color: '#7a8ba5' }, timeValue: { fontSize: 25, fontWeight: '800', color: '#20334f', marginTop: 6 }, timeLine: { flex: 1, height: 1, backgroundColor: '#dce8e3' }, viewButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#dfe7f5', marginTop: 18 }, viewText: { fontSize: 12, fontWeight: '600', color: '#405573' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 }, correctionButton: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#dfe7f5', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, leaveButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, sectionTitle: { fontSize: 17, fontWeight: '800', color: '#20334f', marginTop: 26, marginBottom: 14 }, card: { padding: 20, borderRadius: 17, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', marginTop: 16 }, empty: { alignItems: 'center', marginTop: 0, paddingVertical: 26 }, emptyIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#eaf5f0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, emptyTitle: { fontSize: 14, fontWeight: '700', color: '#20334f' }, shiftCard: { padding: 16, marginBottom: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 17 }, shiftDate: { fontSize: 12, fontWeight: '700', color: '#20334f' }, presentBadge: { paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#e1f3eb', borderRadius: 7 }, presentText: { fontSize: 9, color: '#34856c', fontWeight: '600' }, shiftTimes: { fontSize: 13, color: '#405573', marginTop: 14 },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navIcon: { minWidth: 46, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, selectedNav: { backgroundColor: '#eaf0ff' }, navGlyph: { fontSize: 22, color: '#71829c' }, navLabel: { fontSize: 9, color: '#71829c' }, selectedText: { color: '#345cf2' },
  overlay: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', padding: 22, borderRadius: 20, backgroundColor: '#fff' }, modalTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#20334f' }, close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, label: { fontSize: 12, fontWeight: '600', color: '#405573', marginTop: 18, marginBottom: 8 }, input: { minHeight: 46, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fcfdff', fontSize: 14, color: '#20334f' }, multiline: { minHeight: 90, textAlignVertical: 'top' }, submitButton: { minHeight: 46, marginTop: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#345cf2' }, submitText: { fontSize: 12, fontWeight: '700', color: '#fff' }, dim: { opacity: 0.6 },
});
