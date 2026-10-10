import { Pressable, Text, View } from 'react-native';
import { employee } from '../../../src/features/employee/data';
import { Tile } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function ProfileScreen() {
  const { splitLayout, setSignedOut, setMessage, setDialog, go } = useEmployeeWorkspace();
  return (
    <View style={[s.columns, splitLayout && s.desktopColumns]}>
      <View style={[s.card, s.column]}>
        <View style={s.row}>
          <View style={[s.avatar, { width: 60, height: 60 }]}>
            <Text style={[s.avatarText, { fontSize: 22 }]}>
              AR
            </Text>
          </View>
          <View style={s.flex}>
            <Text style={s.sectionTitle}>{employee.name}</Text>
            <Text style={s.small}>
              {employee.department} · {employee.branch}
            </Text>
          </View>
        </View>
        <View style={s.divider} />
        {[
          ["Employee ID", employee.id],
          ["Work email", employee.email],
          ["Department", employee.department],
          ["Manager", employee.manager],
          ["Phone", employee.phone],
        ].map(([label, value]) => (
          <View key={label} style={s.detail}>
            <Text style={s.small}>{label}</Text>
            <Text style={s.body}>{value}</Text>
          </View>
        ))}
        <Text style={s.small}>
          Ask your manager to update your employment details.
        </Text>
      </View>
      <View style={s.column}>
        <Tile
          title="Leave & requests"
          description="Apply and track requests"
          symbol="♧"
          onPress={() => go("leave")}
        />
        <Tile
          title="My documents"
          description="Employment records"
          symbol="▤"
          onPress={() => go("documents")}
        />
        <Tile
          title="Salary advances"
          description="Request and track"
          symbol="▤"
          lavender
          onPress={() => go("advances")}
        />
        <Tile
          title="Help"
          description="Using your workspace"
          symbol="help"
          amber
          onPress={() => go("help")}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => { setDialog(null); setMessage(""); setSignedOut(true); }}
          style={({ pressed }) => [s.signOut, pressed && { opacity: 0.65 }]}
        >
          <Text style={s.cardTitle}>Sign out</Text>
        </Pressable>
        <Text style={[s.small, { textAlign: "center" }]}>
          Your attendance, payslips and assigned tasks stay linked to your employee account.
        </Text>
        <Text style={s.small}>
          This offline workspace uses fictional APK sample data. A
          backend is needed to connect employee and manager
          accounts across devices.
        </Text>
      </View>
    </View>

  );
}
