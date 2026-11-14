import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { branchesApi, usersApi, type UserDto } from "../../../core/admin/api";
import {
  branchDraft,
  branchFormValues,
  emptyBranch,
  SHIFT_TIME,
  type BranchDraft,
} from "../../../core/admin/branch-form";
import {
  getAdminScope,
  invalidateAdminScope,
  useAdminScope,
} from "../../../core/admin/scope";
import { useWorkspaceFocusEffect } from "../../../core/admin/useWorkspaceFocusEffect";
import { AdminPageHeading } from "../../../ui/AdminPageHeading";
import { AdminBottomNavigation } from "../../../ui/AdminBottomNavigation";
import { KeyboardAwareScrollView } from "../../../ui/KeyboardAwareScrollView";
import { FloatingTextInput } from "../../../ui/FloatingTextInput";
import { Dropdown } from "../../../ui/Dropdown";
import { TimePickerField } from "../../../ui/TimePickerField";
import { MapLocationField } from "../../../ui/MapLocationField";
import { useAdminLayout } from "../../../ui/useAdminLayout";
import { toast } from "../../../ui/toast-store";
import { formSpacing } from "../../../shared/theme/formSpacing";

export function BranchFormScreen({ branchId }: { branchId?: string }) {
  const router = useRouter();
  const scope = useAdminScope();
  const { styles } = useAdminLayout(baseStyles, "form");
  const [draft, setDraft] = useState<BranchDraft>({ ...emptyBranch });
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [managers, setManagers] = useState<UserDto[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const title = branchId ? "Edit branch details" : "Add branch";
  const back = () => {
    if (!savingRef.current) router.dismissTo("/admin/branches");
  };

  useWorkspaceFocusEffect(
    useCallback(() => {
      let active = true;
      setLoaded(false);
      setLoadError("");
      setSaveError("");
      void (async () => {
        try {
          const selected = await getAdminScope();
          const [records, users] = await Promise.all([
            branchesApi.list(selected.companyId),
            usersApi.list(),
          ]);
          if (!active) return;
          const items = records.map(branchDraft);
          const existing = branchId
            ? items.find((item) => item.id === branchId)
            : undefined;
          if (branchId && !existing)
            throw new Error(
              "This branch is not available in the selected company.",
            );
          setCompanyId(selected.companyId);
          setBranches(items);
          setManagers(
            users.filter(
              (user) =>
                user.status === "ACTIVE" &&
                user.roles.some(({ role }) => role.name === "BRANCH_MANAGER"),
            ),
          );
          setDraft(existing ?? { ...emptyBranch });
          setLoaded(true);
        } catch (error) {
          if (active)
            setLoadError(
              error instanceof Error
                ? error.message
                : "Could not load branch details.",
            );
        }
      })();
      return () => {
        active = false;
      };
    }, [branchId, scope?.companyId, attempt]),
  );

  const save = async () => {
    if (!loaded || savingRef.current) return;
    setSaveError("");
    let values: ReturnType<typeof branchFormValues>;
    try {
      values = branchFormValues(draft, branches);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Check the branch details.",
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const selected = await getAdminScope();
      if (selected.companyId !== companyId)
        throw new Error(
          "The selected company changed. Reload this form before saving.",
        );
      const { name, ...details } = values;
      let id = draft.id;
      let saved;
      if (id) saved = await branchesApi.update(id, { name, ...details });
      else {
        const created = await branchesApi.create(companyId, name, details);
        saved = created;
        id = created.id;
        // Keep the created ID if a subsequent status request fails, so retry updates
        // this branch rather than attempting a duplicate creation.
        setDraft((current) => ({ ...current, id }));
        setBranches((current) => [...current, branchDraft(created)]);
      }
      if (
        details.latitude !== null &&
        (saved?.latitude !== details.latitude ||
          saved?.longitude !== details.longitude)
      )
        throw new Error(
          "The server did not confirm the selected location. Update the backend before saving this map location.",
        );
      const previous = branches.find((item) => item.id === id);
      if (previous ? previous.active !== draft.active : !draft.active)
        await branchesApi.setStatus(id, draft.active ? "ACTIVE" : "INACTIVE");
      invalidateAdminScope();
      toast.success(
        branchId
          ? "Branch updated successfully."
          : "Branch created successfully.",
      );
      router.dismissTo("/admin/branches");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Branch could not be saved.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.pageHeading}>
          <AdminPageHeading title={title} onBack={back} backDisabled={saving} />
        </View>
        {!loaded ? (
          <View style={styles.loading}>
            {loadError ? (
              <>
                <Text accessibilityRole="alert" style={styles.error}>
                  {loadError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAttempt((value) => value + 1)}
                  style={styles.secondary}
                >
                  <Text>Retry loading branch form</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator accessibilityLabel="Loading branch form" />
            )}
          </View>
        ) : (
          <KeyboardAwareScrollView
            testID="branch-form-scroll"
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Branch details</Text>
              <FloatingTextInput
                label="Branch name"
                accessibilityLabel="Branch name"
                value={draft.name}
                editable={!saving}
                onChangeText={(name) =>
                  setDraft((current) => ({ ...current, name }))
                }
                validation={{ kind: "name", required: true, maxLength: 150 }}
                autoCapitalize="words"
                style={styles.input}
              />
              <MapLocationField
                value={
                  draft.latitude !== null && draft.longitude !== null
                    ? {
                        latitude: draft.latitude,
                        longitude: draft.longitude,
                        address: draft.location,
                      }
                    : null
                }
                legacyAddress={draft.location}
                disabled={saving}
                onChange={(location) =>
                  setDraft((current) => ({
                    ...current,
                    location: location?.address ?? "",
                    latitude: location?.latitude ?? null,
                    longitude: location?.longitude ?? null,
                  }))
                }
              />
              <Text style={styles.sectionTitle}>Shift and attendance</Text>
              {/* <Text style={styles.caption}>
                Times use AM/PM in Indian time. Leave shifts unset to turn off
                late marking. Overnight shifts are supported.
              </Text> */}
              <TimePickerField
                label="Shift start"
                value={draft.shiftStart}
                disabled={saving}
                onChange={(shiftStart) =>
                  setDraft((current) => ({ ...current, shiftStart }))
                }
              />
              <TimePickerField
                label="Shift end"
                value={draft.shiftEnd}
                disabled={saving}
                onChange={(shiftEnd) =>
                  setDraft((current) => ({ ...current, shiftEnd }))
                }
              />
              <FloatingTextInput
                label="Grace period (minutes)"
                accessibilityLabel="Grace period (minutes)"
                value={draft.graceMinutes}
                editable={!saving}
                onChangeText={(graceMinutes) =>
                  setDraft((current) => ({ ...current, graceMinutes }))
                }
                keyboardType="number-pad"
                validation={{ kind: "integer", maxLength: 3, min: 0, max: 180 }}
                style={styles.input}
              />
              <Dropdown
                label="Branch manager"
                value={draft.managerUserId ?? ""}
                options={[
                  { value: "", label: "Unassigned" },
                  ...managers.map((user) => ({
                    value: user.id,
                    label: user.name,
                  })),
                ]}
                disabled={saving}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    managerUserId: value || null,
                    managerUserName: managers.find((user) => user.id === value)
                      ?.name,
                  }))
                }
              />
              {!draft.managerUserId && !!draft.manager && (
                <Text style={styles.caption}>
                  Current record: {draft.manager} (not linked to an account)
                </Text>
              )}
              {!managers.length && (
                <Text style={styles.caption}>
                  No active branch manager accounts have access to this company.
                </Text>
              )}
              <Dropdown
                label="Status"
                value={draft.active ? "ACTIVE" : "INACTIVE"}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
                disabled={saving}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    active: value === "ACTIVE",
                  }))
                }
              />
              {!!saveError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {saveError}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save branch"
                disabled={saving}
                onPress={save}
                style={[styles.primary, saving && styles.disabled]}
              >
                <Text style={styles.primaryText}>
                  {saving ? "Saving…" : "Save branch"}
                </Text>
              </Pressable>
            </View>
          </KeyboardAwareScrollView>
        )}
        <AdminBottomNavigation disabled={saving} />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, minHeight: 0 },
  pageHeading: { paddingHorizontal: 16, paddingTop: 12, flexShrink: 0 },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 16, paddingBottom: 40 },
  form: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: formSpacing.field,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#20334f",
  },
  caption: { fontSize: 12, lineHeight: 18, color: "#607591" },
  input: { minHeight: 44, borderRadius: 10 },
  primary: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#345cf2",
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  secondary: {
    minHeight: 44,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dce3e7",
  },
  loading: { padding: 24, gap: 16 },
  error: { color: "#b94d61", fontSize: 13, lineHeight: 20 },
  disabled: { opacity: 0.6 },
});
