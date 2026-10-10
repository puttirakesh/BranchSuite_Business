import { Text, View } from 'react-native';
import { money } from '../../../src/features/employee/data';
import { Button, Tile } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function PayslipsScreen() {
  const { splitLayout, setDialog } = useEmployeeWorkspace();
  return (
    <View style={[s.columns, splitLayout && s.desktopColumns]}>
      <View style={s.column}>
        <View
          style={[
            s.card,
            { backgroundColor: "#EFE9FA", padding: 26 },
          ]}
        >
          <Text style={s.eyebrow}>LATEST PUBLISHED PAY</Text>
          <Text style={[s.sectionTitle, { marginTop: 12 }]}>
            September 2026
          </Text>
          <Text style={s.payValue}>{money(42200)}</Text>
          <Text style={s.subtitle}>Take-home pay · Paid</Text>
          <Button
            label="View payslip"
            onPress={() => setDialog("payslip")}
          />
        </View>
        <Text style={s.small}>
          Only published payroll is visible here. Salary settings
          and draft payroll do not count as paid salary.
        </Text>
      </View>
      <View style={s.column}>
        <Text style={s.sectionTitle}>Payslip history</Text>
        <Tile
          title="September 2026"
          description="₹42,200 take-home · Paid"
          symbol="▤"
          onPress={() => setDialog("payslip")}
        />
      </View>
    </View>

  );
}
