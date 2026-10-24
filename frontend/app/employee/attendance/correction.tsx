import React from 'react';
import { View } from 'react-native';
import { EmployeePageHeading } from '../../../src/features/employee/EmployeePageHeading';
import { AttendanceCorrections } from '../../../src/features/employee/AttendanceCorrections';
import { RefreshButton } from '../../../src/features/employee/components';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';
import { attendanceUI } from '../../../src/features/employee/AttendanceUI';

export default function AttendanceCorrectionScreen() {
  const [refreshToken, setRefreshToken] = React.useState(0);
  const { refreshAttendance, attendanceLoading } = useEmployeeWorkspace();
  return <View style={attendanceUI.page}>
    <EmployeePageHeading title="Request Attendance Correction" backTo="attendance">
      <RefreshButton iconOnly label="Refresh attendance and correction requests" loading={attendanceLoading} onPress={() => { refreshAttendance(); setRefreshToken(value => value + 1); }} />
    </EmployeePageHeading>
    <AttendanceCorrections refreshToken={refreshToken} />
  </View>;
}
