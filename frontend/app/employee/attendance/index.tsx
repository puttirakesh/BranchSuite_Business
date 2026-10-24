import { EmployeePageHeading } from '../../../src/features/employee/EmployeePageHeading';

import React from "react";

import {
  ActivityIndicator,
  Text,
  View,
} from "react-native";

import {
  displayDate,
} from "../../../src/features/employee/data";

import {
  Badge,
  RefreshButton,
  Tile,
} from "../../../src/features/employee/components";

import {
  useEmployeeStyles,
} from "../../../src/features/employee/styles";

import {
  AttendanceCard,
} from "../../../src/features/employee/cards";

import {
  useEmployeeWorkspace,
} from "../../../src/features/employee/workspace";

export default function AttendanceScreen() {
  const s = useEmployeeStyles();
  const {
    leaveRequests,
    leaveLoading,
    leaveError,
    openLeave,
    attendanceLoading,
    refreshAttendance,
  } = useEmployeeWorkspace();

  return (
    <>
    <EmployeePageHeading title="My attendance">
      <RefreshButton label="Refresh attendance" loading={attendanceLoading} onPress={refreshAttendance} />
    </EmployeePageHeading>
    <View style={{ gap: 12, maxWidth: 760, width: '100%' }}>
        <AttendanceCard attendanceActions />

        <Tile description="Apply and track your requests"
          title="Apply for leave"
          symbol="♧"
          onPress={openLeave}
        />

        <Text style={s.sectionTitle}>
          Leave requests
        </Text>

        {leaveLoading ? <ActivityIndicator accessibilityLabel="Loading leave requests" /> : leaveError ? <Text accessibilityRole="alert" style={s.error}>{leaveError}</Text> : leaveRequests.length ? (
          leaveRequests.map((leave) => (
            <View
              key={leave.id}
              style={s.card}
            >
              <View style={s.between}>
                <Text style={s.cardTitle}>
                  {leave.leaveType?.name ?? 'Leave request'}
                </Text>

                <Badge label={leave.status} />
              </View>

              <Text style={s.small}>
                {displayDate(leave.startDate.slice(0, 10))}
                {" – "}
                {displayDate(leave.endDate.slice(0, 10))}
              </Text>

              <Text
                style={[
                  s.body,
                  {
                    marginTop: 10,
                  },
                ]}
              >
                {leave.reason}
              </Text>

            </View>
          ))
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              No leave requests
            </Text>

            <Text style={s.small}>
              Your submitted leave requests and approval status will appear here.
            </Text>
          </View>
        )}
    </View>
    </>
  );
}
