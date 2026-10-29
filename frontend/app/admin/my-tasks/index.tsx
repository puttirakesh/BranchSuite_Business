import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TasksScreen from '../../employee/tasks';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { useAdminScope } from '../../../src/core/admin/scope';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

export default function MyTasksPage() {
  const scope = useAdminScope();
  const { styles } = useAdminLayout(baseStyles, 'list');
  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AdminPageHeading title="My tasks" />
      <View style={styles.tasks}><TasksScreen detailRoute="/admin/my-tasks/[id]" companyId={scope?.companyId} /></View>
    </ScrollView>
    <AdminBottomNavigation />
  </SafeAreaView>;
}
const baseStyles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' },
  content: { padding: 20, paddingBottom: 36 }, tasks: { minWidth: 0, gap: 16 },
});
