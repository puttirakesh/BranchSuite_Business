
import React, {
  useCallback,
  useState,
} from "react";

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import AsyncStorage from "../../../src/core/admin/storage";

import {
  AdminBottomNavigation,
} from "../../../src/ui/AdminBottomNavigation";

import {
  FiHome,
  FiTrendingUp,
  FiUserPlus,
  FiCreditCard,
  FiMoreHorizontal,
} from "../../../src/ui/FeatherIcons";

import {
  getEmployees,
} from "../../../src/core/employees";

import {
  readLeads,
  type LeadActivity,
} from "../crm/index";

import {
  useAdminLayout,
} from "../../../src/ui/useAdminLayout";

import {
  useAdminViewport,
} from "../../../src/ui/useAdminViewport";

// =====================================================
// TYPES
// =====================================================

type AuditEntry = {
  id: string;
  title: string;
  detail: string;
  actor: string;
  branch: string;
  createdAt: string;
};

/**
 * Legacy local task record.
 *
 * This is deliberately separate from the backend
 * Task DTO. The current Admin Task screen no longer
 * exports the old local Task type.
 */
type LegacyTaskHistoryEntry = {
  id: string;
  kind?: string;
  status?: string;
  note?: string;
  createdAt: string;
};

type LegacyTask = {
  id: string;
  title: string;
  employeeId: string;
  assignedBy?: string;
  branch?: string;
  createdAt?: string;
  history?: LegacyTaskHistoryEntry[];
};

// =====================================================
// ACTIVITY LABELS
// =====================================================

const activityTitles: Record<
  LeadActivity["kind"],
  string
> = {
  stage: "Sales stage changed",
  call: "Call logged",
  activity: "Lead activity added",
  edit: "Lead edited",
  opportunity: "Opportunity created",
  customer: "Lead converted to customer",
};

// =====================================================
// HELPERS
// =====================================================

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isLegacyTaskHistoryEntry(
  value: unknown,
): value is LegacyTaskHistoryEntry {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    (
      value.kind === undefined ||
      typeof value.kind === "string"
    ) &&
    (
      value.status === undefined ||
      typeof value.status === "string"
    ) &&
    (
      value.note === undefined ||
      typeof value.note === "string"
    )
  );
}

function isLegacyTask(
  value: unknown,
): value is LegacyTask {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.employeeId === "string" &&
    (
      value.assignedBy === undefined ||
      typeof value.assignedBy === "string"
    ) &&
    (
      value.branch === undefined ||
      typeof value.branch === "string"
    ) &&
    (
      value.createdAt === undefined ||
      typeof value.createdAt === "string"
    ) &&
    (
      value.history === undefined ||
      (
        Array.isArray(value.history) &&
        value.history.every(
          isLegacyTaskHistoryEntry,
        )
      )
    )
  );
}

function parseLegacyTasks(
  stored: string | null,
): LegacyTask[] {
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Saved task data has an invalid format.",
    );
  }

  if (!parsed.every(isLegacyTask)) {
    throw new Error(
      "Some saved task records have an invalid format.",
    );
  }

  return parsed;
}

function dateLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// =====================================================
// ADMIN AUDIT TRAIL
// =====================================================

export default function ActivityAuditPage() {
  const { styles, recordGrid } =
    useAdminLayout(baseStyles);

  const { desktop } = useAdminViewport();

  const router = useRouter();

  const params = useLocalSearchParams<{
    branch?: string;
  }>();

  const [branch, setBranch] = useState(
    params.branch || "",
  );

  const [branchPicker, setBranchPicker] =
    useState(false);

  const [entries, setEntries] =
    useState<AuditEntry[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [attempt, setAttempt] =
    useState(0);

  // ===================================================
  // LOAD AVAILABLE ACTIVITY
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError("");

      async function loadActivity() {
        try {
          const [
            leads,
            employees,
            stored,
          ] = await Promise.all([
            readLeads(),
            getEmployees(),
            AsyncStorage.getItem(
              "branchsuite:tasks:v1",
            ),
          ]);

          const tasks = parseLegacyTasks(stored);

          const records: AuditEntry[] = [];

          function add(entry: AuditEntry) {
            if (
              typeof entry.createdAt === "string" &&
              Number.isFinite(
                Date.parse(entry.createdAt),
              )
            ) {
              records.push(entry);
            }
          }

          // ===========================================
          // CRM ACTIVITY
          // ===========================================

          leads.forEach((lead) => {
            add({
              id: `lead:${lead.id}`,
              title: "Lead created",
              detail: lead.organisation,
              actor: "Actor not recorded",
              branch: lead.branch,
              createdAt: lead.createdAt,
            });

            (lead.history || []).forEach(
              (entry) => {
                add({
                  id:
                    `lead:${lead.id}:${entry.id}`,

                  title:
                    activityTitles[entry.kind] ||
                    "Lead updated",

                  detail: [
                    lead.organisation,
                    entry.note,
                  ]
                    .filter(Boolean)
                    .join(" · "),

                  actor:
                    entry.actor ||
                    "Actor not recorded",

                  branch: lead.branch,

                  createdAt: entry.createdAt,
                });
              },
            );
          });

          // ===========================================
          // EMPLOYEE ACTIVITY
          // ===========================================

          employees.forEach((employee) => {
            add({
              id: `employee:${employee.id}`,
              title: "Employee added",
              detail: employee.fullName,
              actor: "Actor not recorded",
              branch: employee.branch,
              createdAt: employee.createdAt,
            });
          });

          // ===========================================
          // LEGACY TASK ACTIVITY
          // ===========================================

          tasks.forEach((task) => {
            const assignedEmployee =
              employees.find(
                (employee) =>
                  employee.id === task.employeeId,
              );

            if (task.createdAt) {
              add({
                id: `task:${task.id}`,
                title: "Task assigned",
                detail: [
                  task.title,
                  assignedEmployee?.fullName,
                ]
                  .filter(Boolean)
                  .join(" → "),
                actor:
                  task.assignedBy ||
                  "Actor not recorded",
                branch:
                  task.branch ||
                  assignedEmployee?.branch ||
                  "",
                createdAt: task.createdAt,
              });
            }

            (task.history || []).forEach(
              (
                entry: LegacyTaskHistoryEntry,
              ) => {
                let title = "Task progress updated";

                if (entry.kind === "edit") {
                  title =
                    "Task edited / reassigned";
                } else if (
                  entry.status === "completed" ||
                  entry.status === "COMPLETED"
                ) {
                  title = "Task completed";
                }

                add({
                  id:
                    `task:${task.id}:${entry.id}`,

                  title,

                  detail: [
                    task.title,
                    entry.note,
                  ]
                    .filter(Boolean)
                    .join(" · "),

                  actor: "Actor not recorded",

                  branch:
                    task.branch ||
                    assignedEmployee?.branch ||
                    "",

                  createdAt: entry.createdAt,
                });
              },
            );
          });

          // ===========================================
          // SORT NEWEST FIRST
          // ===========================================

          records.sort(
            (a, b) =>
              Date.parse(b.createdAt) -
                Date.parse(a.createdAt) ||
              a.id.localeCompare(b.id),
          );

          if (active) {
            setEntries(records);
            setError("");
          }
        } catch (reason) {
          if (active) {
            setEntries([]);

            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load the activity history.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadActivity();

      return () => {
        active = false;
      };
    }, [attempt]),
  );

  // =====================================================
  // BRANCH FILTER
  // =====================================================

  const branches = [
    ...new Set(
      entries
        .map((entry) => entry.branch)
        .filter(Boolean),
    ),
  ].sort();

  const visible = entries.filter(
    (entry) =>
      !branch ||
      entry.branch === branch,
  );

  const cardWidth = recordGrid.cardWidth;

  // =====================================================
  // UI
  // =====================================================

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        {/* MOBILE HEADER */}

        {!desktop && (
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={styles.companyName}>
                  BranchSuite
                </Text>

                <Text style={styles.headerCaption}>
                  Business workspace
                </Text>
              </View>

              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  A
                </Text>
              </View>
            </View>

            <View style={styles.headerFilters}>
              <View style={styles.headerFilter}>
                <Text style={styles.headerCaption}>
                  Company
                </Text>

                <Text style={styles.filterText}>
                  BranchSuite
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose audit branch"
                onPress={() =>
                  setBranchPicker(true)
                }
                style={[
                  styles.headerFilter,
                  styles.selectedFilter,
                ]}
              >
                <Text style={styles.filterText}>
                  {branch || "All branches"}
                </Text>

                <Text style={styles.headerCaption}>
                  ⌄
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* MAIN CONTENT */}

        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* PAGE TITLE */}

          <View style={styles.heading}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to More"
              onPress={() =>
                router.push("/admin/more")
              }
              style={styles.back}
            >
              <Text style={styles.backGlyph}>
                ‹
              </Text>
            </Pressable>

            <View style={styles.flex}>
              <Text style={styles.eyebrow}>
                BUSINESS WORKSPACE
              </Text>

              <Text style={styles.title}>
                Audit trail
              </Text>

              <Text style={styles.subtitle}>
                Activity from available saved records.
                Backend audit-log integration is pending.
              </Text>
            </View>

            {desktop && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose audit branch"
                onPress={() =>
                  setBranchPicker(true)
                }
                style={styles.branchButton}
              >
                <Text style={styles.link}>
                  {branch || "All branches"}
                  {" ⌄"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* LOADING */}

          {loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading activity history"
              color="#345cf2"
            />
          ) : error ? (
            // ===========================================
            // ERROR STATE
            // ===========================================

            <View style={styles.empty}>
              <Text style={styles.error}>
                {error}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry activity history"
                onPress={() =>
                  setAttempt(
                    (value) => value + 1,
                  )
                }
                style={styles.branchButton}
              >
                <Text style={styles.link}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* ACTIVITY CARDS */}

              <View style={styles.auditGrid}>
                {visible.map((entry) => (
                  <View
                    key={entry.id}
                    testID="audit-entry"
                    style={[
                      styles.auditCard,
                      {
                        width: cardWidth,
                      },
                    ]}
                  >
                    <Text style={styles.eventTitle}>
                      {entry.title}
                    </Text>

                    {entry.detail ? (
                      <Text
                        style={styles.eventDetail}
                      >
                        {entry.detail}
                      </Text>
                    ) : null}

                    <View
                      style={styles.eventFooter}
                    >
                      <Text style={styles.actor}>
                        {entry.actor}
                      </Text>

                      <Text style={styles.timestamp}>
                        {dateLabel(
                          entry.createdAt,
                        )}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* EMPTY STATE */}

              {!visible.length && (
                <View style={styles.empty}>
                  <Text style={styles.eventTitle}>
                    No activity found
                  </Text>

                  <Text style={styles.subtitle}>
                    {branch
                      ? `No saved activity was found for ${branch}.`
                      : "No activity was found in the currently available records."}
                  </Text>
                </View>
              )}

              <Text style={styles.footer}>
                Available saved activity
                {" · "}
                BranchSuite Business
              </Text>
            </>
          )}
        </ScrollView>

        {/* MOBILE BOTTOM NAVIGATION */}

        {!desktop && (
          <AdminBottomNavigation />
        )}
      </View>

      {/* BRANCH PICKER */}

      <Modal
        visible={branchPicker}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setBranchPicker(false)
        }
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.eventTitle,
                  styles.flex,
                ]}
              >
                Choose branch
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close audit branch picker"
                onPress={() =>
                  setBranchPicker(false)
                }
                style={styles.branchButton}
              >
                <Text style={styles.link}>
                  Close
                </Text>
              </Pressable>
            </View>

            <ScrollView>
              {["", ...branches].map(
                (value) => (
                  <Pressable
                    key={
                      value || "all-branches"
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      `Select ${value || "All branches"}`
                    }
                    accessibilityState={{
                      selected:
                        branch === value,
                    }}
                    onPress={() => {
                      setBranch(value);
                      setBranchPicker(false);
                    }}
                    style={
                      styles.branchOption
                    }
                  >
                    <Text
                      style={styles.filterText}
                    >
                      {value ||
                        "All branches"}
                    </Text>
                  </Pressable>
                ),
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f6f8fd",
  },

  page: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },

  flex: {
    flex: 1,
    minWidth: 0,
  },

  header: {
    padding: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  companyName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#20334f",
  },

  headerCaption: {
    fontSize: 9,
    lineHeight: 14,
    color: "#8192ad",
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#345cf2",
  },

  headerFilters: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  headerFilter: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#f7f9ff",
  },

  filterText: {
    fontSize: 11,
    color: "#405573",
    flexShrink: 1,
  },

  selectedFilter: {
    backgroundColor: "#eaf0ff",
    borderColor: "#d5dfff",
  },

  content: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },

  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },

  back: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  backGlyph: {
    fontSize: 24,
    color: "#405573",
  },

  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: "#71829c",
  },

  title: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: "800",
    color: "#20334f",
    marginTop: 6,
  },

  subtitle: {
    fontSize: 11,
    lineHeight: 18,
    color: "#71829c",
    marginTop: 4,
  },

  branchButton: {
    minHeight: 44,
    padding: 10,
    justifyContent: "center",
  },

  link: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    color: "#345cf2",
  },

  auditGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  auditCard: {
    minWidth: 0,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
  },

  eventTitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: "#20334f",
  },

  eventDetail: {
    fontSize: 11,
    lineHeight: 18,
    color: "#71829c",
    marginTop: 12,
  },

  eventFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 6,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    marginTop: 16,
    paddingTop: 12,
  },

  actor: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 16,
    color: "#71829c",
  },

  timestamp: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 16,
    color: "#71829c",
  },

  empty: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    gap: 8,
  },

  error: {
    fontSize: 13,
    lineHeight: 20,
    color: "#b94d61",
  },

  footer: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    color: "#8192ad",
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
    backgroundColor: "#fff",
    borderRadius: 18,
  },

  branchOption: {
    minHeight: 48,
    padding: 12,
    justifyContent: "center",
  },
});
