import { Redirect, Slot } from 'expo-router';
import { useAuth } from '../../src/core/auth/AuthContext';

/** The APK owns the shared sidebar, top bar and mobile navigation. */
export default function AdminLayout() {
  const { account, ready } = useAuth();
  if (!ready) return null;
  if (!account) return <Redirect href="/(auth)/login" />;
  if (account.role !== 'Platform Admin') return <Redirect href="/(support)/dashboard" />;
  return <Slot />;
}

