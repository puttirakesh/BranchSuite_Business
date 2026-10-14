
import React from "react";

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

import { s } from "./styles";

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
// LIVE BACKEND ATTENDANCE CARD
// =====================================================

export function AttendanceCard() {
  const {
    go,
    shift,
    checkAttendance,
    employeeBranch,
    employeeProfile,
    attendanceLoading,
    attendanceSaving,
    attendanceError,
  } = useEmployeeWorkspace();

  const disabled =
    attendanceLoading ||
    attendanceSaving ||
    !!attendanceError ||
    !employeeProfile;

  const status = attendanceLoading
    ? "Loading"
    : attendanceError
      ? "Unavailable"
      : shift?.outTime
        ? "Shift complete"
        : shift?.inTime
          ? "Checked in"
          : "Not checked in";

  const buttonLabel = attendanceSaving
    ? "Saving..."
    : attendanceLoading
      ? "Loading..."
      : shift?.outTime
        ? "View attendance"
        : shift?.inTime
          ? "Check out"
          : "Check in";

  return (
    <View style={[s.card, s.shiftCard]}>
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
          <Icon symbol="◷" />

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
            Check in
          </Text>

          <Text style={s.time}>
            {shift?.inTime || "—"}
          </Text>
        </View>

        <View style={s.timeLine} />

        <View style={s.flex}>
          <Text style={s.small}>
            Check out
          </Text>

          <Text style={s.time}>
            {shift?.outTime || "—"}
          </Text>
        </View>
      </View>

      <Button
        disabled={disabled}
        label={buttonLabel}
        onPress={
          shift?.outTime
            ? () => go("attendance")
            : checkAttendance
        }
      />

      {attendanceError ? (
        <Text
          style={[
            s.small,
            {
              marginTop: 10,
              color: "#B94D61",
            },
          ]}
        >
          {attendanceError}
        </Text>
      ) : !employeeProfile ? (
        <Text
          style={[
            s.small,
            {
              marginTop: 10,
              color: "#AA6B13",
            },
          ]}
        >
          A valid employee profile is required
          before recording attendance.
        </Text>
      ) : (
        <Text
          style={[
            s.small,
            {
              marginTop: 10,
              color: "#138F80",
            },
          ]}
        >
          Connected to BranchSuite attendance.
        </Text>
      )}
    </View>
  );
}
