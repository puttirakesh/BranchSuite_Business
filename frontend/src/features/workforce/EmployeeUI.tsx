import { Pressable, StyleSheet, Text, View } from 'react-native';
import { employeeInitials, employeeSteps } from './employeeFlow';
import { label } from './resources';
import { WorkforceRecord } from './types';
import { styles } from './ui';

export function EmployeeAvatar({ name, large = false }: { name: string; large?: boolean }) {
  return <View style={[employeeStyles.avatar, large && employeeStyles.largeAvatar]} accessible={false}>
    <Text style={[employeeStyles.initials, large && { fontSize: 22 }]}>{employeeInitials(name)}</Text>
  </View>;
}
export function EmployeeStatus({ status }: { status: string }) {
  return <Text style={[styles.badge, status === 'INACTIVE' && employeeStyles.inactive]}>{label(status)}</Text>;
}
export function EmployeeCard({ employee, branchName, onPress }: { employee: WorkforceRecord; branchName: string; onPress: () => void }) {
  const name = String(employee.name || 'Employee');
  return <Pressable style={[styles.card, employeeStyles.personCard]} accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={onPress}>
    <View style={employeeStyles.personRow}>
      <EmployeeAvatar name={name} />
      <View style={employeeStyles.personText}><Text style={styles.title}>{name}</Text><Text style={employeeStyles.small}>{String(employee.department || employee.jobTitle || 'Employee')}</Text></View>
      <Text style={employeeStyles.chevron} accessible={false}>›</Text>
    </View>
    <View style={[styles.row, !branchName && { justifyContent: 'flex-end' }]}>{!!branchName && <Text style={[employeeStyles.small, { flexShrink: 1 }]}>{branchName}</Text>}{employee.status && <EmployeeStatus status={String(employee.status)} />}</View>
    <View style={employeeStyles.cardFoot}><Text style={employeeStyles.small}>{String(employee.email || 'No work email')}</Text></View>
  </Pressable>;
}
export function EmployeeStepper({ current }: { current: number }) {
  return <View style={employeeStyles.stepper} accessibilityLabel={`Step ${current + 1} of 3: ${employeeSteps[current].title}`}>
    {employeeSteps.map((step, index) => <View key={step.title} style={employeeStyles.step}>
      <View style={[employeeStyles.stepNumber, index <= current && employeeStyles.activeStep]}>
        <Text style={[employeeStyles.small, index <= current && { color: '#FFFFFF' }]}>{index < current ? '✓' : index + 1}</Text>
      </View>
      <Text style={[employeeStyles.small, index === current && { color: '#087F76', fontWeight: '700' }]}>{step.title}</Text>
    </View>)}
  </View>;
}
export const employeeStyles = StyleSheet.create({
  personCard: { borderRadius: 24, padding: 24, paddingBottom: 0, gap: 26, borderColor: '#E3EAF5', overflow: 'hidden' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personText: { flex: 1, gap: 3 },
  avatar: { width: 58, height: 58, borderRadius: 20, borderWidth: 3, borderColor: '#F4F7FF', backgroundColor: '#E8EFFF', alignItems: 'center', justifyContent: 'center' },
  largeAvatar: { width: 64, height: 64, borderRadius: 19 },
  initials: { color: '#395CB2', fontSize: 15, fontWeight: '700' },
  small: { color: '#5C6E84', fontSize: 13, lineHeight: 20 },
  chevron: { fontSize: 26, color: '#5C6E84' },
  inactive: { color: '#5C6E84', backgroundColor: '#EEF1F6' },
  cardFoot: { borderTopWidth: 1, borderTopColor: '#EDF1F6', padding: 16, marginHorizontal: -24, backgroundColor: '#F8FAFE' },
  summary: { backgroundColor: '#EAF2FF', borderRadius: 14, padding: 14 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E7F0', alignItems: 'center', justifyContent: 'center' },
  activeStep: { backgroundColor: '#087F76' },
});
