import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { AdminWorkspaceHeader } from './AdminWorkspaceHeader';
import { WorkspaceNavigation, WorkspaceNavigationDrawer } from './WorkspaceNavigation';
import { getAdminSidebarDestinations } from './workspace-navigation';
import { useAdminViewport } from './useAdminViewport';
import { useAuth } from '../core/auth/AuthProvider';
import { useAdminScope } from '../core/admin/scope';
import { colors } from '../shared/theme/colors';
import { NeutralInputContext } from './InputInteractionContext';

export function AdminWebShell({ children }: { children: React.ReactNode }) {
  const { desktop, webNavigation, persistentSidebar, sidebarWidth, sidebarCollapsed, toggleSidebar, insets } = useAdminViewport();
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const scope = useAdminScope();
  const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(() => setNavigationOpen(false), [pathname, persistentSidebar, webNavigation]);
  const items = getAdminSidebarDestinations(session, scope?.companyId);
  const navigationProps = {
    workspace: 'Admin', items, pathname,
    userName: session?.user.name || 'Admin', companyName: scope?.companyName || 'Business workspace',
    onSignOut: async () => { await signOut(); router.replace('/auth/login'); },
  };
  return <NeutralInputContext.Provider value={true}><View nativeID="admin-workspace" style={s.shell}>
    {persistentSidebar && <View testID="desktop-sidebar" style={{ width: sidebarWidth, minHeight: 0, flexShrink: 0, zIndex: 40 }}><WorkspaceNavigation {...navigationProps} collapsed={sidebarCollapsed} onToggle={toggleSidebar} /></View>}
    <View style={s.workspace}>
      <View style={Platform.OS !== 'web' ? { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: colors.surface } : undefined}>
        <AdminWorkspaceHeader onOpenNavigation={webNavigation && !persistentSidebar ? () => setNavigationOpen(true) : undefined} />
      </View>
      <View testID="admin-page-content" style={[s.screen, { paddingTop: Platform.OS === 'web' ? 0 : desktop ? 24 : 16 }]}>{children}</View>
    </View>
    <WorkspaceNavigationDrawer {...navigationProps} open={navigationOpen && webNavigation && !persistentSidebar} onClose={() => setNavigationOpen(false)} onNavigate={() => setNavigationOpen(false)} />
  </View></NeutralInputContext.Provider>;
}

const s = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'row', backgroundColor: Platform.OS === 'web' ? '#F5F7FB' : colors.background },
  workspace: { flex: 1, minWidth: 0, minHeight: 0 }, screen: { flex: 1, minWidth: 0, minHeight: 0 },
});
