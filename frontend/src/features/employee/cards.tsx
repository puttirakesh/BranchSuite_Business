import { AppIcon } from "../../ui/AppIcon";

import React from "react";
import { useRouter } from 'expo-router';
import { AttendanceAction, attendanceUI } from './AttendanceUI';

import {
  Pressable,
  Text,
  View,
} from "react-native";

import {
  Task,
  displayDate,
} from "./data";

import {
  Button,
  Badge,
  Icon,
} from "./components";

import { useEmployeeStyles } from "./styles";

import {
  useEmployeeWorkspace,
} from "./workspace";

// =====================================================
// EXISTING TASK CARD
// =====================================================

export function TaskCard({
  task,
}: {
  task: Task;
}) {
  const s = useEmployeeStyles();
  const {
    setDialog,
    setActiveTask,
    setTaskStatus,
    setTaskNote,
    setFormError,
  } = useEmployeeWorkspace();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        setActiveTask(task);
        setTaskStatus(task.status);
        setTaskNote(task.note);
        setFormError("");
        setDialog("task");
      }}
      style={({ pressed }) => [
        s.card,
        s.taskCard,
        pressed && {
          borderColor: "#91BCAE",
        },
      ]}
    >
      <View style={s.between}>
        <Text
          style={[
            s.small,
            task.high && {
              color: "#AA6B13",
            },
          ]}
        >
          {task.type === "Call" ? "♧" : "☑"}
          {" "}
          {task.type}
          {task.high ? " · High priority" : ""}
        </Text>

        <Badge label={task.status} />
      </View>

      <Text
        style={[
          s.cardTitle,
          {
            marginTop: 14,
            marginBottom: 7,
          },
        ]}
      >
        {task.title}
      </Text>

      <Text style={s.small}>
        {displayDate(task.date)}
        {" · "}
        {task.time}
      </Text>
    </Pressable>
  );
}

// =====================================================
// ATTENDANCE STATUS HELPER
// =====================================================

function attendanceStatusLabel(
  shift: {
    inTime: string;
    outTime: string;
    status: string;
  } | null,
): string {
  if (!shift) {
    return "Not checked in";
  }

  if (shift.outTime) {
    return "Shift complete";
  }

  if (shift.status === "ABSENT") {
    return "Absent";
  }

  if (shift.status === "ON_LEAVE") {
    return "On leave";
  }

  if (shift.status === "HALF_DAY") {
    return "Half day";
  }

  if (
    shift.status === "PRESENT" &&
    shift.inTime
  ) {
    return "Checked in";
  }

  if (shift.status === "PRESENT") {
    return "Present (manual)";
  }

  return "Attendance recorded";
}

// =====================================================
// LIVE BACKEND ATTENDANCE CARD
// =====================================================

export function AttendanceCard({ attendanceActions = false }: { attendanceActions?: boolean }) {
  const s = useEmployeeStyles();
  const router = useRouter();
  const {
    shift,
    checkAttendance,
    employeeBranch,
    employeeProfile,
    profileLoading,
    attendanceLoading,
    attendanceSaving,
    attendanceError,
    refreshAttendance,
  } = useEmployeeWorkspace();

  // ===================================================
  // ATTENDANCE STATE
  // ===================================================

  const hasEmployeeProfile =
    Boolean(employeeProfile);

  const isLoading =
    profileLoading || attendanceLoading;

  const hasAttendanceRecord = Boolean(shift);

  const canCheckOut =
    shift?.status === "PRESENT" &&
    Boolean(shift.inTime) &&
    !shift.outTime;

  const canCheckIn = !hasAttendanceRecord;

  const canRecordAttendance =
    canCheckIn || canCheckOut;

  const disabled =
    isLoading ||
    attendanceSaving ||
    Boolean(attendanceError) ||
    !hasEmployeeProfile;

  // ===================================================
  // STATUS LABEL
  // ===================================================

  const status = isLoading
    ? "Loading"
    : attendanceError
      ? "Unavailable"
      : !hasEmployeeProfile
        ? "Profile required"
        : attendanceStatusLabel(shift);

  // ===================================================
  // BUTTON LABEL
  // ===================================================

  let buttonLabel = "Check in";

  if (attendanceSaving) {
    buttonLabel = "Saving...";
  } else if (isLoading) {
    buttonLabel = "Loading...";
  } else if (attendanceError) {
    buttonLabel = "Attendance unavailable";
  } else if (!hasEmployeeProfile) {
    buttonLabel = "Profile required";
  } else if (canCheckOut) {
    buttonLabel = "Check out";
  } else if (hasAttendanceRecord) {
    buttonLabel = "View attendance";
  }

  // ===================================================
  // BUTTON ACTION
  // ===================================================

  const handlePress = () => {
    if (disabled) {
      return;
    }

    if (!canRecordAttendance) {
      router.push('/employee/attendance/history');
      return;
    }

    void checkAttendance();
  };

  // ===================================================
  // INFORMATION MESSAGE
  // ===================================================

  let infoMessage =
    "Your Attendance will be recorded automatically.";

  let infoColor = "#138F80";

  if (attendanceError) {
    infoMessage = attendanceError;
    infoColor = "#B94D61";
  } else if (profileLoading) {
    infoMessage =
      "Loading your employee profile...";
    infoColor = "#5F7088";
  } else if (!hasEmployeeProfile) {
    infoMessage =
      "A valid employee profile is required before recording attendance.";
    infoColor = "#AA6B13";
  } else if (
    shift?.status === "ABSENT"
  ) {
    infoMessage =
      "Attendance has been marked absent for this date. Contact your manager if a correction is required.";
    infoColor = "#AA6B13";
  } else if (
    shift?.status === "ON_LEAVE"
  ) {
    infoMessage =
      "This date is recorded as leave. You cannot check in again against the same record.";
    infoColor = "#5F7088";
  } else if (
    shift?.status === "HALF_DAY"
  ) {
    infoMessage =
      "Half-day attendance is already recorded. Contact your manager if a correction is required.";
    infoColor = "#AA6B13";
  } else if (
    shift?.status === "PRESENT" &&
    !shift.inTime
  ) {
    infoMessage =
      "Your attendance was marked present manually. No self-check-in is required.";
    infoColor = "#138F80";
  } else if (shift?.outTime) {
    infoMessage =
      "Your shift is complete. View attendance to see the recorded details.";
    infoColor = "#138F80";
  }

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <View style={[s.card, s.shiftCard]}>
      {!!attendanceError && <Button label="Retry attendance" secondary onPress={refreshAttendance} disabled={attendanceLoading || attendanceSaving} />}
      <View
        style={[
          s.between,
          {
            flexWrap: "wrap",
            gap: 10,
          },
        ]}
      >
        <View style={s.row}>
          {!attendanceActions && <Icon symbol="◷" />}

          <Text style={s.cardTitle}>
            Today’s attendance
          </Text>
        </View>

        <Badge label={status} />
      </View>

      <Text
        style={[
          s.small,
          {
            marginTop: 12,
          },
        ]}
      >
        {employeeBranch}
      </Text>

      <View style={s.times}>
        <View style={s.flex}>
          <Text style={s.small}>
            Check in (IST)
          </Text>

          <Text style={s.time}>
            {shift?.inTime || "—"}
          </Text>
        </View>

        <View style={s.timeLine} />

        <View style={s.flex}>
          <Text style={s.small}>
            Check out (IST)
          </Text>

          <Text style={s.time}>
            {shift?.outTime || "—"}
          </Text>
        </View>
      </View>

      {(!attendanceActions || canRecordAttendance) && <Button
        disabled={disabled}
        label={buttonLabel}
        onPress={handlePress}
      />}
      {attendanceActions && <View style={[attendanceUI.actionRow, { marginTop: 12 }]}>
        <View style={attendanceUI.actionCell}><AttendanceAction label="View attendance" secondary={canRecordAttendance} onPress={() => router.push('/employee/attendance/history')} /></View>
        <View style={attendanceUI.actionCell}><AttendanceAction label="Request correction" secondary onPress={() => router.push('/employee/attendance/correction')} /></View>
      </View>}

      <Text
        style={[
          s.small,
          {
            marginTop: 10,
            color: infoColor,
          },
        ]}
      >
        {infoMessage}
      </Text>
    </View>
  );
}
