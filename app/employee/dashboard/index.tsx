import { Pressable, Text, View } from 'react-native';
import { money } from '../../../src/features/employee/data';
import { Icon, Tile } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { AttendanceCard, TaskCard } from '../../../src/features/employee/cards';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function DashboardScreen() {
  const { width, splitLayout, go, leaveBalance, outstanding } = useEmployeeWorkspace();
  return (
    <>
      <View style={s.greeting}>
        <Text style={s.hello}>Hello, Ananya.</Text>
        <Text style={s.greetingSubtitle}>
          One clear place for your day, tasks and pay.
        </Text>
      </View>
      <View style={[s.columns, splitLayout && s.desktopColumns]}>
        <View style={s.column}>
          {<AttendanceCard />}
          <Tile
            title="Apply for leave"
            description={`${leaveBalance("Casual leave")} casual · ${leaveBalance("Sick leave")} sick days`}
            symbol="♧"
            onPress={() => go("leave")}
          />
          <Tile
            title="My profile"
            description="Details & documents"
            symbol="♙"
            onPress={() => go("profile")}
          />
        </View>
        <View style={s.column}>
          <View style={s.metrics}>
            <Pressable
              accessibilityRole="button"
              onPress={() => go("tasks")}
              style={[s.metric, { backgroundColor: "#EDF3FF" }]}
            >
              <Icon symbol="☑" />
              <Text style={s.metricLabel}>Tasks to do</Text>
              <Text style={s.metricValue}>
                {outstanding.length}
              </Text>
              <Text style={s.small}>Assigned only to you</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => go("payroll")}
              style={[s.metric, { backgroundColor: "#F3EEFC" }]}
            >
              <Icon symbol="▤" lavender />
              <Text style={s.metricLabel}>Latest take-home</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[
                  s.metricValue,
                  width < 360 && { fontSize: 23 },
                ]}
              >
                {money(42200)}
              </Text>
              <Text style={s.small}>September 2026 · Paid</Text>
            </Pressable>
          </View>
          <View style={s.section}>
            <Text style={s.sectionTitle}>Your next tasks</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => go("tasks")}
            >
              <Text style={s.link}>View all ›</Text>
            </Pressable>
          </View>
          {outstanding.length ? (
            outstanding.slice(0, 3).map((task) => <TaskCard key={task.id} task={task} />)
          ) : (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                Your tasks are up to date
              </Text>
              <Text style={s.small}>
                Assigned CRM tasks will appear here.
              </Text>
            </View>
          )}
        </View>
      </View>
    </>

  );
}
