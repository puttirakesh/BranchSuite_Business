import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { useToastState } from '../../../src/ui/useToastState';
import { AdminPageHeading, useWebSectionHeader } from '../../../src/ui/AdminPageHeading';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { useAvailableBranches } from "../../../src/core/admin/available-branches";
import { BranchOptionsStatus } from "../../../src/ui/BranchOptionsStatus";
import { Dropdown } from "../../../src/ui/Dropdown";
import { AppIcon } from "../../../src/ui/AppIcon";
import { DesktopEyebrow } from '../../../src/ui/DesktopEyebrow';
import { CompanyName, selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import { AccessUserDialog } from '../../../src/ui/AccessUserDialog';
import { readAccessUsers, saveAccessUsers, type AccessRole, type AccessUser } from '../../../src/core/admin/organisation';
import { useAuth } from '../../../src/core/auth/AuthProvider';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ToastModal as Modal } from '../../../src/ui/Toast';
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";

const permissions: Record<AccessRole, string[]> = {
  "Business Owner": ["Manage the business, administrators, users and all company modules"],
  "Business Admin": [
    "Manage company branches",
    "Manage users, roles and branch access",
    "Manage CRM and people",
    "Prepare and publish payroll; managers approve independently",
    "View company reports and activity audit",
  ],
  "Company Manager": [
    "Review people and manage CRM in assigned company branches",
    "Review and approve payroll; approve leave and attendance requests",
    "View reports for assigned branches",
  ],
  "Branch Manager": ["Review team, manage CRM and tasks in assigned branches", "Approve branch payroll, leave and attendance requests"],
  "Sales Manager": [
    "Manage CRM records for assigned branches",
    "Work with leads, customers, opportunities and sales follow-ups",
    "View the assigned-branch sales pipeline",
  ],
  "HR Manager": [
    "Manage employees",
    "Manage attendance and leave",
    "View people reports for assigned branches",
  ],
  Employee: [
    "Personal workspace: attendance, leave and payslips",
    "Assigned tasks",
  ],
  "Payroll Officer": [
    "Prepare payroll for assigned branches",
    "Manage payroll inputs",
    "View payroll reports",
  ],
};
const roles = Object.keys(permissions) as AccessRole[];

export default function RolesPermissionsPage() {
  const webHeader = useWebSectionHeader();
  const { session } = useAuth();
  const scope = useAdminScope();
  const owner = session?.memberships.some(item => item.companyId === scope?.companyId && (item.roles ?? [item.role]).includes('BUSINESS_OWNER'));
  const assignableRoles = roles.filter(role => role !== 'Business Owner' && (owner || role !== 'Business Admin'));
  const canEdit = (user: AccessUser) => user.id !== session?.user.id && user.role !== 'Business Owner' && (owner || user.role !== 'Business Admin');
  const router = useRouter();
  const { userId: requestedUserId } = useLocalSearchParams<{ userId?: string }>();
  const openedRequestedUser = useRef<string | null>(null);
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const { branches: availableBranches, loading: branchesLoading, error: branchesError, refresh: refreshBranches } = useAvailableBranches();
  const branches = availableBranches.map(item => item.id);
  const branchOptions = [{ id: '', name: 'All branches' }, ...availableBranches];
  const branchName = (id: string) => availableBranches.find(item => item.id === id)?.name ?? id;
  const branchDropdownOptions = branchOptions.map(option => ({ value: option.id, label: option.name }));
  const [branch, setBranch] = useState(scope?.branchId ?? "");
  useEffect(() => setBranch(scope?.branchId ?? ''), [scope?.companyId, scope?.branchId]);
  const [permissionUser, setPermissionUser] = useState<AccessUser | null>(null);
  const [draft, setDraft] = useState<AccessUser | null>(null);
  const privilegedDraft = users.find(user => user.id === draft?.id)?.role === 'Business Admin';
  const [error, setError] = useToastState("", 'error');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useToastState('', 'success');
  const [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    setLoaded(false);
    setError('');
    readAccessUsers()
      .then(records => { if (mounted) { setUsers(records); setLoaded(true); } })
      .catch(cause => { if (mounted) setError(cause instanceof Error ? cause.message : 'Could not load users from this workspace.'); })
      .finally(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, [reload, scope?.companyId]));
  useEffect(() => {
    if (!loaded || !requestedUserId || openedRequestedUser.current === requestedUserId) return;
    const user = users.find(item => item.id === requestedUserId);
    if (!user) return;
    openedRequestedUser.current = requestedUserId;
    if (!canEdit(user)) {
      setError('This account cannot be changed from your current access level.');
      return;
    }
    setError('');
    setDraft({ ...user, branches: [...user.branches] });
  }, [loaded, requestedUserId, users, session?.user.id, owner]);
  const chooseBranch = (id: string) => {
    void selectAdminBranch(id || null).then(() => setBranch(id)).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not change branch.'));
  };
  const close = () => {
    if (!saving) {
      setPermissionUser(null);
      setDraft(null);
      if (loaded) setError("");
    }
  };
  const save = async (candidate: AccessUser) => {
    if (!loaded || saving) return;
    const user = {
      ...candidate,
      name: candidate.name.trim(),
      email: candidate.email.trim().toLowerCase(),
    };
    if (!user.id || !user.hasEmployeeProfile) {
      setError('Create this person through Employee onboarding before assigning business access.');
      return;
    }
    if (!user.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      setError("Enter a name and a valid email.");
      return;
    }
    if (
      users.some(
        (item) =>
          item.id !== user.id && item.email.toLowerCase() === user.email,
      )
    ) {
      setError("A user with this email already exists.");
      return;
    }
    const next = users.map((item) => (item.id === user.id ? user : item));
    setSaving(true);
    try {
      await saveAccessUsers(next);
      setUsers(await readAccessUsers());
      setDraft(null);
      setError("");
      setNotice(`Access updated for ${user.name}.`);
    } catch (cause) {
      try {
        const refreshed = await readAccessUsers();
        setUsers(refreshed);
        const persisted = refreshed.find(item => item.email.toLowerCase() === user.email);
        setDraft(persisted ? { ...user, id: persisted.id } : user);
      } catch { setLoaded(false); setDraft(null); }
      setError(
        cause instanceof Error
          ? cause.message
          : "Access could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const visibleUsers = users.filter(user =>
    !branch || user.branches.includes(branch) || !user.branches.length,
  );
  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>

      {draft ? <AccessUserDialog
        draft={draft} users={users} roles={assignableRoles}
        branches={availableBranches} branchesLoading={branchesLoading} branchesError={branchesError} refreshBranches={refreshBranches}
        accessLocked={privilegedDraft} saving={saving} error={error}
        onChange={changes => { setDraft(current => current ? { ...current, ...changes } : null); setError(''); }}
        onClose={close} onSave={save} onManageBranches={() => { close(); router.push('/admin/branches'); }}
      /> : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <AdminPageHeading title="Roles & access" onBack={() => router.canGoBack() ? router.back() : router.replace('/admin/more')} style={{ marginBottom: 16 }} branch={{ value: branch ? branchName(branch) : "All branches", label: "Choose workspace branch", onPress: () => {} }} branchControl={<Dropdown valueOnly label="Branch" placeholder="Select a branch" value={branch} options={branchDropdownOptions} onChange={chooseBranch} style={{ width: 180 }} />} onRefresh={() => setReload(value => value + 1)} refreshing={!loaded}><Pressable
            accessibilityRole="button"
            disabled={!loaded}
            onPress={() => {
              router.push({ pathname: '/admin/employees/create', params: branch ? { branchId: branch } : {} });
            }}
            style={[styles.addButton, !loaded && styles.dim]}
          >
            <Text style={styles.addButtonText}>Add Employee</Text>
          </Pressable></AdminPageHeading>
          {!webHeader && <View accessibilityLabel="Page filters" style={styles.pageFilters}>
              <Dropdown valueOnly label="Branch" placeholder="Select a branch" value={branch} options={branchDropdownOptions} onChange={chooseBranch} />
              <BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={!branches.length} onRetry={refreshBranches} />
          </View>}

          {!!notice && !draft && <View style={styles.notice}><AppIcon name="check-circle" size={18} color="#16856c" /><Text accessibilityLiveRegion="polite" style={styles.noticeText}>{notice}</Text></View>}
          {error && !draft ? (
            <View>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => setReload(value => value + 1)} style={styles.secondary}>
                <Text style={styles.link}>Reload users</Text>
              </Pressable>
            </View>
          ) : null}
          {!loaded && !error ? <Text style={styles.subtitle}>Loading users…</Text> : null}
          <View style={styles.cards}>
            {visibleUsers
              .map((user) => (
                <View
                  key={user.id}
                  style={[styles.card, desktop && styles.desktopCard]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {user.name
                          .split(/\s+/)
                          .map((word) => word[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>{user.name}</Text>
                      <Text style={styles.caption}>{user.email}</Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        !user.active && styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          !user.active && styles.muted,
                        ]}
                      >
                        {user.active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user.role}</Text>
                  </View>
                  <Text style={styles.branchText}>
                    {user.branches.map(branchName).join(" · ") || 'No branch access'}
                  </Text>
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Permissions for ${user.name}`}
                      onPress={() => setPermissionUser(user)}
                      style={[styles.secondary, styles.flex]}
                    >
                      <Text style={styles.buttonText}>Permissions</Text>
                    </Pressable>
                    {canEdit(user) && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit access for ${user.name}`}
                        disabled={!loaded}
                        onPress={() => {
                          setError("");
                          setDraft({ ...user, branches: [...user.branches] });
                        }}
                        style={[
                          styles.secondary,
                          styles.selectedFilter,
                          styles.flex,
                          !loaded && styles.dim,
                        ]}
                      >
                        <Text style={styles.link}>Edit access</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
          </View>
          {loaded && !visibleUsers.length && <Text style={styles.subtitle}>No onboarded employee with a starting salary is available in this branch yet. Use Employee onboarding first, then return here to assign a business role.</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/admin/branches")}
            style={styles.secondary}
          >
            <Text style={styles.buttonText}>Manage company branches</Text>
          </Pressable>

        </ScrollView>
        )}
        <AdminBottomNavigation disabled={saving} />
      </View>
      <Modal
        transparent
        visible={!!permissionUser}
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, styles.flex]}>
                Permissions
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close access dialog"
                disabled={saving}
                onPress={close}
                style={styles.change}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {permissionUser ? (
                <View style={styles.form}>
                  <Text style={styles.cardTitle}>{permissionUser.name}</Text>
                  <Text style={styles.branchText}>
                    {permissionUser.role} · <CompanyName />
                  </Text>
                  {permissions[permissionUser.role].map((permission) => (
                    <Text key={permission} style={styles.permission}>
                      ✓ {permission}
                    </Text>
                  ))}
                  <Text style={styles.subtitle}>Applies to: {permissionUser.branches.map(branchName).join(', ') || 'No branch access'}. The role determines their permissions. Use Edit access to change their role, branches or account status.</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center" },
  flex: { flex: 1, minWidth: 0 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  companyName: { fontSize: 13, fontWeight: "800", color: "#20334f" },
  muted: { color: "#71829c" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "800", color: "#345cf2" },
  pageFilters: { width: '100%', marginVertical: 12 },
  headerFilters: { flexDirection: "row", gap: 8, marginTop: 14 },
  headerFilter: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 8,
    backgroundColor: "#f7f9ff",
  },
  filterText: {
    fontSize: 10,
    color: "#20334f",
    fontWeight: "600",
    flexShrink: 1,
  },
  selectedFilter: { backgroundColor: "#eaf0ff", borderColor: "#d5dfff" },
  addButton: { minHeight: 40, paddingHorizontal: 13, backgroundColor: "#345cf2", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addButtonText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  content: { padding: 16, paddingTop: 20, paddingBottom: 28, gap: 12 },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 8,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  eyebrow: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#71829c",
  },
  title: { minWidth: 0, flexShrink: 1, fontSize: 20, lineHeight: 26, fontWeight: "700", color: "#20334f", marginTop: 0 },
  subtitle: { fontSize: 11, lineHeight: 18, color: "#71829c", marginTop: 4 },
  notice: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: "#eaf0ff",
    padding: 14,
    borderRadius: 12,
  },
  info: { color: "#405f9d", fontSize: 16 },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 16, color: "#405f9d" },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "100%",
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 18,
  },
  desktopCard: { width: "48%", flexGrow: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    color: "#20334f",
  },
  caption: { fontSize: 10, lineHeight: 16, color: "#71829c", marginTop: 4 },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: "#dff3ea",
  },
  statusText: { fontSize: 9, fontWeight: "700", color: "#08765c" },
  inactiveBadge: { backgroundColor: "#edf0f5" },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#eee7ff",
    marginTop: 12,
  },
  roleText: { fontSize: 9, fontWeight: "600", color: "#6541cd" },
  branchText: { fontSize: 11, lineHeight: 18, color: "#71829c", marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  secondary: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 12, fontWeight: "600", color: "#405573" },
  link: { fontSize: 11, fontWeight: "700", color: "#345cf2" },
  createButton: { marginTop: 12 },
  footer: {
    fontSize: 9,
    lineHeight: 16,
    color: "#8192ad",
    textAlign: "center",
    marginTop: 20,
  },
  overlay: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21,43,60,0.25)",
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#20334f" },
  change: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  form: { gap: formSpacing.field, marginTop: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
    marginBottom: 4,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#20334f",
    backgroundColor: "#fff",
  },
  permission: {
    fontSize: 14,
    lineHeight: 22,
    color: "#405573",
    paddingVertical: 6,
  },
  primary: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#345cf2",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  error: { fontSize: 13, lineHeight: 20, color: "#b94d61" },
  dim: { opacity: 0.6 },
});
