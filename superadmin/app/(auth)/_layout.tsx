import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/core/auth/AuthContext';
import { homeForRole } from '../../src/core/permissions/roles';

export default function AuthLayout() {
  const { user } = useAuth();
  if (user) return <Redirect href={homeForRole(user.role)} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
