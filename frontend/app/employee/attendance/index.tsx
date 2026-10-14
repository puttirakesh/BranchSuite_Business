
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
  Tile,
} from "../../../src/features/employee/components";

import {
  s,
} from "../../../src/features/employee/styles";

import {
  AttendanceCard,
} from "../../../src/features/employee/cards";

import {
  useEmployeeWorkspace,
} from "../../../src/features/employee/workspace";

export default function AttendanceScreen() {
  const {
    splitLayout,
    records,
    openLeave,
    attendanceShifts,
    attendanceLoading,
    attendanceError,
  } = useEmployeeWorkspace();

  const sortedShifts = [...attendanceShifts].sort(
    (a, b) => b.date.localeCompare(a.date),
  );

  return (
    <View
      style={[
        s.columns,
        splitLayout && s.desktopColumns,
      ]}
    >
      {/* LEFT COLUMN */}

      <View style={s.column}>
        <AttendanceCard />

        <Tile
          title="Apply for leave"
          description="Apply and track your requests"
          symbol="♧"
          onPress={openLeave}
        />

        <Text style={s.sectionTitle}>
          Leave requests
        </Text>

        {records.leaves.length ? (
          records.leaves.map((leave) => (
            <View
              key={leave.id}
              style={s.card}
            >
              <View style={s.between}>
                <Text style={s.cardTitle}>
                  {leave.type}
                </Text>

                <Badge label={leave.status} />
              </View>

              <Text style={s.small}>
                {displayDate(leave.from)}
                {" – "}
                {displayDate(leave.to)}
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

              <Text style={s.localHint}>
                Saved on this device.
                Backend leave integration pending.
              </Text>
            </View>
          ))
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              No local leave requests
            </Text>

            <Text style={s.small}>
              Backend Leave Management integration
              is the next development step.
            </Text>
          </View>
        )}
      </View>

      {/* RIGHT COLUMN */}

      <View style={s.column}>
        <Text style={s.sectionTitle}>
          Recorded shifts
        </Text>

        {attendanceLoading ? (
          <View style={s.card}>
            <ActivityIndicator
              color="#345CF2"
            />

            <Text
              style={[
                s.small,
                {
                  marginTop: 10,
                },
              ]}
            >
              Loading attendance history...
            </Text>
          </View>
        ) : attendanceError ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              Attendance unavailable
            </Text>

            <Text
              style={[
                s.small,
                {
                  marginTop: 8,
                },
              ]}
            >
              {attendanceError}
            </Text>
          </View>
        ) : sortedShifts.length > 0 ? (
          sortedShifts.map((item) => (
            <View
              key={item.id}
              style={s.card}
            >
              <View style={s.between}>
                <Text style={s.cardTitle}>
                  {displayDate(item.date)}
                </Text>

                <Badge
                  label={
                    item.outTime
                      ? "Shift complete"
                      : item.inTime
                        ? "Checked in"
                        : item.status
                  }
                />
              </View>

              <Text
                style={[
                  s.small,
                  {
                    marginTop: 12,
                  },
                ]}
              >
                In: {item.inTime || "—"}
                {"  "}
                Out: {item.outTime || "—"}
              </Text>
            </View>
          ))
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              No attendance recorded
            </Text>

            <Text style={s.small}>
              Check in to record your first shift.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
