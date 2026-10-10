import { Pressable, Text, View } from 'react-native';
import { Task, employee, displayDate } from './data';
import { Button, Badge, Icon } from './components';
import { s } from './styles';
import { useEmployeeWorkspace } from './workspace';

export function TaskCard({ task }: { task: Task }) {
  const { setDialog, setActiveTask, setTaskStatus, setTaskNote, setFormError } = useEmployeeWorkspace();

  return (
    <Pressable
      key={task.id}
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
        pressed && { borderColor: "#91BCAE" },
      ]}
    >
      <View style={s.between}>
        <Text style={[s.small, task.high && { color: "#AA6B13" }]}>
          {task.type === "Call" ? "♧" : "☑"} {task.type}
          {task.high ? " · High priority" : ""}
        </Text>
        <Badge label={task.status} />
      </View>
      <Text style={[s.cardTitle, { marginTop: 14, marginBottom: 7 }]}>
        {task.title}
      </Text>
      <Text style={s.small}>
        {displayDate(task.date)} · {task.time}
      </Text>
    </Pressable>
  );
}
export function AttendanceCard() {
  const { loaded, go, shift, checkAttendance } = useEmployeeWorkspace();

  return (
    <View style={[s.card, s.shiftCard]}>
      <View style={[s.between, { flexWrap: "wrap", gap: 10 }]}>
        <View style={s.row}>
          <Icon symbol="◷" />
          <Text style={s.cardTitle}>Today’s attendance</Text>
        </View>
        <Badge
          label={
            shift?.outTime
              ? "Shift complete"
              : shift?.inTime
                ? "Checked in"
                : "Not checked in"
          }
        />
      </View>
      <Text style={[s.small, { marginTop: 12 }]}>
        {employee.branch} · 09:00–18:00 shift
      </Text>
      <View style={s.times}>
        <View style={s.flex}>
          <Text style={s.small}>Check in</Text>
          <Text style={s.time}>{shift?.inTime || "—"}</Text>
        </View>
        <View style={s.timeLine} />
        <View style={s.flex}>
          <Text style={s.small}>Check out</Text>
          <Text style={s.time}>{shift?.outTime || "—"}</Text>
        </View>
      </View>
      <Button
        disabled={!loaded}
        label={
          shift?.outTime
            ? "View attendance"
            : shift?.inTime
              ? "Check out"
              : "Check in"
        }
        onPress={shift?.outTime ? () => go("attendance") : checkAttendance}
      />
      <Text style={s.localHint}>Sample shift · saved on this device</Text>
    </View>
  );
}
