import { Redirect } from 'expo-router';
import { useAuth } from '../src/core/auth/AuthContext';
import { homeForRole } from '../src/core/permissions/roles';

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? homeForRole(user.role) : '/(auth)/login'} />;
}
