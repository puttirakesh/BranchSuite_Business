import { Text, View } from 'react-native';
import { employee } from '../../../src/features/employee/data';
import { s } from '../../../src/features/employee/styles';

export default function HelpScreen() {
  return (
    <View style={s.column}>
      {[
        ["Attendance", "Check in and out from My work. Review your shifts in Attendance."],
        ["Tasks", "Open an assigned task to add progress notes or mark it completed."],
        ["Leave & requests", "Apply for leave from Profile and track your request status."],
        ["Payroll and documents", "View published payslips in Payroll and employment records in My documents."],
        ["Salary advances", "Create a sample advance request and review its history on this device."],
        ["Need help?", `Contact your manager, ${employee.manager}, about employment details or payroll. This sample workspace saves records locally and does not send requests to a manager.`],
      ].map(([heading, text]) => (
        <View key={heading} style={[s.card, { gap: 8 }]}><Text style={s.cardTitle}>{heading}</Text><Text style={s.body}>{text}</Text></View>
      ))}
    </View>

  );
}
