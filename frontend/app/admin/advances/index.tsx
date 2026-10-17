import { useDesktopStyles } from "../../../src/ui/useDesktopStyles";
import { AppIcon } from "../../../src/ui/AppIcon";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

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

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import { api, getSessionApi } from "../../../src/core/api/client";
import { getAvailableBranches } from "../../../src/core/admin/available-branches";

import {
  AdminBottomNavigation,
} from "../../../src/ui/AdminBottomNavigation";

import {
  useAdminViewport,
} from "../../../src/ui/useAdminViewport";

// =====================================================
// TYPES
// =====================================================

type Company = {
  id: string;
  name: string;
  status?: string;
};

type Branch = {
  id: string;
  companyId: string;
  name: string;
  status?: string;
};

type AdvanceStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

type Advance = {
  id: string;
  amount: string;
  reason: string;
  status: AdvanceStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;

  employee?: {
    id: string;
    name: string;
    email: string;
  };

  reviewedBy?: {
    id: string;
    name: string;
  } | null;
};

type PickerType = "company" | "branch" | null;
type ReviewAction = "approve" | "reject";

type StatusFilter =
  | "ALL"
  | AdvanceStatus;

const FILTERS: StatusFilter[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

// =====================================================
// HELPERS
// =====================================================

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          status?: number;
          data?: {
            message?: string | string[];
          };
        };
      }
    ).response;

    if (response?.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (response?.status === 403) {
      return "You do not have permission to manage salary advances for this company or branch.";
    }

    if (response?.status === 404) {
      return "The selected record could not be found.";
    }

    if (response?.status === 409) {
      return "This request has already changed. Refresh and try again.";
    }

    const message = response?.data?.message;

    if (typeof message === "string") {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(", ");
    }
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function formatAmount(value: string): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Amount unavailable";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function expectArray<T>(
  value: unknown,
  label: string,
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `Unexpected ${label} API response.`,
    );
  }

  return value as T[];
}

// =====================================================
// ADMIN SALARY ADVANCES
// =====================================================

export default function AdminAdvancesScreen() {
  const styles = useDesktopStyles(baseStyles);

  const router = useRouter();
  const { desktop } = useAdminViewport();

  // Company / branch data
  const [companies, setCompanies] =
    useState<Company[]>([]);

  const [branches, setBranches] =
    useState<Branch[]>([]);

  const [companyId, setCompanyId] =
    useState("");

  const [branchId, setBranchId] =
    useState("");

  // Request data
  const [advances, setAdvances] =
    useState<Advance[]>([]);

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  // Loading and errors
  const [companiesLoading, setCompaniesLoading] =
    useState(true);

  const [branchesLoading, setBranchesLoading] =
    useState(false);

  const [advancesLoading, setAdvancesLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  // Dropdown / review modals
  const [picker, setPicker] =
    useState<PickerType>(null);

  const [reviewItem, setReviewItem] =
    useState<Advance | null>(null);

  const [reviewAction, setReviewAction] =
    useState<ReviewAction>("approve");

  const [reviewNote, setReviewNote] =
    useState("");

  const [reviewError, setReviewError] =
    useState("");

  // ===================================================
  // REFRESH WHEN SCREEN RECEIVES FOCUS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  // ===================================================
  // LOAD COMPANIES
  // ===================================================

  useEffect(() => {
    let active = true;

    async function loadCompanies() {
      setCompaniesLoading(true);
      setError("");

      try {
        const session = await getSessionApi();
        const records: Company[] = session.memberships
          .filter(membership => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'PAYROLL_MANAGER'].includes(membership.role))
          .filter((membership, index, memberships) => memberships.findIndex(item => item.companyId === membership.companyId) === index)
          .map(membership => ({ id: membership.companyId, name: membership.companyName, status: 'ACTIVE' }));

        const available = records.filter(
          (company) =>
            company.id &&
            company.name &&
            company.status !== "INACTIVE",
        );

        if (!active) return;

        setCompanies(available);

        setCompanyId((previous) => {
          const existing = available.find(
            (company) =>
              company.id === previous,
          );

          return existing?.id ??
            available[0]?.id ??
            "";
        });
      } catch (reason) {
        if (!active) return;

        setCompanies([]);
        setCompanyId("");
        setBranches([]);
        setBranchId("");
        setAdvances([]);

        setError(errorMessage(reason));
      } finally {
        if (active) {
          setCompaniesLoading(false);
        }
      }
    }

    void loadCompanies();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // ===================================================
  // LOAD BRANCHES FOR SELECTED COMPANY
  // ===================================================

  useEffect(() => {
    let active = true;

    setBranches([]);
    setBranchId("");
    setAdvances([]);

    if (!companyId) {
      setBranchesLoading(false);

      return () => {
        active = false;
      };
    }

    async function loadBranches() {
      setBranchesLoading(true);
      setError("");

      try {
        const available = await getAvailableBranches(companyId);

        if (!active) return;

        setBranches(available);
        setBranchId(
          available[0]?.id ?? "",
        );
      } catch (reason) {
        if (!active) return;

        setBranches([]);
        setBranchId("");
        setAdvances([]);

        setError(errorMessage(reason));
      } finally {
        if (active) {
          setBranchesLoading(false);
        }
      }
    }

    void loadBranches();

    return () => {
      active = false;
    };
  }, [companyId, refreshKey]);

  // ===================================================
  // LOAD SALARY ADVANCE REQUESTS
  // ===================================================

  useEffect(() => {
    let active = true;

    setAdvances([]);

    if (!companyId || !branchId) {
      setAdvancesLoading(false);

      return () => {
        active = false;
      };
    }

    async function loadAdvances() {
      setAdvancesLoading(true);
      setError("");

      try {
        const response = await api.get<unknown>(
          "/advances",
          {
            params: {
              companyId,
              branchId,
            },
          },
        );

        const records = expectArray<Advance>(
          response.data,
          "salary advances",
        );

        if (!active) return;

        setAdvances(records);
      } catch (reason) {
        if (!active) return;

        setAdvances([]);
        setError(errorMessage(reason));
      } finally {
        if (active) {
          setAdvancesLoading(false);
        }
      }
    }

    void loadAdvances();

    return () => {
      active = false;
    };
  }, [companyId, branchId, refreshKey]);

  // ===================================================
  // SELECT COMPANY
  // ===================================================

  function selectCompany(company: Company) {
    if (saving) return;

    setPicker(null);
    setSuccess("");
    setError("");

    if (company.id !== companyId) {
      setCompanyId(company.id);
      setBranchId("");
      setAdvances([]);
    }
  }

  // ===================================================
  // SELECT BRANCH
  // ===================================================

  function selectBranch(branch: Branch) {
    if (saving) return;

    setPicker(null);
    setSuccess("");
    setError("");

    if (branch.id !== branchId) {
      setBranchId(branch.id);
      setAdvances([]);
    }
  }

  // ===================================================
  // REVIEW CONTROLS
  // ===================================================

  function openReview(
    advance: Advance,
    action: ReviewAction,
  ) {
    if (
      saving ||
      advance.status !== "PENDING"
    ) {
      return;
    }

    setReviewItem(advance);
    setReviewAction(action);
    setReviewNote("");
    setReviewError("");
  }

  function closeReview() {
    if (saving) return;

    setReviewItem(null);
    setReviewNote("");
    setReviewError("");
  }

  async function submitReview() {
    if (
      saving ||
      !reviewItem ||
      reviewItem.status !== "PENDING"
    ) {
      return;
    }

    const note = reviewNote.trim();

    if (note.length > 1000) {
      setReviewError(
        "Review note cannot exceed 1000 characters.",
      );
      return;
    }

    setSaving(true);
    setReviewError("");
    setSuccess("");

    try {
      await api.patch(
        `/advances/${reviewItem.id}/${reviewAction}`,
        {
          note: note || undefined,
        },
      );

      setReviewItem(null);
      setReviewNote("");

      setSuccess(
        reviewAction === "approve"
          ? "Salary advance approved successfully."
          : "Salary advance rejected successfully.",
      );

      setRefreshKey(
        (value) => value + 1,
      );
    } catch (reason) {
      setReviewError(
        errorMessage(reason),
      );
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // REFRESH
  // ===================================================

  function refreshRequests() {
    setSuccess("");

    setRefreshKey(
      (value) => value + 1,
    );
  }

  // ===================================================
  // DERIVED DATA
  // ===================================================

  const selectedCompany =
    companies.find(
      (company) =>
        company.id === companyId,
    );

  const selectedBranch =
    branches.find(
      (branch) =>
        branch.id === branchId,
    );

  const visible = advances.filter(
    (advance) =>
      statusFilter === "ALL" ||
      advance.status === statusFilter,
  );

  const pendingCount = advances.filter(
    (advance) =>
      advance.status === "PENDING",
  ).length;

  const approvedCount = advances.filter(
    (advance) =>
      advance.status === "APPROVED",
  ).length;

  const rejectedCount = advances.filter(
    (advance) =>
      advance.status === "REJECTED",
  ).length;

  const busy =
    companiesLoading ||
    branchesLoading ||
    advancesLoading;

  // ===================================================
  // UI
  // ===================================================

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER */}

          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Admin More"
              onPress={() =>
                router.push("/admin/more")
              }
              style={styles.back}
            >
              <AppIcon symbol="‹" style={styles.backText} />
            </Pressable>

            <View style={styles.flex}>
              <Text style={styles.eyebrow}>
                BRANCHSUITE BUSINESS
              </Text>

              <Text style={styles.title}>
                Salary Advances
              </Text>

              <Text style={styles.subtitle}>
                Review employee advance requests.
              </Text>
            </View>
          </View>

          {/* COMPANY AND BRANCH */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Company and branch
            </Text>

            <Text style={styles.secondary}>
              Select your workspace.
              Requests are filtered by the
              selected branch.
            </Text>

            <Text style={styles.label}>
              Company
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select company"
              disabled={
                companiesLoading ||
                saving
              }
              onPress={() =>
                setPicker("company")
              }
              style={styles.selector}
            >
              <Text style={styles.selectorText}>
                {companiesLoading
                  ? "Loading companies..."
                  : selectedCompany?.name ||
                    "Select company"}
              </Text>

              <AppIcon symbol="⌄" style={styles.chevron} />
            </Pressable>

            <Text style={styles.label}>
              Branch
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select branch"
              disabled={
                !companyId ||
                branchesLoading ||
                saving
              }
              onPress={() =>
                setPicker("branch")
              }
              style={styles.selector}
            >
              <Text style={styles.selectorText}>
                {branchesLoading
                  ? "Loading branches..."
                  : selectedBranch?.name ||
                    "Select branch"}
              </Text>

              <AppIcon symbol="⌄" style={styles.chevron} />
            </Pressable>

            {!companiesLoading &&
              companies.length === 0 && (
                <Text style={styles.secondary}>
                  No active companies were returned
                  for this account.
                </Text>
              )}

            {!branchesLoading &&
              !!companyId &&
              branches.length === 0 && (
                <Text style={styles.secondary}>
                  No active branches are available
                  for the selected company.
                </Text>
              )}
          </View>

          {/* FEEDBACK */}

          {!!error && (
            <View style={styles.errorCard}>
              <Text
                accessibilityRole="alert"
                style={styles.errorText}
              >
                {error}
              </Text>
            </View>
          )}

          {!!success && (
            <View style={styles.successCard}>
              <Text style={styles.successText}>
                {success}
              </Text>
            </View>
          )}

          {/* REQUEST COUNTS */}

          {!!branchId && !busy && !error && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {pendingCount}
                </Text>
                <Text style={styles.summaryLabel}>
                  Pending
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {approvedCount}
                </Text>
                <Text style={styles.summaryLabel}>
                  Approved
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {rejectedCount}
                </Text>
                <Text style={styles.summaryLabel}>
                  Rejected
                </Text>
              </View>
            </View>
          )}

          {/* REQUEST LIST HEADING */}

          <View style={styles.listHeader}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>
                Advance requests
              </Text>

              <Text style={styles.secondary}>
                {selectedBranch
                  ? `${selectedBranch.name} · ${advances.length} requests`
                  : "Select a branch to view requests"}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh salary advances"
              disabled={saving || busy}
              onPress={refreshRequests}
              style={[
                styles.refresh,
                (saving || busy) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.link}>
                Refresh
              </Text>
            </Pressable>
          </View>

          {/* STATUS FILTERS */}

          {!!branchId && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                styles.filters
              }
            >
              {FILTERS.map((filter) => (
                <Pressable
                  key={filter}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected:
                      statusFilter === filter,
                  }}
                  onPress={() =>
                    setStatusFilter(filter)
                  }
                  style={[
                    styles.filter,
                    statusFilter === filter &&
                      styles.filterActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      statusFilter === filter &&
                        styles.filterTextActive,
                    ]}
                  >
                    {filter === "ALL"
                      ? "All"
                      : filter}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* LOADING */}

          {busy ? (
            <View style={styles.card}>
              <ActivityIndicator
                color="#345CF2"
                size="large"
              />

              <Text style={styles.secondary}>
                Loading workspace data...
              </Text>
            </View>
          ) : !branchId ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                No branch selected
              </Text>

              <Text style={styles.secondary}>
                Select an available company
                and branch to view employee
                salary advance requests.
              </Text>
            </View>
          ) : error ? null : visible.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                No requests found
              </Text>

              <Text style={styles.secondary}>
                There are no matching salary
                advance requests for this branch.
              </Text>
            </View>
          ) : (
            // ==========================================
            // REQUEST CARDS
            // ==========================================

            <View style={styles.grid}>
              {visible.map((advance) => (
                <View
                  key={advance.id}
                  style={[
                    styles.card,
                    {
                      width: desktop
                        ? "48%"
                        : "100%",
                    },
                  ]}
                >
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.employeeName}>
                        {advance.employee?.name ||
                          "Employee"}
                      </Text>

                      <Text style={styles.secondary}>
                        {advance.employee?.email ||
                          ""}
                      </Text>
                    </View>

                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {advance.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.amount}>
                    {formatAmount(
                      advance.amount,
                    )}
                  </Text>

                  <Text style={styles.label}>
                    Reason
                  </Text>

                  <Text style={styles.body}>
                    {advance.reason}
                  </Text>

                  <Text style={styles.secondary}>
                    Requested:{" "}
                    {formatDate(
                      advance.createdAt,
                    )}
                  </Text>

                  {advance.reviewedAt && (
                    <Text style={styles.secondary}>
                      Reviewed:{" "}
                      {formatDate(
                        advance.reviewedAt,
                      )}
                    </Text>
                  )}

                  {!!advance.reviewNote && (
                    <View style={styles.noteBox}>
                      <Text style={styles.label}>
                        Review note
                      </Text>

                      <Text style={styles.body}>
                        {advance.reviewNote}
                      </Text>
                    </View>
                  )}

                  {advance.status ===
                    "PENDING" && (
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() =>
                          openReview(
                            advance,
                            "approve",
                          )
                        }
                        style={[
                          styles.approveButton,
                          saving &&
                            styles.disabled,
                        ]}
                      >
                        <Text
                          style={styles.whiteText}
                        >
                          Approve
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() =>
                          openReview(
                            advance,
                            "reject",
                          )
                        }
                        style={[
                          styles.rejectButton,
                          saving &&
                            styles.disabled,
                        ]}
                      >
                        <Text
                          style={styles.rejectText}
                        >
                          Reject
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* MOBILE NAVIGATION */}

        {!desktop && (
          <AdminBottomNavigation
            disabled={saving}
          />
        )}

        {/* COMPANY / BRANCH PICKER */}

        <Modal
          visible={picker !== null}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setPicker(null)
          }
        >
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <View style={styles.row}>
                <Text style={styles.modalTitle}>
                  {picker === "company"
                    ? "Select company"
                    : "Select branch"}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setPicker(null)
                  }
                >
                  <Text style={styles.link}>
                    Close
                  </Text>
                </Pressable>
              </View>

              <ScrollView>
                {picker === "company"
                  ? companies.map((company) => (
                      <Pressable
                        key={company.id}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected:
                            companyId === company.id,
                        }}
                        onPress={() =>
                          selectCompany(company)
                        }
                        style={styles.option}
                      >
                        <Text style={styles.body}>
                          {company.name}
                        </Text>

                        {companyId ===
                          company.id && (
                          <AppIcon symbol="✓" style={styles.link} />
                        )}
                      </Pressable>
                    ))
                  : branches.map((branch) => (
                      <Pressable
                        key={branch.id}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected:
                            branchId === branch.id,
                        }}
                        onPress={() =>
                          selectBranch(branch)
                        }
                        style={styles.option}
                      >
                        <Text style={styles.body}>
                          {branch.name}
                        </Text>

                        {branchId ===
                          branch.id && (
                          <AppIcon symbol="✓" style={styles.link} />
                        )}
                      </Pressable>
                    ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* REVIEW MODAL */}

        <Modal
          visible={reviewItem !== null}
          transparent
          animationType="fade"
          onRequestClose={closeReview}
        >
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                {reviewAction === "approve"
                  ? "Approve salary advance"
                  : "Reject salary advance"}
              </Text>

              {!!reviewItem && (
                <>
                  <Text style={styles.body}>
                    Employee:{" "}
                    {reviewItem.employee?.name ||
                      "Employee"}
                  </Text>

                  <Text style={styles.amount}>
                    {formatAmount(
                      reviewItem.amount,
                    )}
                  </Text>
                </>
              )}

              <Text style={styles.secondary}>
                {reviewAction === "approve"
                  ? "Approval records the decision. It does not automatically transfer money or deduct salary."
                  : "Confirm that you want to reject this advance request."}
              </Text>

              <Text style={styles.label}>
                Review note (optional)
              </Text>

              <TextInput
                value={reviewNote}
                onChangeText={setReviewNote}
                multiline
                maxLength={1000}
                placeholder="Enter review note"
                placeholderTextColor="#8B98AC"
                style={[
                  styles.input,
                  styles.noteInput,
                ]}
              />

              {!!reviewError && (
                <Text
                  accessibilityRole="alert"
                  style={styles.errorText}
                >
                  {reviewError}
                </Text>
              )}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={closeReview}
                  style={styles.cancelButton}
                >
                  <Text style={styles.link}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => {
                    void submitReview();
                  }}
                  style={[
                    styles.confirmButton,
                    saving && styles.disabled,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.whiteText}>
                      {reviewAction === "approve"
                        ? "Confirm approval"
                        : "Confirm rejection"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F8FD",
  },

  page: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },

  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },

  flex: {
    flex: 1,
    minWidth: 0,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E7F0",
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    fontSize: 26,
    color: "#345CF2",
  },

  eyebrow: {
    color: "#71829C",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
  },

  title: {
    color: "#20334F",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 4,
  },

  subtitle: {
    color: "#71829C",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAF5",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },

  cardTitle: {
    color: "#20334F",
    fontSize: 15,
    fontWeight: "700",
  },

  secondary: {
    color: "#71829C",
    fontSize: 12,
    lineHeight: 18,
  },

  label: {
    color: "#405573",
    fontSize: 12,
    fontWeight: "600",
  },

  body: {
    color: "#405573",
    fontSize: 13,
    lineHeight: 20,
  },

  selector: {
    minHeight: 46,
    backgroundColor: "#FAFBFF",
    borderColor: "#DCE3EF",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  selectorText: {
    color: "#20334F",
    fontSize: 13,
    flex: 1,
  },

  chevron: {
    color: "#607591",
    fontSize: 18,
  },

  errorCard: {
    padding: 14,
    backgroundColor: "#FFF2F4",
    borderRadius: 12,
  },

  errorText: {
    color: "#B94D61",
    fontSize: 12,
    lineHeight: 19,
  },

  successCard: {
    padding: 14,
    backgroundColor: "#E8F7EF",
    borderRadius: 12,
  },

  successText: {
    color: "#157347",
    fontSize: 12,
    fontWeight: "600",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },

  summaryCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EAF5",
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },

  summaryValue: {
    color: "#20334F",
    fontSize: 22,
    fontWeight: "800",
  },

  summaryLabel: {
    color: "#71829C",
    fontSize: 11,
  },

  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  sectionTitle: {
    color: "#20334F",
    fontSize: 17,
    fontWeight: "700",
  },

  refresh: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  link: {
    color: "#345CF2",
    fontSize: 12,
    fontWeight: "700",
  },

  disabled: {
    opacity: 0.55,
  },

  filters: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },

  filter: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE3EF",
    borderWidth: 1,
  },

  filterActive: {
    backgroundColor: "#345CF2",
    borderColor: "#345CF2",
  },

  filterText: {
    color: "#405573",
    fontSize: 11,
    fontWeight: "600",
  },

  filterTextActive: {
    color: "#FFFFFF",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    justifyContent: "space-between",
  },

  employeeName: {
    color: "#20334F",
    fontSize: 14,
    fontWeight: "700",
  },

  amount: {
    color: "#20334F",
    fontSize: 23,
    fontWeight: "800",
  },

  statusBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusText: {
    color: "#405573",
    fontSize: 10,
    fontWeight: "700",
  },

  noteBox: {
    padding: 12,
    backgroundColor: "#F5F7FC",
    borderRadius: 10,
    gap: 6,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },

  approveButton: {
    flex: 1,
    minHeight: 42,
    backgroundColor: "#157347",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  rejectButton: {
    flex: 1,
    minHeight: 42,
    backgroundColor: "#FFF0F1",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  whiteText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  rejectText: {
    color: "#B94D61",
    fontSize: 12,
    fontWeight: "700",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(21,43,60,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },

  modalTitle: {
    color: "#20334F",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },

  option: {
    minHeight: 48,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#EDF1F8",
    borderBottomWidth: 1,
  },

  input: {
    minHeight: 46,
    backgroundColor: "#FAFBFF",
    borderColor: "#DCE3EF",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#20334F",
  },

  noteInput: {
    height: 90,
    paddingVertical: 12,
    textAlignVertical: "top",
  },

  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  confirmButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#345CF2",
    justifyContent: "center",
    alignItems: "center",
  },
});
