import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { DatePickerField } from '../../../src/ui/DatePickerField';
import { SelectField } from '../../../src/ui/SelectField';
import { AttendanceAction, attendanceUI as ui } from '../../../src/features/employee/AttendanceUI';
import { Field, RefreshButton } from '../../../src/features/employee/components';
import { dayKey, leaveDays } from '../../../src/features/employee/data';
import { useEmployeeStyles } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';
import { leaveApi } from '../../../src/core/admin/api';
import { apiErrorMessage } from '../../../src/core/admin/http';

export default function ApplyLeaveScreen() {
  const s = useEmployeeStyles();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const {
    selectedProfileId, employeeProfile, employeeCompanyId, employeeBranchId, leaveTypes, leaveLoading, leaveSaving, leaveError,
    refreshLeave, leaveType, setLeaveType, from, setFrom, to, setTo, reason, setReason,
    formError, setFormError, leaveBalance, submitLeave, go,
  } = useEmployeeWorkspace();
  const today = dayKey();
  const [people, setPeople] = React.useState<{ id: string; name: string; position: string; department: string }[]>([]);
  const [reportingToId, setReportingToId] = React.useState('');
  const [peopleLoading, setPeopleLoading] = React.useState(true);
  const [peopleError, setPeopleError] = React.useState('');
  const [peopleReload, setPeopleReload] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setPeople([]); setReportingToId(''); setPeopleError(''); setPeopleLoading(true);
    if (!employeeCompanyId || !employeeBranchId) { setPeopleLoading(false); return; }
    leaveApi.reportingTo(employeeCompanyId, employeeBranchId).then(items => {
      if (active) { setPeople(items); setReportingToId(employeeProfile?.reportingManagerId ?? ''); }
    }).catch(error => {
      if (active) setPeopleError(apiErrorMessage(error, 'Unable to load reporting managers.'));
    }).finally(() => { if (active) setPeopleLoading(false); });
    return () => { active = false; };
  }, [employeeCompanyId, employeeBranchId, peopleReload, employeeProfile?.reportingManagerId]);
  React.useEffect(() => {
    setFrom(dayKey()); setTo(dayKey()); setReason(''); setFormError('');
  }, [selectedProfileId]);
  React.useEffect(() => {
    if (leaveTypes.length && !leaveTypes.some(item => item.name === leaveType)) setLeaveType(leaveTypes[0].name);
  }, [leaveTypes, leaveType]);
  const selected = leaveTypes.find(item => item.name === leaveType);
  const balance = selected ? leaveBalance(selected.name) : null;
  const calendarDays = leaveDays(from, to);
  // The backend skips the company's weekly offs and holidays; null means not yet known.
  const [workingDays, setWorkingDays] = React.useState<number | null>(null);
  React.useEffect(() => {
    let active = true;
    setWorkingDays(null);
    if (!employeeCompanyId || !employeeBranchId || !from || !to || to < from) return;
    leaveApi.workingDays(employeeCompanyId, employeeBranchId, from, to)
      .then(result => { if (active) setWorkingDays(result.days); })
      .catch(() => { if (active) setWorkingDays(null); });
    return () => { active = false; };
  }, [employeeCompanyId, employeeBranchId, from, to]);
  const disabled = leaveSaving || leaveLoading || !!leaveError || !employeeProfile || !selected || peopleLoading || !!peopleError || !people.length;
  const back = () => { if (!leaveSaving) go(returnTo === 'attendance' ? 'attendance' : 'leave'); };

  return <View style={ui.page}>
    <AdminPageHeading title="Apply for leave" onBack={back} backDisabled={leaveSaving} style={{ marginBottom: 16 }} />
    <View style={[s.card, ui.section]}>
      {leaveLoading && <ActivityIndicator accessibilityLabel="Loading leave options" />}
      {!!leaveError && <View style={[ui.error, { gap: 10 }]}>
        <Text accessibilityRole="alert" style={s.error}>{leaveError}</Text>
        <RefreshButton label="Retry leave options" retry loading={leaveLoading} onPress={refreshLeave} />
      </View>}
      {!leaveLoading && !leaveError && !leaveTypes.length && <Text style={s.small}>No leave types available. Contact your administrator.</Text>}
      <SelectField label="Leave type" value={leaveType} options={leaveTypes.map(item => ({ value: item.name, label: item.name }))}
        disabled={leaveSaving || leaveLoading || !!leaveError || !leaveTypes.length} onChange={value => { setLeaveType(value); setFormError(''); }} />
      {!!selected && <View style={[s.between, { flexWrap: 'wrap', gap: 8 }]}>
        <Text style={s.small}>{selected.isPaid ? 'Paid leave' : 'Unpaid leave'}</Text>
        <Text style={s.small}>Available: {balance === null ? 'Not allocated' : `${balance} days`}</Text>
      </View>}
      <SelectField label="Reporting to" value={reportingToId} options={[
        { value: '', label: peopleLoading ? 'Loading managers…' : 'Select reporting manager' },
        ...people.map(person => ({ value: person.id, label: [person.name, person.position, person.department].filter(Boolean).join(' · ') })),
      ]} disabled={leaveSaving || peopleLoading || !!peopleError || !people.length || !!employeeProfile?.reportingManagerId} onChange={value => { setReportingToId(value); setFormError(''); }} />
      <Text style={s.small}>Only the selected manager can approve or reject this request.</Text>
      <Text style={s.small}>Leave counts working days only. Your company's weekly offs and holidays are not deducted. Balances are allocated manually by HR.</Text>
      {!!peopleError && <View style={[ui.error, { gap: 8 }]}><Text accessibilityRole="alert" style={s.error}>{peopleError}</Text><RefreshButton label="Retry reporting managers" retry onPress={() => setPeopleReload(value => value + 1)} /></View>}
      {!peopleLoading && !peopleError && !people.length && <Text style={s.small}>No reporting managers available. Contact your administrator.</Text>}
      <View style={ui.actionRow}>
        <View style={[ui.actionCell, { gap: 8 }]}>
          <Text style={ui.caption}>From</Text>
          <DatePickerField hideLabel label="Leave start date" value={from} minDate={today} disabled={leaveSaving} onChange={value => {
            setFrom(value);
            if (to < value || to.slice(0, 4) !== value.slice(0, 4)) setTo(value);
            setFormError('');
          }} />
        </View>
        <View style={[ui.actionCell, { gap: 8 }]}>
          <Text style={ui.caption}>To</Text>
          <DatePickerField hideLabel label="Leave end date" value={to} minDate={from || today} maxDate={`${(from || today).slice(0, 4)}-12-31`} disabled={leaveSaving}
            onChange={value => { setTo(value); setFormError(''); }} />
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={ui.sectionHeading}>{workingDays === null
        ? `${calendarDays} calendar ${calendarDays === 1 ? 'day' : 'days'}`
        : `${workingDays} working ${workingDays === 1 ? 'day' : 'days'}${workingDays !== calendarDays ? ` (${calendarDays - workingDays} off ${calendarDays - workingDays === 1 ? 'day' : 'days'} excluded)` : ''}`}</Text>
      {workingDays === 0 && <Text style={s.small}>These dates are all weekly offs or holidays, so no leave is needed.</Text>}
      <View>
        <Field label="Reason" value={reason} onChange={value => { setReason(value); setFormError(''); }} multiline editable={!leaveSaving} maxLength={2000} validation={{ required: true }} />
        <Text style={[ui.caption, { textAlign: 'right' }]}>{reason.length}/2000 characters</Text>
      </View>
      {!!formError && <View style={ui.error}><Text accessibilityRole="alert" style={s.error}>{formError}</Text></View>}
      <View style={[ui.actionRow, ui.divider]}>
        <View style={ui.actionCell}><AttendanceAction label="Cancel" secondary disabled={leaveSaving} onPress={back} /></View>
        <View style={ui.actionCell}><AttendanceAction label={leaveSaving ? 'Submitting…' : 'Submit Request'} loading={leaveSaving} disabled={!!disabled} onPress={() => {
          if (!people.some(person => person.id === reportingToId)) { setFormError('Select a reporting manager.'); return; }
          void submitLeave(reportingToId);
        }} /></View>
      </View>
    </View>
  </View>;
}
