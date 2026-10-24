import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { EmployeePageHeading } from '../../../src/features/employee/EmployeePageHeading';
import { Badge, RefreshButton } from '../../../src/features/employee/components';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';
import { useEmployeeStyles } from '../../../src/features/employee/styles';
import { correctionTime } from '../../../src/features/employee/attendanceCorrectionTimes';
import { displayDate } from '../../../src/features/employee/data';
import { DatePickerField } from '../../../src/ui/DatePickerField';
import { AttendanceTimes, attendanceUI as ui } from '../../../src/features/employee/AttendanceUI';

export default function AttendanceHistoryScreen() {
  const s = useEmployeeStyles();
  const { attendanceHistory, attendanceLoading, attendanceError, refreshAttendance, selectedProfileId } = useEmployeeWorkspace();
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  React.useEffect(() => { setDate(new Date().toISOString().slice(0, 10)); }, [selectedProfileId]);
  const records = attendanceHistory.filter(item => item.attendanceDate.slice(0, 10) === date);
  return <View style={ui.page}>
    <EmployeePageHeading title="Your Attendance" backTo="attendance">
      <RefreshButton iconOnly label="Refresh attendance" loading={attendanceLoading} onPress={refreshAttendance} />
    </EmployeePageHeading>
    <View style={ui.section}>
    <View style={[s.card, ui.section]}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={s.cardTitle}>Check Your Attendance</Text>
        <Text style={s.small}>Choose a date to see your attendance for that day.</Text>
      </View>
      <DatePickerField hideLabel label="Attendance date" value={date} onChange={setDate} maxDate={new Date().toISOString().slice(0, 10)} />
    </View>
      {attendanceLoading ? <View style={[s.card, ui.empty]}><ActivityIndicator accessibilityLabel="Loading attendance" /><Text style={s.small}>Loading your attendance…</Text></View> : attendanceError ? <View style={[s.card, ui.error]}><Text accessibilityRole="alert" style={s.error}>{attendanceError}</Text><Text style={s.small}>Use Refresh in the page header to try again.</Text></View> : records.length ? records.map(record => <View key={record.id} style={[s.card, ui.section]}>
        <View style={[s.between, { flexWrap: 'wrap', gap: 8 }]}>
          <Text style={s.cardTitle}>{new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          <Badge label={record.status} />
        </View>
        <AttendanceTimes checkIn={record.checkInAt ? correctionTime(record.checkInAt) : '—'} checkOut={record.checkOutAt ? correctionTime(record.checkOutAt) : '—'} />
        <View style={[ui.divider, s.between, { gap: 8, flexWrap: 'wrap' }]}>
          <Text style={s.small}>Recorded duration</Text>
          <Text style={ui.sectionHeading}>{record.status === 'PRESENT' && record.checkInAt && !record.checkOutAt ? 'Shift in progress' : `${Math.floor(record.totalMinutes / 60)}h ${record.totalMinutes % 60}m`}</Text>
        </View>
        {!!record.notes && <Text style={s.body}>{record.notes}</Text>}
      </View>) : <View style={[s.card, ui.empty]}><Text style={ui.sectionHeading}>No attendance found</Text><Text style={ui.emptyText}>No attendance recorded for {displayDate(date)}.</Text><Text style={ui.emptyText}>Choose another date to check a different day.</Text></View>}
    </View>
  </View>;
}
