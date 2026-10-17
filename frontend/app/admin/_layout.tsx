import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '../../src/core/auth/AuthProvider';
import { AdminWebShell } from '../../src/ui/AdminWebShell';
import { canOpenAdminPath } from '../../src/core/admin/access';
import { useAdminScope } from '../../src/core/admin/scope';
import { AdminUnavailablePage } from '../../src/ui/AdminUnavailablePage';

export default function AdminLayout() {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const scope = useAdminScope(!!session && !loading);
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  if (!session) return <Redirect href="/auth/login" />;
  // Employee-only accounts use the employee workspace (mirrors app/index.tsx).
  if (session.memberships.every(membership => membership.role === 'EMPLOYEE')) return <Redirect href="/employee" />;
  return <AdminWebShell>{canOpenAdminPath(session, scope?.companyId, pathname) ? <Stack screenOptions={{ headerShown: false }} /> : <AdminUnavailablePage title="Access required" message="This module is not included in your account permissions. Contact your business administrator if you need access." />}</AdminWebShell>;
}
