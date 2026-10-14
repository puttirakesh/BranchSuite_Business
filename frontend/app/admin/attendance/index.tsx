import { CompanyName } from '../../../src/core/admin/scope';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '../../../src/core/admin/storage';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminMenuIcon } from '../../../src/ui/AdminMenuIcon';
import { checkIn, checkOut } from '../../../src/core/admin/attendance';

type Shift = { id: string; date: string; checkIn: string; checkOut: string; branch?: string; shiftStart?: string; shiftEnd?: string };
type RequestKind = 'correction' | 'leave';
const attendanceKey = 'branchsuite:my-attendance:v1';
const requestsKey = 'branchsuite:my-attendance-requests:v1';
const displayShiftDate = (value: string) => value.split('-').reverse().join('/');
const timeLabel = (value: string) => { const [hour, minute] = value.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`; };
const shiftTime = (value?: string, fallback = '09:00') => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value?.trim() || '');
  if (!match) return fallback;
  let hour = Number(match[1]); const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return fallback;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const timeOptions = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String(index % 4 * 15).padStart(2, '0')}`);

function dateValue(value: string): string | null {
  const match = /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[4]), Number(match[3]) - 1, Number(match[1]));
  if (date.getFullYear() !== Number(match[4]) || date.getMonth() !== Number(match[3]) - 1 || date.getDate() !== Number(match[1])) return null;
  return `${match[4]}-${match[3]}-${match[1]}`;
}

export default function AttendancePage() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return view === 'leave' ? <MyLeavePage /> : <MyAttendancePage />;
}

function MyAttendancePage() {
  const { styles } = useAdminLayout(baseStyles, 'page');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mobileSheet = Platform.OS !== 'web' || width < 900;
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
  const [correctCheckIn, setCorrectCheckIn] = useState('09:00');
  const [correctCheckOut, setCorrectCheckOut] = useState('18:00');
  const [picker, setPicker] = useState<'date' | 'in' | 'out' | null>(null);
  const [punching, setPunching] = useState(false);
  const punch = async (kind: 'in' | 'out') => {
    if (savingRef.current) return;
    savingRef.current = true; setPunching(true); setNotice('');
    try {
      if (kind === 'in') await checkIn(); else await checkOut();
      setNotice(kind === 'in' ? 'Checked in.' : 'Checked out.');
      setAttempt(value => value + 1);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Could not record attendance. Please retry.'); }
    finally { savingRef.current = false; setPunching(false); }
  };

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
  const chooseShift = (value: string) => { const shift = shifts.find(item => item.date === value); setStartDate(displayShiftDate(value)); setCorrectCheckIn(shiftTime(shift?.checkIn)); setCorrectCheckOut(shiftTime(shift?.checkOut, '18:00')); setPicker(null); setRequestError(''); };
  const openRequest = (kind: RequestKind) => { setRequest(kind); setStartDate(kind === 'correction' && shifts[0] ? displayShiftDate(shifts[0].date) : ''); setCorrectCheckIn(shiftTime(shifts[0]?.checkIn)); setCorrectCheckOut(shiftTime(shifts[0]?.checkOut, '18:00')); setEndDate(''); setReason(''); setPicker(null); setRequestError(''); setNotice(''); };
  const closeRequest = () => { if (!savingRef.current) { setRequest(null); setPicker(null); } };
  const saveRequest = async () => {
    if (!request || savingRef.current) return;
    const start = dateValue(startDate), end = request === 'leave' ? dateValue(endDate) : start;
    if (!start || !end) { setRequestError('Enter valid dates as DD/MM/YYYY or DD-MM-YYYY.'); return; }
    if (end < start) { setRequestError('End date must be on or after the start date.'); return; }
    if (!reason.trim()) { setRequestError('Enter a reason for your request.'); return; }
    if (request === 'correction' && !shifts.some(shift => shift.date === start)) { setRequestError('Choose a date with a recorded shift.'); return; }
    if (request === 'correction' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(correctCheckIn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(correctCheckOut) || correctCheckOut <= correctCheckIn)) { setRequestError('Enter valid times, with check out after check in.'); return; }
    savingRef.current = true; setSaving(true); setRequestError('');
    try {
      const stored = await AsyncStorage.getItem(requestsKey);
      const records: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(records)) throw new Error('Saved requests could not be read.');
      await AsyncStorage.setItem(requestsKey, JSON.stringify([{
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        type: request, startDate: start, endDate: end, reason: reason.trim(), status: 'pending', createdAt: new Date().toISOString(),
        ...(request === 'correction' ? { correctCheckIn, correctCheckOut, shiftId: shifts.find(shift => shift.date === start)?.id, branch: shifts.find(shift => shift.date === start)?.branch } : {}),
      }, ...records]));
      setNotice(request === 'leave' ? 'Leave request submitted for approval.' : 'Correction request saved on this device (corrections are not supported by the server yet).');
      setRequest(null);
    } catch { setRequestError('Could not save your request. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={[styles.between, styles.headerIdentity]}><View style={styles.flex}><Text style={styles.companyName}>{/* Company name */}</Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.search}><Text style={styles.searchGlyph}>⌕</Text></View><View style={styles.avatar}>{/* Profile initial */}</View></View>
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
              {!today?.checkOut && <Pressable accessibilityRole="button" accessibilityState={{ disabled: punching, busy: punching }} disabled={punching} onPress={() => punch(today?.checkIn ? 'out' : 'in')} style={[styles.viewButton, { backgroundColor: '#345cf2', marginBottom: 8 }]}><Text style={[styles.viewText, { color: '#fff' }]}>{punching ? 'Saving…' : today?.checkIn ? 'Check out' : 'Check in'}</Text></Pressable>}
              <Pressable accessibilityRole="button" onPress={() => scrollRef.current?.scrollTo({ y: shiftsPosition.current, animated: true })} style={styles.viewButton}><Text style={styles.viewText}>View attendance</Text></Pressable>
            </View>
            <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => openRequest('correction')} style={styles.correctionButton}><Text style={styles.viewText}>Request correction</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/admin/attendance', params: { view: 'leave' } })} style={styles.leaveButton}><Text style={styles.link}>Apply leave</Text></Pressable></View>
            <View onLayout={event => { shiftsPosition.current = event.nativeEvent.layout.y; }}><Text style={styles.sectionTitle}>Recorded shifts</Text>
              {shifts.length === 0 ? <View style={[styles.card, styles.empty]}><View style={styles.emptyIcon}><Text style={styles.clockGlyph}>◷</Text></View><Text style={styles.emptyTitle}>No recorded shifts yet</Text><Text style={styles.subtitle}>Your attendance records will appear here.</Text></View> : shifts.map(shift => <View style={styles.shiftCard} key={shift.id}><View style={styles.between}><Text style={styles.shiftDate}>{shift.date}</Text><View style={styles.presentBadge}><Text style={styles.presentText}>{shift.checkIn ? 'Present' : 'Not recorded'}</Text></View></View><Text style={styles.shiftTimes}>In {shift.checkIn || '—'} · Out {shift.checkOut || '—'}</Text>{shift.branch && <Text style={styles.subtitle}>{shift.branch}</Text>}</View>)}
            </View>
          </>}
        </ScrollView>
        <AdminBottomNavigation />
      </View>
      <Modal transparent visible={request !== null} animationType="fade" onRequestClose={closeRequest}>
        <KeyboardAvoidingView style={[styles.overlay, request === 'correction' && mobileSheet && { justifyContent: 'flex-end', paddingHorizontal: 8, paddingBottom: Math.max(8, insets.bottom), paddingTop: Math.max(12, insets.top) }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View accessibilityViewIsModal style={[styles.modal, request === 'correction' && styles.correctionSheet, request === 'correction' && mobileSheet && { maxHeight: '92%' }]}>
          {request === 'correction' && <View style={styles.handle} />}
          <View style={styles.between}><Text style={styles.modalTitle}>{request === 'leave' ? 'Apply leave' : 'Attendance correction'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close request" disabled={saving} onPress={closeRequest} style={[styles.close, request === 'correction' && styles.sheetClose]}><AdminMenuIcon name="close" color="#20334f" /></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{request === 'leave' ? 'Start date *' : 'Shift date *'}</Text>
            {request === 'leave' ? <TextInput accessibilityLabel="Start date" value={startDate} onChangeText={setStartDate} editable={!saving} placeholder="DD/MM/YYYY" placeholderTextColor="#98a4b7" style={styles.input} /> : <>
              {Platform.OS === 'web' ? React.createElement('select', { 'aria-label': 'Shift date *', value: dateValue(startDate) || '', disabled: saving || shifts.length === 0, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => chooseShift(event.target.value), style: { width: '100%', minHeight: 48, padding: '11px 13px', borderRadius: 13, border: '1px solid #dce5f3', background: '#fcfdff', color: '#20334f', fontSize: 14 } }, shifts.length ? [...new Set(shifts.map(shift => shift.date))].map(date => React.createElement('option', { key: date, value: date }, displayShiftDate(date))) : React.createElement('option', { value: '' }, 'No recorded shifts')) : <Pressable accessibilityRole="button" accessibilityLabel="Shift date *" disabled={saving || shifts.length === 0} onPress={() => setPicker(picker === 'date' ? null : 'date')} style={[styles.input, styles.between]}><Text style={styles.inputText}>{startDate || 'No recorded shifts'}</Text><Text style={styles.chevron}>⌄</Text></Pressable>}
              {picker === 'date' && <ScrollView style={styles.pickerOptions} nestedScrollEnabled>{[...new Set(shifts.map(shift => shift.date))].map(date => <Pressable key={date} accessibilityRole="button" onPress={() => chooseShift(date)} style={styles.pickerOption}><Text style={styles.inputText}>{displayShiftDate(date)}</Text></Pressable>)}</ScrollView>}
              <View style={styles.timeFields}>{(['in', 'out'] as const).map(kind => <View key={kind} style={styles.flex}><Text style={styles.label}>{kind === 'in' ? 'Correct check in *' : 'Correct check out *'}</Text>{Platform.OS === 'web' ? React.createElement('input', { type: 'time', 'aria-label': kind === 'in' ? 'Correct check in *' : 'Correct check out *', value: kind === 'in' ? correctCheckIn : correctCheckOut, disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => kind === 'in' ? setCorrectCheckIn(event.target.value) : setCorrectCheckOut(event.target.value), style: { boxSizing: 'border-box', width: '100%', minHeight: 48, padding: '11px 10px', borderRadius: 13, border: '1px solid #dce5f3', background: '#fcfdff', color: '#20334f', fontSize: 14 } }) : <Pressable accessibilityRole="button" accessibilityLabel={kind === 'in' ? 'Correct check in *' : 'Correct check out *'} disabled={saving} onPress={() => setPicker(picker === kind ? null : kind)} style={[styles.input, styles.between]}><Text style={styles.inputText}>{timeLabel(kind === 'in' ? correctCheckIn : correctCheckOut)}</Text><Text style={styles.chevron}>⌄</Text></Pressable>}</View>)}</View>
              {(picker === 'in' || picker === 'out') && <ScrollView style={styles.pickerOptions} nestedScrollEnabled>{[...new Set([...timeOptions, correctCheckIn, correctCheckOut])].sort().map(time => <Pressable key={time} accessibilityRole="button" onPress={() => { if (picker === 'in') setCorrectCheckIn(time); else setCorrectCheckOut(time); setPicker(null); }} style={styles.pickerOption}><Text style={styles.inputText}>{timeLabel(time)}</Text></Pressable>)}</ScrollView>}
            </>}
            {request === 'leave' && <><Text style={styles.label}>End date *</Text><TextInput accessibilityLabel="End date" value={endDate} onChangeText={setEndDate} editable={!saving} placeholder="DD/MM/YYYY" placeholderTextColor="#98a4b7" style={styles.input} /></>}
            <Text style={styles.label}>Reason *</Text><TextInput accessibilityLabel="Request reason" value={reason} onChangeText={setReason} editable={!saving} multiline style={[styles.input, styles.multiline, request === 'correction' && styles.correctionReason]} />
            {request === 'leave' && <Text style={styles.subtitle}>Your request is sent for approval and appears in Approvals.</Text>}
            {request === 'correction' && shifts.length === 0 && <Text style={styles.subtitle}>A recorded shift is needed to request a correction.</Text>}
            {requestError !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{requestError}</Text>}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || (request === 'correction' && shifts.length === 0), busy: saving }} disabled={saving || (request === 'correction' && shifts.length === 0)} onPress={saveRequest} style={[styles.submitButton, (saving || (request === 'correction' && shifts.length === 0)) && styles.dim]}><Text style={styles.submitText}>{saving ? 'Saving…' : request === 'correction' ? 'Submit correction' : 'Save request'}</Text></Pressable>
        </View></KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

type LeaveRequest = {
  id: string; type: 'leave' | 'correction'; startDate: string; endDate: string; reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; createdAt: string;
  leaveType?: string; employeeName?: string; employeeId?: string; branch?: string;
};
const leaveTypes = ['Casual leave', 'Sick leave'] as const;
const leaveDays = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
const leaveDateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
async function readLeaveRequests(): Promise<LeaveRequest[]> {
  const stored = await AsyncStorage.getItem(requestsKey);
  const records: unknown = stored === null ? [] : JSON.parse(stored);
  if (!Array.isArray(records) || !records.every(record => record && ['id', 'startDate', 'endDate', 'reason', 'createdAt'].every(field => typeof record[field] === 'string') && ['leave', 'correction'].includes(record.type) && ['pending', 'approved', 'rejected', 'cancelled'].includes(record.status))) throw new Error('Saved requests could not be read.');
  return (records as LeaveRequest[]).map(record => !record.employeeId && record.employeeName === 'Neha Iyer' ? { ...record, employeeName: 'Admin' } : record);
}
const personalLeave = (records: LeaveRequest[]) => records.filter(record => record.type === 'leave' && !record.employeeId);
const availableLeave = (records: LeaveRequest[], type: string) => Math.max(0, 6 - personalLeave(records).filter(record => (record.leaveType || 'Casual leave') === type && ['pending', 'approved'].includes(record.status)).reduce((sum, record) => sum + Math.max(0, leaveDays(record.startDate, record.endDate) || 0), 0));

function MyLeavePage() {
  const { styles } = useAdminLayout(leaveStyles);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mobile = Platform.OS !== 'web' || width < 900;
  const [records, setRecords] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [applyOpen, setApplyOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<string>('Casual leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    readLeaveRequests().then(requests => { if (active) setRecords(requests); })
      .catch(cause => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load leave requests.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));
  const requests = personalLeave(records);
  const openApply = () => { const now = new Date(); const date = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`; setStartDate(date); setEndDate(date); setReason(''); setLeaveType('Casual leave'); setError(''); setNotice(''); setApplyOpen(true); };
  const submit = async () => {
    if (savingRef.current) return;
    const start = dateValue(startDate), end = dateValue(endDate);
    if (!start || !end || end < start) { setError('Choose valid dates with the end on or after the start.'); return; }
    if (!reason.trim()) { setError('Enter a reason for your leave.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      const current = await readLeaveRequests();
      const days = leaveDays(start, end);
      if (days > availableLeave(current, leaveType)) throw new Error('This request exceeds your available leave balance.');
      if (personalLeave(current).some(request => ['pending', 'approved'].includes(request.status) && start <= request.endDate && end >= request.startDate)) throw new Error('These dates overlap an existing pending or approved leave request.');
      const request: LeaveRequest = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, type: 'leave', startDate: start, endDate: end, reason: reason.trim(), leaveType, status: 'pending', createdAt: new Date().toISOString() };
      const updated = [request, ...current];
      await AsyncStorage.setItem(requestsKey, JSON.stringify(updated));
      setRecords(await readLeaveRequests()); setApplyOpen(false); setNotice('Leave request submitted for approval.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save leave request. Please retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const cancel = async (id: string) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const current = await readLeaveRequests();
      setRecords(current);
      const request = current.find(item => item.id === id);
      if (!request || request.status !== 'pending') throw new Error('Only pending requests can be cancelled.');
      const updated = current.map(item => item.id === id ? { ...item, status: 'cancelled' as const } : item);
      await AsyncStorage.setItem(requestsKey, JSON.stringify(updated));
      setRecords(updated); setNotice('Request cancelled. Your reserved days are available again.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not cancel request. Please retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const dateField = (label: string, value: string, update: (value: string) => void) => <View style={styles.flex}><Text style={styles.label}>{label} *</Text>{Platform.OS === 'web' ? React.createElement('input', { type: 'date', 'aria-label': label, value: dateValue(value) || '', disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(displayShiftDate(event.target.value)), style: { boxSizing: 'border-box', width: '100%', minHeight: 48, border: '1px solid #dce5f3', borderRadius: 13, padding: '11px 10px', color: '#20334f', background: '#fcfdff', fontSize: 14 } }) : <TextInput accessibilityLabel={label} editable={!saving} value={value} onChangeText={update} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" style={styles.input} />}</View>;

  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    <View style={styles.header}><View style={[styles.between, styles.headerIdentity]}><View style={styles.flex}><Text style={styles.companyName}><CompanyName /></Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.search}><AdminMenuIcon name="search" color="#20334f" /></View><View style={styles.leaveAvatar}><Text style={styles.leaveInitial}>A</Text></View></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerFilterLabel}>Company</Text><Text style={styles.headerBranch}><CompanyName /></Text></View><View style={[styles.headerFilter, styles.branchFilter]}><Text style={styles.headerFilterLabel}>Personal branch</Text><Text style={styles.headerBranch}>Vijayawada</Text></View></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.between}><View style={styles.flex}><Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>My leave</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Apply for leave" disabled={loading || !!loadError || saving} onPress={openApply} style={[styles.applyButton, (loading || !!loadError || saving) && styles.dim]}><Text style={styles.submitText}>+ Apply</Text></Pressable></View><Text style={styles.subtitle}>Take time off with a clear view of your balance.</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading leave requests" color="#345cf2" style={styles.loading} /> : loadError ? <View style={styles.card}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View> : <>
        <View style={styles.balanceGrid}>{leaveTypes.map(type => <View key={type} accessibilityLabel={`${type} balance: ${availableLeave(records, type)} days`} style={styles.balanceCard}><View style={styles.balanceHeading}><View style={styles.miniCalendar}><View style={styles.miniCalendarLine} /></View><Text style={styles.balanceLabel}>{type}</Text></View><Text style={styles.balanceValue}>{availableLeave(records, type)} days</Text><Text style={styles.balanceCaption}>Available balance</Text></View>)}</View>
        <View style={styles.leaveInfo}><Text style={styles.link}>ⓘ</Text><Text style={[styles.leaveInfoText, styles.flex]}>Pending requests reserve your available balance. Approved requests deduct days. Cancelling a pending request releases the reservation.</Text></View>
        <Text style={styles.sectionTitle}>My requests</Text>{notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}{error !== '' && !applyOpen && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        {requests.length === 0 ? <View style={styles.leaveRequest}><Text style={styles.emptyTitle}>No leave requests yet</Text><Text style={styles.subtitle}>Use Apply to request time off.</Text></View> : requests.map(request => <View key={request.id} style={styles.leaveRequest}><View style={styles.between}><View style={styles.requestIdentity}><View style={styles.requestAvatar}><Text style={styles.requestInitial}>{(request.employeeName || 'Admin').split(' ').slice(0, 2).map(part => part[0]).join('')}</Text></View><View style={styles.flex}><Text style={styles.requestName}>{request.employeeName || 'Admin'}</Text><Text style={styles.balanceLabel}>{request.leaveType || 'Casual leave'}</Text></View></View><View style={[styles.leaveBadge, request.status === 'approved' && styles.leaveApproved, ['cancelled', 'rejected'].includes(request.status) && styles.leaveClosed]}><Text style={styles.leaveBadgeText}>{request.status.charAt(0).toUpperCase() + request.status.slice(1)}</Text></View></View><Text style={styles.requestDates}>{leaveDateLabel(request.startDate)} – {leaveDateLabel(request.endDate)} · {leaveDays(request.startDate, request.endDate)} {leaveDays(request.startDate, request.endDate) === 1 ? 'day' : 'days'}</Text><Text style={styles.subtitle}>{request.reason}</Text>{request.status === 'pending' && <Pressable accessibilityRole="button" accessibilityLabel="Cancel request" disabled={saving} onPress={() => void cancel(request.id)} style={[styles.cancelRequest, saving && styles.dim]}><Text style={styles.viewText}>Cancel request</Text></Pressable>}</View>)}
        <Text style={styles.leaveFooter}>Offline sample workspace · v2.3</Text>
      </>}
    </ScrollView><AdminBottomNavigation disabled={saving} />
    <Modal transparent visible={applyOpen} animationType="fade" onRequestClose={() => { if (!savingRef.current) setApplyOpen(false); }}><KeyboardAvoidingView style={[styles.overlay, mobile && { justifyContent: 'flex-end', paddingHorizontal: 8, paddingBottom: Math.max(8, insets.bottom) }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View accessibilityViewIsModal style={styles.modal}><View style={styles.handle} /><View style={styles.between}><Text style={styles.modalTitle}>Apply leave</Text><Pressable accessibilityRole="button" accessibilityLabel="Close leave form" disabled={saving} onPress={() => setApplyOpen(false)} style={styles.sheetClose}><AdminMenuIcon name="close" color="#20334f" /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.label}>Leave type *</Text><View style={styles.leaveTypeOptions}>{leaveTypes.map(type => <Pressable key={type} accessibilityRole="radio" accessibilityLabel={type} accessibilityState={{ checked: leaveType === type }} disabled={saving} onPress={() => setLeaveType(type)} style={[styles.leaveTypeOption, leaveType === type && styles.leaveTypeSelected]}><Text style={styles.viewText}>{type}</Text></Pressable>)}</View><View style={styles.timeFields}>{dateField('Start date', startDate, setStartDate)}{dateField('End date', endDate, setEndDate)}</View>{Platform.OS !== 'web' && <Text style={styles.subtitle}>DD/MM/YYYY</Text>}<Text style={styles.label}>Reason *</Text><TextInput accessibilityLabel="Leave reason" editable={!saving} value={reason} onChangeText={setReason} multiline style={[styles.input, styles.correctionReason]} />{error !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}</ScrollView><Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={[styles.submitButton, saving && styles.dim]}><Text style={styles.submitText}>{saving ? 'Saving…' : 'Submit leave request'}</Text></Pressable></View></KeyboardAvoidingView></Modal>
  </View></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  correctionSheet: { padding: 22, paddingTop: 12, borderRadius: 22 }, handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#d8e0ed', alignSelf: 'center', marginBottom: 18 }, sheetClose: { width: 44, height: 44, borderWidth: 2, borderColor: '#829dff', borderRadius: 16, backgroundColor: '#f5f8ff' }, timeFields: { flexDirection: 'row', gap: 12 }, inputText: { fontSize: 14, color: '#20334f' }, correctionReason: { minHeight: 68 }, pickerOptions: { maxHeight: 180, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, marginTop: 8 }, pickerOption: { minHeight: 44, padding: 12, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
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

const leaveStyles = StyleSheet.create({
  ...baseStyles,
  content: { ...baseStyles.content, paddingTop: 12 },
  eyebrow: { fontSize: 9, letterSpacing: 1.4, fontWeight: '700', color: '#71829c' },
  leaveAvatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff' }, leaveInitial: { color: '#345cf2', fontSize: 12, fontWeight: '700' },
  applyButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#345cf2', justifyContent: 'center', alignItems: 'center' },
  balanceGrid: { flexDirection: 'row', gap: 12, marginTop: 22 }, balanceCard: { flex: 1, minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, padding: 14 }, balanceHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, balanceLabel: { fontSize: 10, color: '#71829c', marginTop: 3 }, balanceValue: { fontSize: 22, fontWeight: '800', color: '#20334f', marginTop: 12 }, balanceCaption: { fontSize: 9, color: '#8192ad', marginTop: 5 }, miniCalendar: { width: 13, height: 13, borderWidth: 1, borderColor: '#345cf2', borderRadius: 2 }, miniCalendarLine: { height: 1, backgroundColor: '#345cf2', marginTop: 3 },
  leaveInfo: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 13, backgroundColor: '#eaf0ff', marginTop: 16 }, leaveInfoText: { fontSize: 11, lineHeight: 18, color: '#607591' },
  leaveRequest: { padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, marginBottom: 12 }, requestIdentity: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }, requestAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#def6ef', alignItems: 'center', justifyContent: 'center' }, requestInitial: { fontSize: 12, fontWeight: '800', color: '#138f80' }, requestName: { fontSize: 13, fontWeight: '700', color: '#20334f' }, leaveBadge: { backgroundColor: '#fff1db', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 }, leaveApproved: { backgroundColor: '#def6ef' }, leaveClosed: { backgroundColor: '#edf1f8' }, leaveBadgeText: { fontSize: 9, color: '#405573' }, requestDates: { fontSize: 12, fontWeight: '600', color: '#20334f', marginTop: 18, lineHeight: 18 }, cancelRequest: { minHeight: 44, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  leaveFooter: { fontSize: 9, color: '#8192ad', textAlign: 'center', marginTop: 22, marginBottom: 12 }, leaveTypeOptions: { flexDirection: 'row', gap: 10 }, leaveTypeOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12 }, leaveTypeSelected: { borderColor: '#345cf2', backgroundColor: '#eaf0ff' },
});
