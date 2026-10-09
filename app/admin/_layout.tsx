import { Stack } from 'expo-router';
import { AdminWebShell } from '../../src/ui/AdminWebShell';

export default function AdminLayout() {
  return <AdminWebShell><Stack screenOptions={{ headerShown: false }} /></AdminWebShell>;
}
