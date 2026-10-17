import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import AsyncStorage from "../../../src/core/admin/storage";
import { companiesApi, type CompanyDto } from "../../../src/core/admin/api";
import {
  getAdminScope,
  getCompanyBranches,
  invalidateAdminScope,
  UserInitials,
} from "../../../src/core/admin/scope";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";

const accents = [
  { label: "Cobalt + soft blue", color: "#345cf2", soft: "#eaf0ff" },
  { label: "Teal + soft mint", color: "#008578", soft: "#dff5ef" },
  { label: "Violet + soft lavender", color: "#7853c8", soft: "#eee7ff" },
] as const;
const accentStorageKey = "branchsuite:workspace-accent:v2";
const legacyStorageKey = "branchsuite:workspace-settings:v1";
const modules = [
  {
    title: "Companies",
    caption: "View and manage legal/business units.",
    icon: "building",
    color: "#345cf2",
    soft: "#eaf0ff",
    route: null,
  },
  {
    title: "Branches",
    caption: "Locations, branch managers and payroll runs.",
    icon: "building",
    color: "#008578",
    soft: "#dff5ef",
    route: "/admin/branches",
  },
  {
    title: "Users & roles",
    caption: "Create staff access and assign branches.",
    icon: "lock",
    color: "#7853c8",
    soft: "#eee7ff",
    route: "/admin/roles-permissions",
  },
  {
    title: "Subscription",
    caption: "Capacity, plan and billing.",
    icon: "document",
    color: "#345cf2",
    soft: "#eaf0ff",
    route: "/admin/subscription",
  },
] as const;
function ModuleIcon({ kind, color }: { kind: string; color: string }) {
  if (kind === "lock")
    return (
      <View>
        <View style={[baseStyles.lockTop, { borderColor: color }]} />
        <View style={[baseStyles.lockBody, { borderColor: color }]} />
      </View>
    );
  if (kind === "document")
    return (
      <View style={[baseStyles.document, { borderColor: color }]}>
        {[0, 1, 2].map((line) => (
          <View
            key={line}
            style={[baseStyles.documentLine, { backgroundColor: color }]}
          />
        ))}
      </View>
    );
  return (
    <View style={[baseStyles.building, { borderColor: color }]}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={baseStyles.iconRow}>
          <View style={[baseStyles.window, { backgroundColor: color }]} />
          <View style={[baseStyles.window, { backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles, contentWidth } = useAdminLayout(baseStyles, "detail");
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [name, setName] = useState("");
  const [accent, setAccent] = useState(0);
  const [dialog, setDialog] = useState<"accent" | "companies" | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const theme = accents[accent];
  const selectedCompany = companies.find(
    (item) => item.id === selectedCompanyId,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [saved, legacy] = await Promise.all([
          AsyncStorage.getItem(accentStorageKey),
          AsyncStorage.getItem(legacyStorageKey),
        ]);
        const legacyValue: unknown = legacy ? JSON.parse(legacy) : null;
        const candidate =
          saved !== null
            ? Number(saved)
            : legacyValue &&
                typeof legacyValue === "object" &&
                "accent" in legacyValue
              ? (legacyValue as { accent: unknown }).accent
              : 0;
        if (
          active &&
          typeof candidate === "number" &&
          Number.isInteger(candidate) &&
          candidate >= 0 &&
          candidate < accents.length
        )
          setAccent(candidate);
      } catch {
        /* Invalid legacy device settings should never block server data. */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      Promise.all([getAdminScope(), companiesApi.list(), getCompanyBranches()])
        .then(([scope, available, companyBranches]) => {
          if (!active) return;
          setIsOwner(scope.role === "BUSINESS_OWNER");
          setCompanies(available);
          setSelectedCompanyId((current) =>
            available.some((c) => c.id === current)
              ? current
              : available.find((c) => c.id === scope.companyId)?.id ||
                available[0]?.id ||
                "",
          );
          setBranches(
            companyBranches
              .filter((b) => b.status === "ACTIVE")
              .map((b) => b.name),
          );
        })
        .catch((cause) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load workspace.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );

  useEffect(() => {
    setName(selectedCompany?.name ?? "");
  }, [selectedCompany?.id, selectedCompany?.name]);
  const refresh = () => setAttempt((value) => value + 1);
  const saveBranding = async () => {
    if (!selectedCompany || saving) return;
    const proposed = name.trim();
    if (proposed.length < 2 || proposed.length > 100) {
      setError("Company name must be 2–100 characters.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      // Company name is shared across devices, accent is only a local display preference.
      if (proposed !== selectedCompany.name)
        await companiesApi.rename(selectedCompany.id, proposed);
      await AsyncStorage.setItem(accentStorageKey, String(accent));
      invalidateAdminScope();
      setNotice(
        "Company name saved to the server; accent saved on this device.",
      );
      refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save company settings.",
      );
    } finally {
      setSaving(false);
    }
  };
  const addCompany = async () => {
    const proposed = companyName.trim();
    if (!isOwner) {
      setError("Only Business Owners may create companies.");
      return;
    }
    if (proposed.length < 2 || proposed.length > 100) {
      setError("Company name must be 2–100 characters.");
      return;
    }
    if (
      companies.some(
        (company) =>
          company.name.trim().toLowerCase() === proposed.toLowerCase(),
      )
    ) {
      setError("Company already exists.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const added = await companiesApi.create(proposed);
      setCompanyName("");
      setSelectedCompanyId(added.id);
      invalidateAdminScope();
      setNotice(
        "Company created in PostgreSQL. Switch workspace access as needed.",
      );
      setDialog(null);
      refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Company could not be created.",
      );
    } finally {
      setSaving(false);
    }
  };
  const close = () => {
    if (!saving) {
      setDialog(null);
      setError("");
    }
  };
  const visibleModules = modules.filter((module) =>
    `${module.title} ${module.caption}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const cardWidth = contentWidth < 280 ? contentWidth : (contentWidth - 10) / 2;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        {!desktop && (
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={styles.companyName}>
                  {selectedCompany?.name || "Your company"}
                </Text>
                <Text style={styles.headerCaption}>Business workspace</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search workspaces"
                onPress={() => setSearchOpen((value) => !value)}
                style={styles.searchButton}
              >
                <View style={styles.searchIcon}>
                  <View style={styles.searchHandle} />
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open my profile"
                onPress={() => router.push("/admin/profile")}
                style={[styles.avatar, { backgroundColor: theme.soft }]}
              >
                <Text style={[styles.avatarText, { color: theme.color }]}>
                  <UserInitials />
                </Text>
              </Pressable>
            </View>
            <View style={styles.headerFilters}>
              <View style={styles.headerFilter}>
                <Text style={styles.headerCaption}>Company</Text>
                <Text numberOfLines={1} style={styles.filterText}>
                  {selectedCompany?.name || "—"}
                </Text>
              </View>
              <View style={[styles.headerFilter, styles.selectedFilter]}>
                <Text style={styles.headerCaption}>Branches</Text>
                <Text numberOfLines={1} style={styles.filterText}>
                  {branches.length ? `${branches.length} active` : "None"}
                </Text>
              </View>
            </View>
          </View>
        )}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.eyebrow}>BRANCHSUITE</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Workspace settings
            </Text>
            <Text style={styles.subtitle}>
              Manage companies and your device appearance. Company changes are
              shared through the backend.
            </Text>
          </View>
          {loading ? <ActivityIndicator color="#008578" /> : null}
          <View style={styles.card}>
            <Text style={styles.label}>Company</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select company"
              disabled={loading || saving}
              onPress={() => setDialog("companies")}
              style={styles.selector}
            >
              <Text style={styles.selectorText}>
                {selectedCompany?.name || "Choose a company"}
              </Text>
              <Text style={styles.down}>{"⌄"}</Text>
            </Pressable>
            <Text style={styles.label}>Business display name *</Text>
            <TextInput
              accessibilityLabel="Business display name"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setNotice("");
              }}
              editable={!loading && !saving && !!selectedCompany}
              maxLength={100}
              style={styles.input}
            />
            <Text style={styles.label}>Device accent (not synchronized)</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Workspace accent: ${theme.label}`}
              disabled={saving}
              onPress={() => setDialog("accent")}
              style={styles.selector}
            >
              <Text style={styles.selectorText}>{theme.label}</Text>
              <Text style={styles.down}>{"⌄"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading || saving || !selectedCompany}
              onPress={() => void saveBranding()}
              style={[
                styles.primary,
                { backgroundColor: theme.color },
                (loading || saving || !selectedCompany) && styles.dim,
              ]}
            >
              <Text style={styles.primaryText}>
                {saving ? "Saving…" : "Save company and accent"}
              </Text>
            </Pressable>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
                {notice}
              </Text>
            ) : null}
          </View>
          {searchOpen || desktop ? (
            <TextInput
              accessibilityLabel="Search workspaces"
              placeholder="Search workspaces…"
              value={query}
              onChangeText={setQuery}
              style={styles.input}
            />
          ) : null}
          <View style={styles.moduleGrid}>
            {visibleModules.map((module) => (
              <Pressable
                key={module.title}
                accessibilityRole="button"
                accessibilityLabel={`Open ${module.title} workspace`}
                onPress={() =>
                  module.route
                    ? router.push(module.route)
                    : setDialog("companies")
                }
                style={({ pressed }) => [
                  styles.moduleCard,
                  { width: cardWidth },
                  pressed && styles.dim,
                ]}
              >
                <View style={styles.moduleBody}>
                  <View
                    style={[
                      styles.moduleIcon,
                      { backgroundColor: module.soft },
                    ]}
                  >
                    <ModuleIcon kind={module.icon} color={module.color} />
                  </View>
                  <Text style={styles.moduleTitle}>{module.title}</Text>
                  <Text style={styles.moduleCaption}>{module.caption}</Text>
                </View>
                <View style={styles.moduleFooter}>
                  <Text style={[styles.openText, { color: theme.color }]}>
                    Open workspace
                  </Text>
                  <Text style={[styles.chevron, { color: theme.color }]}>
                    {"›"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          {!visibleModules.length ? (
            <Text style={styles.subtitle}>No matching workspaces.</Text>
          ) : null}
          <Text style={styles.footer}>
            BranchSuite Business · Server-backed companies · Device-only accent
          </Text>
        </ScrollView>
        <AdminBottomNavigation />
      </View>
      <Modal
        transparent
        visible={dialog !== null}
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.modal}>
            <View style={styles.headerRow}>
              <Text
                accessibilityRole="header"
                style={[styles.modalTitle, styles.flex]}
              >
                {dialog === "accent" ? "Workspace accent" : "Companies"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                disabled={saving}
                onPress={close}
                style={styles.close}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.dialogContent}
            >
              {dialog === "accent" ? (
                accents.map((option, index) => (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: accent === index }}
                    onPress={() => {
                      setAccent(index);
                      setDialog(null);
                      setNotice(
                        "Accent selected. Save changes to persist it on this device.",
                      );
                    }}
                    style={[
                      styles.option,
                      accent === index && styles.selectedFilter,
                    ]}
                  >
                    <View
                      style={[styles.swatch, { backgroundColor: option.color }]}
                    />
                    <Text style={styles.selectorText}>{option.label}</Text>
                  </Pressable>
                ))
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    Companies available to your account (server-backed).
                  </Text>
                  {companies.map((company) => (
                    <Pressable
                      key={company.id}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: selectedCompanyId === company.id,
                      }}
                      onPress={() => {
                        setSelectedCompanyId(company.id);
                        setDialog(null);
                        setError("");
                      }}
                      style={[
                        styles.option,
                        selectedCompanyId === company.id &&
                          styles.selectedFilter,
                      ]}
                    >
                      <Text style={styles.moduleTitle}>
                        {company.name} · {company.status}
                      </Text>
                    </Pressable>
                  ))}
                  {isOwner ? (
                    <>
                      <Text style={styles.label}>New company name</Text>
                      <TextInput
                        accessibilityLabel="New company name"
                        value={companyName}
                        onChangeText={setCompanyName}
                        editable={!saving}
                        maxLength={100}
                        style={styles.input}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() => void addCompany()}
                        style={[
                          styles.primary,
                          { backgroundColor: theme.color },
                          saving && styles.dim,
                        ]}
                      >
                        <Text style={styles.primaryText}>
                          {saving ? "Creating…" : "Create company"}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.subtitle}>
                      Only a Business Owner can create companies.
                    </Text>
                  )}
                  {error ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {error}
                    </Text>
                  ) : null}
                </>
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
  page: { flex: 1, width: "100%", alignSelf: "center" },
  flex: { flex: 1, minWidth: 0 },
  header: {
    padding: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  companyName: { fontSize: 13, fontWeight: "800", color: "#20334f" },
  headerCaption: { fontSize: 9, lineHeight: 14, color: "#71829c" },
  down: { fontSize: 13, color: "#607591", marginLeft: "auto" },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "700" },
  headerFilters: { flexDirection: "row", gap: 8, marginTop: 12 },
  headerFilter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    padding: 8,
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
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#f6f8fd",
    alignItems: "center",
    justifyContent: "center",
  },
  searchIcon: {
    width: 13,
    height: 13,
    borderWidth: 1.3,
    borderColor: "#20334f",
    borderRadius: 7,
  },
  searchHandle: {
    position: "absolute",
    width: 7,
    height: 1.3,
    backgroundColor: "#20334f",
    right: -5,
    bottom: -3,
    transform: [{ rotate: "45deg" }],
  },
  content: { padding: 16, paddingTop: 22, paddingBottom: 30, gap: 14 },
  eyebrow: {
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: "#71829c",
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    color: "#20334f",
    marginTop: 6,
  },
  subtitle: { fontSize: 11, lineHeight: 18, color: "#607591", marginTop: 5 },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 20,
    backgroundColor: "#fff",
    gap: 12,
    marginTop: 7,
  },
  label: { fontSize: 11, lineHeight: 18, fontWeight: "600", color: "#405573" },
  input: {
    minHeight: 44,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 12,
    backgroundColor: "#fbfcff",
    fontSize: 14,
    color: "#20334f",
  },
  selector: {
    minHeight: 44,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 12,
    backgroundColor: "#fbfcff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#20334f",
    flexShrink: 1,
  },
  primary: {
    minHeight: 44,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moduleCard: {
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 20,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  moduleBody: { padding: 14, minHeight: 138 },
  moduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  moduleTitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: "#20334f",
  },
  moduleCaption: {
    fontSize: 10,
    lineHeight: 17,
    color: "#607591",
    marginTop: 5,
  },
  moduleFooter: {
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    backgroundColor: "#fbfcff",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openText: { fontSize: 9, lineHeight: 15, fontWeight: "600" },
  chevron: { fontSize: 20, lineHeight: 20 },
  footer: {
    fontSize: 9,
    lineHeight: 16,
    color: "#8192ad",
    textAlign: "center",
    marginTop: 20,
  },
  building: { width: 13, height: 17, padding: 2, borderWidth: 1, gap: 2 },
  iconRow: { flexDirection: "row", gap: 2 },
  window: { width: 2, height: 2 },
  lockTop: {
    width: 8,
    height: 7,
    borderWidth: 1,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    alignSelf: "center",
  },
  lockBody: {
    width: 13,
    height: 10,
    borderWidth: 1,
    borderRadius: 2,
    marginTop: -1,
  },
  document: {
    width: 14,
    height: 17,
    padding: 3,
    borderWidth: 1,
    borderRadius: 2,
    gap: 3,
  },
  documentLine: { width: 6, height: 1 },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(21,43,60,0.25)",
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    color: "#20334f",
  },
  close: { minHeight: 44, justifyContent: "center" },
  link: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: "#345cf2" },
  dialogContent: { paddingTop: 14, gap: 12 },
  option: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  swatch: { width: 22, height: 22, borderRadius: 7 },
  error: { fontSize: 12, lineHeight: 19, color: "#b94d61" },
  dim: { opacity: 0.65 },
});
