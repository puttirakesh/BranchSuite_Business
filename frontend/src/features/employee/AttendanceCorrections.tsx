import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { attendanceCorrectionsApi, type AttendanceCorrectionDto } from '../../core/admin/api';
import { DatePickerField } from '../../ui/DatePickerField';
import { Badge, Field } from './components';
import { AttendanceAction, AttendanceTimes, attendanceUI as ui } from './AttendanceUI';
import { displayDate } from './data';
import { useEmployeeStyles } from './styles';
import { useEmployeeWorkspace } from './workspace';
import { attendanceCorrectionTimes, correctionDateTime, correctionTime } from './attendanceCorrectionTimes';

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(response) ? response.join('\n') : response || (error instanceof Error ? error.message : 'Unable to update correction requests. Please try again.');
}

function currentAttendanceDate() {
  // Attendance times on this form use IST (UTC+05:30).
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

export function AttendanceCorrections({ refreshToken }: { refreshToken: number }) {
  const s = useEmployeeStyles();
  const { attendanceHistory, attendanceLoading, attendanceError, employeeProfile, employeeCompanyId, employeeBranchId, refreshAttendance } = useEmployeeWorkspace();
  const [requests, setRequests] = useState<AttendanceCorrectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [date, setDate] = useState(currentAttendanceDate);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  const [reload, setReload] = useState(0);
  const userId = employeeProfile?.userId;
  useEffect(() => {
    setDate(currentAttendanceDate()); setRequests([]); setNotice(''); setError(''); setReason('');
  }, [employeeCompanyId, employeeBranchId, userId]);
  useFocusEffect(React.useCallback(() => {
    const version = ++generation.current;
    setLoading(true); setLoadError('');
    attendanceCorrectionsApi.mine().then(items => {
      if (generation.current === version) setRequests(items.filter(item => item.companyId === employeeCompanyId && item.branchId === employeeBranchId && item.userId === userId));
    }).catch(cause => {
      if (generation.current === version) setLoadError(errorMessage(cause));
    }).finally(() => { if (generation.current === version) setLoading(false); });
    return () => { generation.current++; };
  }, [employeeCompanyId, employeeBranchId, userId, reload, refreshToken]));
  const eligible = attendanceHistory.filter(item => item.status === 'PRESENT' && !requests.some(request => request.attendanceId === item.id && request.status === 'PENDING')).sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
  const recorded = attendanceHistory.find(item => item.attendanceDate.slice(0, 10) === date);
  const selected = eligible.find(item => item.attendanceDate.slice(0, 10) === date);
  useEffect(() => {
    setStart(recorded?.checkInAt ? correctionTime(recorded.checkInAt) : '');
    setEnd(recorded?.checkOutAt ? correctionTime(recorded.checkOutAt) : '');
    setError(''); setReason(''); setNotice('');
  }, [date, recorded?.id, recorded?.checkInAt, recorded?.checkOutAt]);
  let preview: ReturnType<typeof attendanceCorrectionTimes> | null = null;
  if (selected && start && end) {
    try {
      preview = attendanceCorrectionTimes(selected.attendanceDate.slice(0, 10), start, end);
    } catch { /* Show validation when the employee submits. */ }
  }
  const unavailable = loading || !!loadError || attendanceLoading || !!attendanceError || !userId;
  const mutate = async (requestId?: string) => {
    if (lock.current || unavailable) return;
    const version = generation.current;
    setError(''); setNotice('');
    try {
      if (!requestId && !selected) throw new Error('Choose an available recorded shift.');
      if (!requestId && !reason.trim()) throw new Error('Please explain why these times need correcting.');
      const body = !requestId && selected ? { attendanceId: selected.id, ...attendanceCorrectionTimes(selected.attendanceDate.slice(0, 10), start, end), reason: reason.trim() } : null;
      lock.current = true; setBusy(true); setBusyAction(requestId ?? 'submit');
      if (requestId) await attendanceCorrectionsApi.cancel(requestId);
      else await attendanceCorrectionsApi.create(body!);
      if (generation.current !== version) return;
      setNotice(requestId ? 'Correction request cancelled.' : 'Correction request sent for approval. Your attendance updates after approval.');
      if (!requestId) { setStart(''); setEnd(''); setReason(''); }
      refreshAttendance();
    } catch (cause) {
      if (generation.current === version) setError(errorMessage(cause));
    } finally {
      if (lock.current) setReload(value => value + 1);
      lock.current = false; setBusy(false); setBusyAction('');
    }
  };
  return <View style={ui.section}>
    {!!notice && <View style={ui.success}><Text accessibilityRole="alert" style={s.body}>{notice}</Text></View>}
    {!!error && !selected && <View style={ui.error}><Text accessibilityRole="alert" style={s.error}>{error}</Text></View>}
    <View style={[s.card, ui.section]}>
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={ui.sectionHeading}>Choose an attendance date</Text>
      <Text style={s.small}>Select a recorded day to request a change to your check-in or check-out.</Text>
    </View>
    {loading && <ActivityIndicator accessibilityLabel="Loading correction requests" />}
    {attendanceLoading && <Text style={s.small}>Loading recorded attendance…</Text>}
    {!!attendanceError && <Text accessibilityRole="alert" style={s.error}>{attendanceError} Use Refresh in the page header to retry.</Text>}
    {!!loadError && <Text accessibilityRole="alert" style={s.error}>{loadError} Use Refresh in the page header to retry.</Text>}
    <DatePickerField hideLabel label="Attendance date" value={date} onChange={setDate} disabled={busy || unavailable} maxDate={currentAttendanceDate()} />
    {!date && <Text style={s.small}>Select the day you want to correct. The recorded check-in and check-out will fill in automatically.</Text>}
    {!!date && !unavailable && !selected && <View style={ui.info}><Text style={s.small}>{!recorded ? 'No attendance recorded for this date. Contact your manager to report a missing attendance day.' : recorded.status !== 'PRESENT' ? 'Only recorded present shifts can be corrected. Contact your manager about this attendance status.' : 'This date already has a pending correction request. You can track or cancel it below.'}</Text></View>}
    {!!recorded && <View style={[ui.divider, { gap: 10 }]}>
      <Text style={ui.sectionHeading}>Recorded attendance</Text>
      <AttendanceTimes compact checkIn={recorded.checkInAt ? correctionTime(recorded.checkInAt) : 'Not recorded'} checkOut={recorded.checkOutAt ? correctionTime(recorded.checkOutAt) : 'Not recorded'} />
    </View>}
    </View>
    {!!selected && <View style={[s.card, ui.section]}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={ui.sectionHeading}>Correction details</Text>
        <Text style={s.small}>Update the times below and explain the change. All times are in IST.</Text>
      </View>
      <View>
      <Field validation={{ kind: 'time', startsWith: 'digit', pattern: /^(?:0?[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/i, patternMessage: 'Use a time such as 9:00 AM.' }} label="Correct check-in (IST)" value={start} onChange={value => setStart(value.toUpperCase())} editable={!busy} maxLength={8} hint="12-hour time, for example 9:00 AM" />
      <Field validation={{ kind: 'time', startsWith: 'digit', pattern: /^(?:0?[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/i, patternMessage: 'Use a time such as 9:00 AM.' }} label="Correct check-out (IST)" value={end} onChange={value => setEnd(value.toUpperCase())} editable={!busy} maxLength={8} hint="An earlier time means the shift ends the next day." />
      <Field label="Reason for correction" value={reason} onChange={setReason} editable={!busy} multiline maxLength={1000} hint="Explain what happened so your manager can review the request." />
      <Text style={[ui.caption, { textAlign: 'right' }]}>{reason.length}/1000 characters</Text>
      </View>
      {!!preview && <View style={ui.info}>
        <Text style={ui.sectionHeading}>Review your requested times</Text>
        <Text style={s.small}>Check-in: {correctionDateTime(preview.requestedCheckInAt)} (IST)</Text>
        <Text style={s.small}>Check-out: {correctionDateTime(preview.requestedCheckOutAt)} (IST)</Text>
      </View>}
      {!!error && <View style={ui.error}><Text accessibilityRole="alert" style={s.error}>{error}</Text></View>}
      <View style={[ui.divider, { gap: 10 }]}>
        <Text style={s.small}>Your recorded attendance changes only after approval.</Text>
        <AttendanceAction label={busyAction === 'submit' ? 'Sending…' : 'Send for approval'} loading={busyAction === 'submit'} disabled={busy || unavailable || !selected} onPress={() => { void mutate(); }} />
      </View>
    </View>}
    <View style={{ gap: 12 }}>
    <View style={[s.between, { gap: 8 }]}><Text accessibilityRole="header" style={ui.sectionHeading}>Your requests</Text><Text style={ui.caption}>{requests.length} {requests.length === 1 ? 'request' : 'requests'}</Text></View>
    {requests.map(item => <View key={item.id} style={[s.card, { gap: 12 }]}>
      <View style={[s.between, { flexWrap: 'wrap', gap: 8 }]}>
        <Text style={s.cardTitle}>{displayDate((item.attendance?.attendanceDate ?? item.requestedCheckInAt).slice(0, 10))}</Text>
        <Badge label={item.status} />
      </View>
      <Text style={s.small}>Check-in: {correctionDateTime(item.requestedCheckInAt)} (IST)</Text>
      <Text style={s.small}>Check-out: {correctionDateTime(item.requestedCheckOutAt)} (IST)</Text>
      <View style={ui.info}><Text style={ui.caption}>Reason</Text><Text style={s.body}>{item.reason}</Text></View>
      {!!item.reviewNote && <Text style={s.small}>Review note: {item.reviewNote}</Text>}
      {item.status === 'PENDING' && <View style={[ui.divider, { alignItems: 'flex-start' }]}><AttendanceAction label={busyAction === item.id ? 'Cancelling…' : 'Cancel request'} secondary danger loading={busyAction === item.id} disabled={busy || unavailable} onPress={() => { void mutate(item.id); }} /></View>}
    </View>)}
    {!loading && !loadError && !requests.length && <View style={[s.card, ui.empty]}><Text style={ui.emptyText}>Your correction requests and approval status will appear here.</Text></View>}
    </View>
  </View>;
}
