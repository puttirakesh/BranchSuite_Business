import React from 'react';
import { View } from 'react-native';
import EmployeeTaskDetailsScreen from '../../employee/tasks/[id]';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';

export default function MyTaskDetailsPage() {
  return <View style={{ flex: 1, minHeight: 0 }}>
    <EmployeeTaskDetailsScreen backRoute="/admin/my-tasks" />
    <AdminBottomNavigation />
  </View>;
}
