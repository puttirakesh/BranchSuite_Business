import { useAvailableBranches } from "../../../src/core/admin/available-branches";
import { BranchOptionsStatus } from "../../../src/ui/BranchOptionsStatus";
import { AppIcon } from "../../../src/ui/AppIcon";
import { CompanyName } from "../../../src/core/admin/scope";
import React, { useCallback, useEffect, useState } from "react";
import AsyncStorage from "../../../src/core/admin/storage";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";

const permissions = {
  "Business Admin": [
    "Manage company branches",
    "Manage users, roles and branch access",
    "Manage CRM and people",
    "Prepare and approve payroll",
    "View company reports and activity audit",
  ],
  "Company Manager": [
    "Manage assigned branches",
    "Manage CRM and people",
    "Review payroll",
    "View reports for assigned branches",
  ],
  "HR Manager": [
    "Manage employees",
    "Manage attendance and leave",
    "View people reports for assigned branches",
  ],
  Employee: [
    "Personal workspace: attendance, leave and payslips",
    "Assigned CRM tasks",
  ],
  "Payroll Officer": [
    "Prepare payroll for assigned branches",
    "Manage payroll inputs",
    "View payroll reports",
  ],
} as const;
type Role = keyof typeof permissions;
type AccessUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  branches: string[];
  active: boolean;
};

const initialUsers: AccessUser[] = [];
const storageKey = "branchsuite:access:v1";
const roles = Object.keys(permissions) as Role[];

export default function RolesPermissionsPage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [users, setUsers] = useState(initialUsers);
  const { branches: availableBranches, loading: branchesLoading, error: branchesError, refresh: refreshBranches } = useAvailableBranches();
  const branches = availableBranches.map(item => item.name);
  useEffect(() => {
    if (!branchesLoading && !branchesError) setBranch(current => branches.includes(current) ? current : branches[0] ?? '');
  }, [availableBranches, branchesLoading, branchesError]);
  const [branch, setBranch] = useState("");
  const [picker, setPicker] = useState(false);
  const [permissionUser, setPermissionUser] = useState<AccessUser | null>(null);
  const [draft, setDraft] = useState<AccessUser | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoaded(false);
      AsyncStorage.getItem(storageKey)
        .then((savedUsers) => {
          if (!mounted) return;
          if (savedUsers) {
            const parsed: unknown = JSON.parse(savedUsers);
            if (
              !Array.isArray(parsed) ||
              !parsed.every(
                (user) =>
                  user &&
                  typeof user.id === "string" &&
                  typeof user.name === "string" &&
                  typeof user.email === "string" &&
                  roles.includes(user.role) &&
                  typeof user.active === "boolean" &&
                  Array.isArray(user.branches) &&
                  user.branches.every(
                    (value: unknown) => typeof value === "string",
                  ),
              )
            )
              throw new Error("Invalid user records");
            setUsers(parsed as AccessUser[]);
          }

          setError("");
          setLoaded(true);
        })
        .catch(() => {
          if (mounted)
            setError(
              "Saved access records could not be loaded. Reopen this page to try again.",
            );
        });
      return () => {
        mounted = false;
      };
    }, []),
  );
  const close = () => {
    if (!saving) {
      setPicker(false);
      setPermissionUser(null);
      setDraft(null);
      if (loaded) setError("");
    }
  };
  const save = async () => {
    if (!draft || !loaded || saving) return;
    const user = {
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
    };
    if (
      !user.name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
      !user.branches.length
    ) {
      setError("Enter a name, a valid email and at least one branch.");
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
    const next = user.id
      ? users.map((item) => (item.id === user.id ? user : item))
      : [
          ...users,
          {
            ...user,
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
          },
        ];
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setUsers(JSON.parse((await AsyncStorage.getItem(storageKey)) || "[]"));
      setDraft(null);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Access could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to More"
              onPress={() => router.replace("/admin/more")}
              style={styles.back}
            >
              <AppIcon symbol="‹" style={styles.backText} />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>WORKSPACE</Text>
              <Text style={styles.title}>Roles & access</Text>
              <Text style={styles.subtitle}>
                Manage employee access to your company and branches.
              </Text>
            </View>
          </View>
<View accessibilityLabel="Page filters" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginVertical: 12 }}>
<Pressable
                accessibilityRole="button"
                accessibilityLabel="Search users"
                onPress={() => setSearch(search === null ? "" : null)}
                style={styles.searchButton}
              >
                <View style={styles.searchGlass} />
              </Pressable>
<Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose workspace branch"
                onPress={() => setPicker(true)}
                style={[styles.headerFilter, styles.selectedFilter]}
              >
                <Text style={styles.headerCaption}>Branch</Text>
                <Text
                  numberOfLines={1}
                  style={[styles.filterText, styles.flex]}
                >
                  {branch || "Choose branch"}
                </Text>
                <AppIcon symbol="⌄" style={styles.muted} />
              </Pressable>
</View>

          <View style={styles.notice}>
            <AppIcon symbol="ⓘ" style={styles.info} />
            <Text style={styles.noticeText}>
              Access changes are saved to your workspace. Role assignment is limited by your account permissions.
            </Text>
          </View>
          {search !== null && (
            <TextInput
              accessibilityLabel="Search users by name or email"
              autoFocus
              placeholder="Search users by name or email"
              value={search}
              onChangeText={setSearch}
              style={styles.input}
            />
          )}
          {error && !draft ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.cards}>
            {users
              .filter(
                (user) =>
                  search === null ||
                  `${user.name} ${user.email}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
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
                    {user.branches.map((name) => name).join(" · ")}
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
                    {user.id !== "admin" && (
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
          {search !== null &&
            !users.some((user) =>
              `${user.name} ${user.email}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <Text style={styles.subtitle}>No users found.</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={!loaded}
            onPress={() => {
              setError("");
              setDraft({
                id: "",
                name: "",
                email: "",
                role: "Employee",
                branches: branch ? [branch] : [],
                active: true,
              });
            }}
            style={[
              styles.secondary,
              styles.selectedFilter,
              styles.createButton,
              !loaded && styles.dim,
            ]}
          >
            <Text style={styles.link}>Create user</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/admin/branches")}
            style={styles.secondary}
          >
            <Text style={styles.buttonText}>Manage company branches</Text>
          </Pressable>
          <Text style={styles.footer}>
            <CompanyName /> · Users, roles and branch access
          </Text>
        </ScrollView>
        <AdminBottomNavigation />
      </View>
      <Modal
        transparent
        visible={picker || !!permissionUser || !!draft}
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, styles.flex]}>
                {picker
                  ? "Choose branch"
                  : permissionUser
                    ? "Permissions"
                    : draft?.id
                      ? "Edit access"
                      : "Create user"}
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
            <ScrollView keyboardShouldPersistTaps="handled"><BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={!branches.length} onRetry={refreshBranches} />
              {picker ? (
                branches.map((name) => (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityState={{ selected: branch === name }}
                    onPress={() => {
                      setBranch(name);
                      setPicker(false);
                    }}
                    style={[
                      styles.option,
                      branch === name && styles.selectedFilter,
                    ]}
                  >
                    <Text style={styles.buttonText}>{name}</Text>
                  </Pressable>
                ))
              ) : permissionUser ? (
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
                  <Text style={styles.subtitle}>
                    Applies to: {permissionUser.branches.join(", ")}. Roles are
                    managed by the platform; you can change branch access and
                    active status here.
                  </Text>
                </View>
              ) : (
                draft && (
                  <View style={styles.form}>
                    {(["name", "email"] as const).map((key) => (
                      <View key={key}>
                        <Text style={styles.fieldLabel}>
                          {key === "name" ? "Full name" : "Email"}
                        </Text>
                        <TextInput
                          accessibilityLabel={
                            key === "name" ? "Full name" : "Email"
                          }
                          editable={!saving}
                          value={draft[key]}
                          onChangeText={(value) =>
                            setDraft({ ...draft, [key]: value })
                          }
                          keyboardType={
                            key === "email" ? "email-address" : "default"
                          }
                          autoCapitalize={key === "email" ? "none" : "words"}
                          style={styles.input}
                        />
                      </View>
                    ))}
                    <Text style={styles.fieldLabel}>Company</Text>
                    <Text style={styles.branchText}>
                      <CompanyName />
                    </Text>
                    <Text style={styles.fieldLabel}>Role</Text>
                    {(users.some(user => user.id === draft.id) ? [users.find(user => user.id === draft.id)!.role] : ['Employee'] as Role[]).map((role) => (
                      <Pressable
                        key={role}
                        accessibilityRole="button"
                        accessibilityState={{ selected: draft.role === role }}
                        disabled={saving}
                        onPress={() => setDraft({ ...draft, role })}
                        style={[
                          styles.option,
                          draft.role === role && styles.selectedFilter,
                        ]}
                      >
                        <Text style={styles.buttonText}>{role}</Text>
                      </Pressable>
                    ))}
                    <Text style={styles.branchText}>Role changes require a platform administrator. New accounts use the Employee role.</Text>
                    <Text style={styles.fieldLabel}>Branch access</Text>
                    {[...new Set([...branches, ...draft.branches])].map(
                      (name) => (
                        <Pressable
                          key={name}
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: draft.branches.includes(name),
                          }}
                          disabled={saving}
                          onPress={() =>
                            setDraft({
                              ...draft,
                              branches: draft.branches.includes(name)
                                ? draft.branches.filter(
                                    (value) => value !== name,
                                  )
                                : [...draft.branches, name],
                            })
                          }
                          style={[
                            styles.option,
                            draft.branches.includes(name) &&
                              styles.selectedFilter,
                          ]}
                        >
                          <Text style={styles.buttonText}>
                            <AppIcon symbol={draft.branches.includes(name) ? "☑" : "☐"} size={16} /> {name}
                          </Text>
                        </Pressable>
                      ),
                    )}
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityLabel="User active"
                      accessibilityState={{ checked: draft.active }}
                      disabled={saving}
                      onPress={() =>
                        setDraft({ ...draft, active: !draft.active })
                      }
                      style={styles.option}
                    >
                      <Text style={styles.buttonText}>
                        User status: {draft.active ? "Active" : "Inactive"}
                      </Text>
                    </Pressable>
                    {error ? (
                      <Text accessibilityRole="alert" style={styles.error}>
                        {error}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={save}
                      style={[styles.primary, saving && styles.dim]}
                    >
                      <Text style={styles.primaryText}>
                        {saving ? "Saving…" : "Save access"}
                      </Text>
                    </Pressable>
                  </View>
                )
              )}
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
  headerCaption: { fontSize: 9, lineHeight: 14, color: "#71829c" },
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
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#f6f8fd",
    alignItems: "center",
    justifyContent: "center",
  },
  searchGlass: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: "#20334f",
    borderRadius: 7,
  },
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
  content: { padding: 16, paddingTop: 20, paddingBottom: 28, gap: 12 },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 8,
  },
  back: {
    width: 34,
    minHeight: 34,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 26, lineHeight: 28, color: "#20334f" },
  eyebrow: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#71829c",
  },
  title: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "800",
    color: "#20334f",
    marginTop: 5,
  },
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
  form: { gap: 10, marginTop: 16 },
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
  option: {
    minHeight: 44,
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
    justifyContent: "center",
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
