import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { SearchField } from '../../../src/ui/SearchField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";
import { DesktopEyebrow } from '../../../src/ui/DesktopEyebrow';
import { CompanyName, selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import React, { useCallback, useRef, useState } from "react";

import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { branchesApi, usersApi, type UserDto } from "../../../src/core/admin/api";
import {
  getAdminScope,
  invalidateAdminScope,
} from "../../../src/core/admin/scope";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ToastModal as Modal } from '../../../src/ui/Toast';
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";

type Branch = {
  id: string;
  name: string;
  code: string;
  location: string;
  manager: string;
  managerUserId?: string | null;
  managerUserName?: string;
  employees: number;
  active: boolean;
};
const initialBranches: Branch[] = [];
const emptyBranch: Branch = {
  id: "",
  name: "",
  code: "",
  location: "",
  manager: "",
  managerUserId: null,
  employees: 0,
  active: true,
};

function BuildingIcon() { return <AppIcon name="git-branch" size={24} color="#345cf2" />; }

export default function BranchManagementPage() {
  const router = useRouter();
  const scope = useAdminScope();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [branches, setBranches] = useState(initialBranches);
  const [selectedId, setSelectedId] = useState("");
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<Branch | null>(null);
  const [error, setError] = useToastState("", 'error');
  const [loaded, setLoaded] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [managers, setManagers] = useState<UserDto[]>([]);
  const selected = branches.find((branch) => branch.id === selectedId);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoaded(false);
      setError("");
      async function load() {
        try {
          const scope = await getAdminScope();
          const [results, users] = await Promise.all([branchesApi.list(scope.companyId), usersApi.list()]);
          if (!active) return;
          const next: Branch[] = results.map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            location: item.location,
            manager: item.manager,
            managerUserId: item.managerUserId ?? undefined,
            managerUserName: item.managerUser?.name,
            employees: item.employees,
            active: item.status === "ACTIVE",
          }));
          setBranches(next);
          setManagers(users.filter(user => user.status === 'ACTIVE' && user.roles.some(({ role }) => role.name === 'BRANCH_MANAGER')));
          setSelectedId(scope.branchId ?? "");
        } catch (reason) {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load branches from the server.",
            );
        } finally {
          if (active) setLoaded(true);
        }
      }
      void load();
      return () => {
        active = false;
      };
    }, [refreshCount]),
  );

  const close = () => {
    if (savingRef.current) return;
    setDraft(null);
    setPicker(false);
    setError("");
  };

  const edit = (branch: Branch) => {
    setError("");
    setDraft({ ...branch });
  };

  const save = async () => {
    if (!draft || savingRef.current || !loaded) return;
    const name = draft.name.trim();
    const code = draft.code.trim().toUpperCase();
    const location = draft.location.trim();
    if (!name || !/^[A-Z0-9_-]{2,20}$/.test(code)) {
      setError(
        "Enter a branch name and a code of 2–20 letters, numbers, underscores or hyphens.",
      );
      return;
    }
    if (name.length > 150 || location.length > 240) {
      setError("Branch name or location exceeds the allowed length.");
      return;
    }
    const duplicate = branches.some(
      (item) =>
        item.id !== draft.id &&
        (item.name.toLowerCase() === name.toLowerCase() ||
          item.code.toLowerCase() === code.toLowerCase()),
    );
    if (duplicate) {
      setError(
        "A branch with that name or code already exists in this company.",
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      let id = draft.id;
      if (!id) {
        const scope = await getAdminScope();
        const created = await branchesApi.create(scope.companyId, name, {
          code,
          location,
          managerUserId: draft.managerUserId,
        });
        id = created.id;
      } else {
        await branchesApi.update(id, { name, code, location, managerUserId: draft.managerUserId });
      }
      // Separate status endpoint; on failure keep modal open and show a retryable error.
      if (
        draft.id
          ? draft.active !== branches.find((item) => item.id === id)?.active
          : !draft.active
      ) {
        await branchesApi.setStatus(id, draft.active ? "ACTIVE" : "INACTIVE");
      }
      toast.success(draft.id ? 'Branch updated successfully.' : 'Branch created successfully.');
      invalidateAdminScope();
      // Keep the current list filter after saving branch details.
      setDraft(null);
      setRefreshCount((value) => value + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Branch could not be saved.",
      );
    } finally {
      savingRef.current = false;
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
          <AdminPageHeading title="Branch management" style={{ marginBottom: 16 }}><Pressable
              accessibilityRole="button"
              accessibilityLabel="Add branch"
              disabled={!loaded || saving || !!error}
              onPress={() => edit(emptyBranch)}
              style={[styles.addButton, !loaded && styles.dim]}
            >
              <Text style={styles.addText}>+ Add</Text>
            </Pressable></AdminPageHeading>
          <View style={styles.branchCard}>
            <View style={styles.branchDotHalo}>
              <View style={styles.branchDot} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.branchTitle}>
                {selected?.name || "All branches"}
              </Text><Text style={styles.caption}><CompanyName /> · One branch, every module</Text>

            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change branch"
              onPress={() => setPicker(true)}
              style={styles.change}
            >
              <Text style={styles.link}>Change</Text>
            </Pressable>
          </View>
          {!loaded && (
            <ActivityIndicator
              accessibilityLabel="Loading branches"
              color="#345cf2"
            />
          )}
          {Boolean(error) && !draft && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRefreshCount((value) => value + 1)}
              style={styles.change}
            >
              <Text style={styles.link}>Retry loading branches</Text>
            </Pressable>
          )}
          {(
            <SearchField
              accessibilityLabel="Search branches by name or code"
              value={search}
              onChangeText={setSearch}
            />
          )}
          {error && !draft ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.cards}>
            {branches
              .filter(
                (branch) =>
                  (!selectedId || branch.id === selectedId) &&
                  `${branch.name} ${branch.code}`
                    .toLowerCase()
                    .includes(search.trim().toLowerCase()),
              )
              .map((branch) => (
                <View
                  key={branch.id}
                  style={[styles.card, desktop && styles.desktopCard]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.buildingIcon}>
                      <BuildingIcon />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>{branch.name}</Text>
                      <Text style={styles.caption}>
                        {branch.code} · {branch.location || "Location not set"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        !branch.active && styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          !branch.active && styles.inactiveText,
                        ]}
                      >
                        {branch.active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.caption}>
                      Manager: {branch.managerUserName || branch.manager || "Unassigned"}
                    </Text>
                    <Text style={styles.caption}>
                      {branch.employees} active employee profiles
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${branch.name} branch details`}
                    disabled={!loaded}
                    onPress={() => edit(branch)}
                    style={({ pressed }) => [
                      styles.secondary,
                      pressed && styles.dim,
                    ]}
                  >
                    <Text style={styles.buttonText}>Edit branch details</Text>
                  </Pressable>
                </View>
              ))}
          </View>
          {loaded && !error &&
            !branches.some((branch) =>
              `${branch.name} ${branch.code}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <Text style={styles.subtitle}>No branches found.</Text>}
        </ScrollView>
        <AdminBottomNavigation />
      </View>
      <Modal
        transparent
        visible={picker || draft !== null}
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, styles.flex]}>
                {picker
                  ? "Choose branch"
                  : draft?.id
                    ? "Edit branch details"
                    : "Add branch"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close branch dialog"
                disabled={saving}
                onPress={close}
                style={styles.change}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {picker
                ? [{ ...emptyBranch, name: 'All branches' }, ...branches.filter(branch => branch.active)].map((branch) => (
                    <Pressable
                      key={branch.id}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: selectedId === branch.id,
                      }}
                      onPress={() => {
                        void selectAdminBranch(branch.id || null).then(() => { setSelectedId(branch.id); setPicker(false); }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not change branch.'));
                      }}
                      style={[
                        styles.option,
                        selectedId === branch.id && styles.selectedFilter,
                      ]}
                    >
                      <Text style={styles.cardTitle}>{branch.name}</Text>
                      <Text style={styles.caption}>
                        {branch.code} · {branch.location || "Location not set"}
                      </Text>
                    </Pressable>
                  ))
                : draft && (
                    <View style={styles.form}>
                      {(["name", "code", "location"] as const).map(
                        (key) => (
                          <View key={key}>

                            <TextInput validation={{ required: key === 'name', maxLength: key === 'code' ? 20 : key === 'location' ? 240 : 150, pattern: key === 'code' ? /^[A-Za-z0-9_-]{2,20}$/ : undefined, patternMessage: 'Use 2–20 letters, digits, underscores or hyphens.' }} label={{
                                  name: "Branch name",
                                  code: "Branch code",
                                  location: "Location",
                                }[key]}
                              accessibilityLabel={`Branch ${key}`}
                              editable={!saving}
                              value={draft[key]}
                              onChangeText={(value) =>
                                setDraft({ ...draft, [key]: value })
                              }
                              autoCapitalize={
                                key === "code" ? "characters" : "words"
                              }
                              style={styles.input}
                            />
                          </View>
                        ),
                      )}
                      <Text style={styles.fieldLabel}>Branch manager</Text>
                      {!draft.managerUserId && draft.manager ? <Text style={styles.caption}>Current record: {draft.manager} (not linked to an account)</Text> : null}
                      <Pressable accessibilityRole="button" disabled={saving} style={styles.option} onPress={() => setDraft({ ...draft, managerUserId: null, managerUserName: undefined })}><Text>{draft.managerUserId ? 'Clear manager assignment' : 'Unassigned'}</Text></Pressable>
                      {managers.map(user => <Pressable key={user.id} accessibilityRole="button" accessibilityState={{ selected: draft.managerUserId === user.id }} disabled={saving} style={[styles.option, draft.managerUserId === user.id && styles.selectedFilter]} onPress={() => setDraft({ ...draft, managerUserId: user.id, managerUserName: user.name })}><Text>{user.name}</Text><Text style={styles.caption}>{user.email}</Text></Pressable>)}
                      {managers.length === 0 ? <Text style={styles.caption}>No active branch manager accounts have access to this company.</Text> : null}
                      <Text style={styles.fieldLabel}>Status</Text>
                      <View style={styles.statusOptions}>
                        {[true, false].map((active) => (
                          <Pressable
                            key={String(active)}
                            accessibilityRole="button"
                            accessibilityState={{
                              selected: draft.active === active,
                            }}
                            disabled={saving}
                            onPress={() => setDraft({ ...draft, active })}
                            style={[
                              styles.secondary,
                              styles.flex,
                              draft.active === active && styles.selectedFilter,
                            ]}
                          >
                            <Text style={styles.buttonText}>
                              {active ? "Active" : "Inactive"}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {error ? (
                        <Text accessibilityRole="alert" style={styles.error}>
                          {error}
                        </Text>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={save}
                        style={[styles.addButton, saving && styles.dim]}
                      >
                        <Text style={styles.addText}>
                          {saving ? "Saving…" : "Save branch"}
                        </Text>
                      </Pressable>
                    </View>
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  companyName: { fontSize: 13, fontWeight: "800", color: "#20334f" },
  headerCaption: { fontSize: 9, color: "#71829c", lineHeight: 14 },
  muted: { color: "#71829c" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#345cf2", fontSize: 12, fontWeight: "700" },
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 8,
    backgroundColor: "#f7f9ff",
  },
  filterText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#20334f",
    flexShrink: 1,
  },
  selectedFilter: { backgroundColor: "#eaf0ff", borderColor: "#d5dfff" },
  content: { padding: 16, paddingTop: 20, paddingBottom: 24, gap: 16 },
  heading: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 10 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  eyebrow: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#71829c",
  },
  title: { minWidth: 0, flexShrink: 1, fontSize: 20, lineHeight: 26, fontWeight: "700", color: "#20334f", marginTop: 0 },
  subtitle: { fontSize: 11, lineHeight: 18, color: "#71829c", marginTop: 4 },
  addButton: {
    backgroundColor: "#345cf2",
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  branchDotHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#dcf5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  branchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#39b8a7",
  },
  branchTitle: { fontSize: 11, fontWeight: "700", color: "#20334f" },
  caption: { fontSize: 10, lineHeight: 16, color: "#71829c", marginTop: 4 },
  change: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  link: { fontSize: 11, fontWeight: "700", color: "#345cf2" },
  cards: { gap: 10, flexDirection: "row", flexWrap: "wrap" },
  card: {
    width: "100%",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 19,
    backgroundColor: "#fff",
  },
  desktopCard: { width: "48%", flexGrow: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: "#20334f",
  },
  buildingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#dcf5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  building: {
    width: 12,
    height: 16,
    borderWidth: 1,
    borderColor: "#008e85",
    borderBottomWidth: 2,
  },
  windows: { padding: 2, gap: 2 },
  windowRow: { flexDirection: "row", gap: 2 },
  window: { width: 2, height: 1, backgroundColor: "#008e85" },
  buildingSide: {
    position: "absolute",
    right: -5,
    bottom: -2,
    width: 4,
    height: 11,
    borderWidth: 1,
    borderColor: "#008e85",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: "#dff3ea",
  },
  statusText: { fontSize: 9, fontWeight: "700", color: "#08765c" },
  inactiveBadge: { backgroundColor: "#edf0f5" },
  inactiveText: { color: "#607591" },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  secondary: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  buttonText: { fontSize: 12, fontWeight: "600", color: "#405573" },
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
  option: { minHeight: 60, padding: 12, marginTop: 8, borderRadius: 10 },
  form: { gap: 12, marginTop: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#20334f",
    backgroundColor: "#fff",
  },
  statusOptions: { flexDirection: "row", gap: 8 },
  error: { fontSize: 13, lineHeight: 20, color: "#b94d61" },
  dim: { opacity: 0.6 },
});
