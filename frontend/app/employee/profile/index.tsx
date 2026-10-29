import { EmployeePageHeading } from '../../../src/features/employee/EmployeePageHeading';
import { Pressable, Text, View } from 'react-native';
import { RefreshButton, Tile } from '../../../src/features/employee/components';
import { useEmployeeStyles } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';
import { AppIcon } from '../../../src/ui/AppIcon';

export default function ProfileScreen() {
  const s = useEmployeeStyles();
  const { splitLayout, signOutEmployee, go, employeeName, employeeBranch, employeeId, employeeDepartment, employeeManager, employeeEmail, employeePhone, refreshProfile, profileLoading } = useEmployeeWorkspace();
  return (
    <>
      <EmployeePageHeading title="My profile" backTo={null}><RefreshButton label="Refresh profile" onPress={refreshProfile} loading={profileLoading} /></EmployeePageHeading>
      <View style={[s.columns, splitLayout && s.desktopColumns]}>
      <View style={[s.card, s.column, !splitLayout && s.stackedColumn]}>
        <Text style={s.cardTitle}>Personal details</Text>
        <View style={s.row}>
          <View style={[s.avatar, { width: 48, height: 48 }]}>
            <Text style={[s.avatarText, { fontSize: 18 }]}>
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
        <View style={s.profileDetails}>
        {[
          ["Employee ID", employeeId],
          ["Work email", employeeEmail],
          ["Department", employeeDepartment],
          ["Manager", employeeManager],
          ["Phone", employeePhone],
        ].map(([label, value]) => (
          <View key={label} style={[s.profileDetail, label === 'Work email' && s.profileDetailFull]}>
            <Text style={s.small}>{label}</Text>
            <Text selectable style={s.body}>{value || 'Not provided'}</Text>
          </View>
        ))}
        </View>
        <Text style={s.small}>
          Ask your manager to update your employment details.
        </Text>
      </View>
      <View style={[s.column, !splitLayout && s.stackedColumn]}>
        <Text style={s.cardTitle}>Quick links</Text>
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
          <AppIcon name="log-out" size={18} color="#B42318" />
          <Text style={[s.cardTitle, { color: '#B42318' }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
    </>

  );
}
