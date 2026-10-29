
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '../../../src/core/auth/AuthContext';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && user?.role !== 'PLATFORM_ADMIN') {
      router.replace('/(auth)/login');
    }
  }, [loading, user, router]);

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await logout();
    } catch {
      // AuthContext clears local credentials even if
      // the backend logout request fails.
    } finally {
      router.replace('/(auth)/login');
      setLoggingOut(false);
    }
  }

  if (loading || user?.role !== 'PLATFORM_ADMIN') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6950C8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          BranchSuite SuperAdmin
        </Text>

        <Text style={styles.subtitle}>
          Dashboard setup successful
        </Text>

        <Text style={styles.welcome}>
          Welcome, {user.name}
        </Text>

        <Text style={styles.role}>
          Role: {user.role}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleLogout}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          {loggingOut ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.logoutText}>
              Log Out
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E7F1',
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#6950C8',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#52637A',
    marginTop: 10,
    textAlign: 'center',
  },
  welcome: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 26,
  },
  role: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: '#DC3545',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
    marginTop: 30,
    minWidth: 160,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
