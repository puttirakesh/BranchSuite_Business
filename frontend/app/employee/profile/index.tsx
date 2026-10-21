import { Pressable, Text, View } from 'react-native';
import { Tile } from '../../../src/features/employee/components';
import { useEmployeeStyles } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function ProfileScreen() {
  const s = useEmployeeStyles();
  const { splitLayout, signOutEmployee, go, employeeName, employeeBranch, employeeId, employeeDepartment, employeeManager, employeeEmail, employeePhone, refreshProfile, profileLoading } = useEmployeeWorkspace();
  return (
    <View style={[s.columns, splitLayout && s.desktopColumns]}>
      <View style={[s.card, s.column]}>
        <View style={s.row}>
          <View style={[s.avatar, { width: 60, height: 60 }]}>
            <Text style={[s.avatarText, { fontSize: 22 }]}>
              {employeeName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={s.flex}>
            <Text style={s.sectionTitle}>{employeeName}</Text>
            <Text style={s.small}>
              {employeeDepartment} · {employeeBranch}
            </Text>
          </View>
        </View>
        <View style={s.divider} />
        {[
          ["Employee ID", employeeId],
          ["Work email", employeeEmail],
          ["Department", employeeDepartment],
          ["Manager", employeeManager],
          ["Phone", employeePhone],
        ].map(([label, value]) => (
          <View key={label} style={s.detail}>
            <Text style={s.small}>{label}</Text>
            <Text style={s.body}>{value}</Text>
          </View>
        ))}
        <Text style={s.small}>
          Ask your manager to update your employment details.
        </Text>
        <Pressable accessibilityRole="button" disabled={profileLoading} onPress={refreshProfile} style={s.secondary}><Text style={s.cardTitle}>Refresh profile</Text></Pressable>
      </View>
      <View style={s.column}>
        <Tile description="Apply and track requests"
          title="Leave & requests"
          symbol="♧"
          onPress={() => go("leave")}
        />
        <Tile description="Employment records"
          title="My documents"
          symbol="▤"
          onPress={() => go("documents")}
        />
        <Tile description="Request and track"
          title="Salary advances"
          symbol="▤"
          lavender
          onPress={() => go("advances")}
        />
        <Tile description="Using your workspace"
          title="Help"
          symbol="help"
          amber
          onPress={() => go("help")}
        />
        <Pressable
          accessibilityRole="button"
          onPress={signOutEmployee}
          style={({ pressed }) => [s.signOut, pressed && { opacity: 0.65 }]}
        >
          <Text style={s.cardTitle}>Sign out</Text>
        </Pressable>
        <Text style={[s.small, { textAlign: "center" }]}>
          Your attendance, payslips and assigned tasks stay linked to your employee account.
        </Text>
        <Text style={s.small}>
          Your profile, tasks, leave, attendance and advances are loaded from your account. Contact HR for employment documents.
        </Text>
      </View>
    </View>

  );
}
