import { AdminWorkspaceHeader } from "./AdminWorkspaceHeader";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import {
  FiUsers,
  FiUserPlus,
  FiCheckSquare,
  FiClock,
  FiCreditCard,
  FiBarChart2,
  FiTrendingUp,
  FiMoreHorizontal,
  FiUser,
} from "./FeatherIcons";
import { useAdminViewport } from "./useAdminViewport";
import { useAuth } from "../core/auth/AuthProvider";
import { useAdminScope } from "../core/admin/scope";
import { canOpenAdminPath } from '../core/admin/access';

const destinations = [
  {
    label: "Employees",
    href: "/admin/employees",
    icon: FiUsers,
    match: ["/admin/employees"],
  },
  {
    label: "Attendance",
    href: "/admin/attendance/team",
    icon: FiClock,
    match: ["/admin/attendance"],
  },
  {
    label: "Payroll",
    href: "/admin/payroll",
    icon: FiCreditCard,
    match: ["/admin/payroll"],
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: FiBarChart2,
    match: ["/admin/reports"],
  },
  {
    label: "Tasks",
    href: "/admin/tasks/follow-ups",
    icon: FiCheckSquare,
    match: ["/admin/tasks"],
  },
  {
    label: "Lead",
    href: "/admin/crm/lead-form",
    icon: FiUserPlus,
    match: ["/admin/crm/lead-form"],
  },
  {
    label: "CRM",
    href: "/admin/crm",
    icon: FiTrendingUp,
    match: ["/admin/crm"],
  },
  {
    label: "More",
    href: "/admin/more",
    icon: FiMoreHorizontal,
    match: [
      "/admin/more",
      "/admin/activity-audit",
      "/admin/branches",
      "/admin/roles-permissions",
      "/admin/profile",
      "/admin/salary",
      "/admin/subscription",
      "/admin/platform-support",
      "/admin/workspace-settings",
      "/admin/billing",
    ],
  },
] as const;

export function AdminWebShell({ children }: { children: React.ReactNode }) {
  const { desktop, sidebarWidth } = useAdminViewport();
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const scope = useAdminScope();
  const current = destinations.find((item) =>
    item.match.some((prefix) => pathname.startsWith(prefix)),
  );
  return (
    <View style={styles.shell}>
      {desktop && (
        <View
          accessibilityLabel="Admin navigation"
          style={[styles.sidebar, { width: sidebarWidth }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="BranchSuite dashboard"
            onPress={() => router.push("/admin/dashboard")}
            style={styles.brand}
          >
            <View style={styles.brandIcon}>
              <FiUser size={21} color="#fff" />
            </View>
            <View>
              <Text style={styles.brandTitle}>BranchSuite</Text>
              <Text style={styles.muted}>Admin</Text>
            </View>
          </Pressable>
          <Text style={styles.workspaceLabel}>ADMIN WORKSPACE</Text>
          <ScrollView
            style={styles.menu}
            contentContainerStyle={styles.menuContent}
          >
            {destinations.filter(item => canOpenAdminPath(session, scope?.companyId, item.href)).map((item) => {
              const selected = current?.label === item.label;
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onPress={() => router.push(item.href)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuHover,
                    selected && styles.menuSelected,
                  ]}
                >
                  <item.icon
                    size={18}
                    color={selected ? "#007f75" : "#6a7e89"}
                  />
                  <Text
                    style={[
                      styles.menuText,
                      selected && styles.menuSelectedText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.account}>
            <View style={styles.accountIcon}>
              <FiUser size={18} color="#007f75" />
            </View>
            <View style={styles.accountDetails}>
              <Text numberOfLines={1} style={styles.accountTitle}>
                {session?.user.name || "Admin workspace"}
              </Text>
              <Text numberOfLines={1} style={styles.muted}>
                {scope?.companyName || "Business management"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={() => {
                void signOut().then(() => router.replace("/auth/login"));
              }}
              style={({ pressed }) => [
                styles.signOut,
                pressed && styles.menuHover,
              ]}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      )}
      <View style={styles.workspace}>
        <AdminWorkspaceHeader />
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    backgroundColor: "#f3f9f8",
  },
  sidebar: {
    flexShrink: 0,
    paddingTop: 30,
    backgroundColor: "#fbfdfd",
    borderRightWidth: 1,
    borderRightColor: "#dce7e6",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#007f75",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { fontSize: 17, fontWeight: "600", color: "#152b3c" },
  muted: { fontSize: 12, lineHeight: 18, color: "#6a7e89", marginTop: 2 },
  workspaceLabel: {
    marginTop: 36,
    marginBottom: 18,
    paddingHorizontal: 22,
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#6a7e89",
  },
  menu: { flex: 1, minHeight: 0 },
  menuContent: { paddingHorizontal: 22, gap: 8, paddingBottom: 20 },
  menuItem: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  menuHover: { backgroundColor: "#edf5f3" },
  menuSelected: { backgroundColor: "#e0f3ed", borderLeftColor: "#6bb7a9" },
  menuText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: "#4d6372" },
  menuSelectedText: { color: "#007f75", fontWeight: "600" },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 22,
    borderTopWidth: 1,
    borderTopColor: "#eef3f2",
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#d5f1ec",
    alignItems: "center",
    justifyContent: "center",
  },
  accountInitial: { fontSize: 18, fontWeight: "800", color: "#007f75" },
  accountTitle: { color: "#152b3c", fontSize: 13, fontWeight: "500" },
  accountDetails: { flex: 1, minWidth: 0 },
  signOut: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  signOutText: { fontSize: 12, fontWeight: "700", color: "#b4413b" },
  workspace: { flex: 1, minWidth: 0, minHeight: 0 },
  topbar: {
    height: 72,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#dce7e6",
  },
  topbarTitle: { flex: 1, minWidth: 0 },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#f5f8fa",
    alignItems: "center",
    justifyContent: "center",
  },
  screen: { flex: 1, minWidth: 0, minHeight: 0 },
  searchOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(21,43,60,0.25)",
  },
  searchDialog: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "80%",
    padding: 24,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  searchHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    minHeight: 46,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#dce7e6",
    borderRadius: 12,
    marginBottom: 12,
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 48,
    padding: 12,
  },
  noResults: { padding: 12, fontSize: 13, color: "#6a7e89" },
});
