import { Text, View } from 'react-native';
import { displayDate } from '../../../src/features/employee/data';
import { Badge, Tile } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { AttendanceCard } from '../../../src/features/employee/cards';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function AttendanceScreen() {
  const { splitLayout, records, openLeave } = useEmployeeWorkspace();
  return (
    <View style={[s.columns, splitLayout && s.desktopColumns]}>
      <View style={s.column}>
        {<AttendanceCard />}
        <Tile
          title="Apply for leave"
          description="Apply and track your requests"
          symbol="♧"
          onPress={openLeave}
        />
        <Text style={s.sectionTitle}>Leave requests</Text>
        {records.leaves.length ? (
          records.leaves.map((l) => (
            <View key={l.id} style={s.card}>
              <View style={s.between}>
                <Text style={s.cardTitle}>{l.type}</Text>
                <Badge label={l.status} />
              </View>
              <Text style={s.small}>
                {displayDate(l.from)} – {displayDate(l.to)}
              </Text>
              <Text style={[s.body, { marginTop: 10 }]}>
                {l.reason}
              </Text>
              <Text style={s.localHint}>
                Saved locally · demo request
              </Text>
            </View>
          ))
        ) : (
          <Text style={s.small}>No leave requests yet.</Text>
        )}
      </View>
      <View style={s.column}>
        <Text style={s.sectionTitle}>Recorded shifts</Text>
        {records.shifts.length ? (
          [...records.shifts]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => (
              <View key={item.date} style={s.card}>
                <View style={s.between}>
                  <Text style={s.cardTitle}>
                    {displayDate(item.date)}
                  </Text>
                  <Badge
                    label={
                      item.outTime
                        ? "Shift complete"
                        : "Checked in"
                    }
                  />
                </View>
                <Text style={[s.small, { marginTop: 12 }]}>
                  In {item.inTime} Out {item.outTime || "—"}
                </Text>
              </View>
            ))
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              No attendance recorded
            </Text>
            <Text style={s.small}>
              Check in to record your first demo shift.
            </Text>
          </View>
        )}
      </View>
    </View>

  );
}
