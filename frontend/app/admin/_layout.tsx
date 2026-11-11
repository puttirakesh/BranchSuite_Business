import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '../../src/core/auth/AuthProvider';
import { AdminWebShell } from '../../src/ui/AdminWebShell';
import { canOpenAdminPath } from '../../src/core/admin/access';
import { useAdminScope } from '../../src/core/admin/scope';
import { AdminUnavailablePage } from '../../src/ui/AdminUnavailablePage';
import { usePageTransitions } from '../../src/ui/usePageTransitions';
import { AdminBottomNavigationProvider } from '../../src/ui/AdminBottomNavigation';
import { BILLING_ROUTE, subscriptionAccess } from '../../src/features/subscriptions/access';

const mainTabScreens = new Set(['dashboard/index', 'crm/index', 'employees/people', 'payroll/index', 'more/index']);

export default function AdminLayout() {
  const screenOptions = usePageTransitions();
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const isEmployeeOnly = !!session && session.memberships.length > 0 &&
    session.memberships.every(membership => membership.role === 'EMPLOYEE');
  // Do not load the workspace scope (it calls /branches/available) until the
  // subscription is confirmed active; otherwise a pending owner gets a 403.
  const subscribed = !!session && subscriptionAccess(session).kind === 'allowed';
  const scope = useAdminScope(!!session && !loading && !isEmployeeOnly && subscribed);
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  if (!session) return <Redirect href="/auth/login" />;
  // Deep links, browser refresh and restored sessions all pass through here.
  if (!subscribed) return <Redirect href={BILLING_ROUTE} />;
  // Employee-only accounts use the employee workspace (mirrors app/index.tsx).
  if (isEmployeeOnly) return <Redirect href="/employee" />;
  return <AdminWebShell><AdminBottomNavigationProvider>{canOpenAdminPath(session, scope?.companyId, pathname) ? <Stack screenOptions={({ route }) => ({ ...screenOptions, freezeOnBlur: true, animation: mainTabScreens.has(route.name) ? 'none' : screenOptions.animation })} /> : <AdminUnavailablePage title="Access required" message="This module is not included in your account permissions. Contact your business administrator if you need access." />}</AdminBottomNavigationProvider></AdminWebShell>;
}
