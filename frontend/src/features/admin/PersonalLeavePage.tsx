import { KeyboardAwareScrollView as ScrollView } from '../../ui/KeyboardAwareScrollView';
import { formSpacing } from '../../shared/theme/formSpacing';
import { useToastState } from '../../ui/useToastState';
import { apiErrorMessage as apiError } from '../../core/admin/http';
import { AdminPageHeading } from '../../ui/AdminPageHeading';
import { FloatingTextInput as TextInput } from "../../ui/FloatingTextInput";
import { AppIcon } from "../../ui/AppIcon";
import { useAdminLayout } from '../../ui/useAdminLayout';
import { webWorkspaceTheme } from '../../ui/webWorkspaceStyles';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ToastModal as Modal } from '../../ui/Toast';

import {
  useRouter,
} from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../core/admin/useWorkspaceFocusEffect';

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  leaveApi,
  type LeaveBalanceDto,
  type LeaveRequestDto,
  type LeaveRequestStatus,
  type LeaveTypeDto,
} from "../../core/admin/api";

import { getAdminScope, selectAdminBranch } from "../../core/admin/scope";
import { useAuth } from '../../core/auth/AuthProvider';
import { AdminBottomNavigation } from "../../ui/AdminBottomNavigation";
import { DatePickerField } from "../../ui/DatePickerField";

type BranchOption = {
  id: string;
  name: string;
};

type Filter = "ALL" | LeaveRequestStatus;

const FILTERS: Filter[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(
    `${value}T00:00:00.000Z`,
  );

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function displayDate(value: string): string {
  const date = new Date(
    `${value.slice(0, 10)}T00:00:00.000Z`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}



function canCancel(
  request: LeaveRequestDto,
): boolean {
  if (request.status === "PENDING") {
    return true;
  }

  return (
    request.status === "APPROVED" &&
    request.startDate.slice(0, 10) > todayUTC()
  );
}

export default function PersonalLeavePage({
  autoApply = false,
  initialBranchId = "",
}: {
  autoApply?: boolean;
  initialBranchId?: string;
}) {
  const { styles } = useAdminLayout(baseStyles, 'form');
  const router = useRouter();
  const { session } = useAuth();

  const [companyId, setCompanyId] =
    useState("");

  const [userId, setUserId] =
    useState("");

  const [userName, setUserName] =
    useState("Admin");

  const [branches, setBranches] =
    useState<BranchOption[]>([]);

  const [branchId, setBranchId] =
    useState(initialBranchId);

  const [types, setTypes] =
    useState<LeaveTypeDto[]>([]);

  const [canConfigureTypes, setCanConfigureTypes] = useState(false);
  const [typesError, setTypesError] = useToastState("", 'error');

  const [requests, setRequests] =
    useState<LeaveRequestDto[]>([]);

  const [balances, setBalances] =
    useState<LeaveBalanceDto[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const busyRef = useRef(false);
  const applicationOpenedRef = useRef(false);

  const [loadError, setLoadError] =
    useToastState("", 'error');

  const [notice, setNotice] =
    useToastState("", 'success');

  const [refreshVersion, setRefreshVersion] =
    useState(0);

  const [filter, setFilter] =
    useState<Filter>("ALL");

  const [applyOpen, setApplyOpen] =
    useState(false);

  const [cancelId, setCancelId] =
    useState<string | null>(null);

  const [cancelError, setCancelError] =
    useToastState("", 'error');

  const [leaveTypeId, setLeaveTypeId] =
    useState("");

  const [startDate, setStartDate] =
    useState(todayUTC());

  const [endDate, setEndDate] =
    useState(todayUTC());

  const [reason, setReason] =
    useState("");

  const [formError, setFormError] =
    useToastState("", 'error');

  const refresh = useCallback(() => {
    setRefreshVersion(
      (version) => version + 1,
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setLoadError("");
        setTypesError("");
        setRequests([]);
        setBalances([]);

        try {
          const scope =
            await getAdminScope();

          const availableBranches: BranchOption[] =
            scope.branches.map(
              (branch) => ({
                id: branch.id,
                name: branch.name,
              }),
            );

          if (!availableBranches.length) throw new Error('Your account does not have a branch assignment. Contact the business administrator.');
          const selectedId = scope.branchId ?? '';
          const requestBranches = selectedId ? availableBranches.filter(branch => branch.id === selectedId) : availableBranches;
          // Balances belong to the company, so authorize the read through an
          // actual assignment even when an owner can browse other branches.
          const balanceBranchId = session?.memberships.find(item => item.companyId === scope.companyId)?.branches
            .find(branch => availableBranches.some(available => available.id === branch.id))?.id
            ?? (selectedId || availableBranches[0].id);

          const results = await Promise.allSettled([
            leaveApi.types(scope.companyId),
            leaveApi.myRequests(scope.companyId, selectedId || undefined),
            leaveApi.myBalances(
              scope.companyId,
              balanceBranchId,
              currentYear(),
            ),
          ] as const);

          if (!active) return;

          setCompanyId(scope.companyId);
          setUserId(scope.user.id);
          setUserName(scope.user.name);
          setCanConfigureTypes(
            ["BUSINESS_OWNER", "BUSINESS_ADMIN", "HR_MANAGER"].includes(scope.role),
          );
          setBranches(availableBranches);
          setBranchId(selectedId);

          const errors: string[] = [];

          const [
            typesResult,
            requestsResult,
            balancesResult,
          ] = results;

          if (
            typesResult.status === "fulfilled" &&
            Array.isArray(typesResult.value)
          ) {
            const activeTypes =
              typesResult.value.filter(
                (type) =>
                  type.companyId ===
                    scope.companyId &&
                  type.status === "ACTIVE",
              );

            setTypes(activeTypes);

            setLeaveTypeId((previous) =>
              activeTypes.some(
                (type) =>
                  type.id === previous,
              )
                ? previous
                : activeTypes[0]?.id ?? "",
            );
          } else {
            setTypes([]);
            const message = typesResult.status === "rejected"
              ? `Leave types: ${apiError(typesResult.reason)}`
              : "Invalid leave type response. Please retry loading.";
            setTypesError(message);
            errors.push(message);
          }

          if (
            requestsResult.status === "fulfilled" &&
            Array.isArray(requestsResult.value)
          ) {
            setRequests(
              requestsResult.value
                .filter(
                  (request) =>
                    request.companyId ===
                      scope.companyId &&
                    requestBranches.some(branch => branch.id === request.branchId) &&
                    request.userId ===
                      scope.user.id,
                )
                .sort(
                  (a, b) =>
                    b.createdAt.localeCompare(
                      a.createdAt,
                    ),
                ),
            );
          } else {
            setRequests([]);

            errors.push(
              requestsResult.status === "rejected"
                ? `Requests: ${apiError(
                    requestsResult.reason,
                  )}`
                : "Invalid leave request response.",
            );
          }

          if (
            balancesResult.status === "fulfilled" &&
            Array.isArray(balancesResult.value)
          ) {
            setBalances(
              balancesResult.value.filter(
                (balance) =>
                  balance.companyId ===
                    scope.companyId &&
                  balance.userId ===
                    scope.user.id &&
                  balance.year ===
                    currentYear(),
              ),
            );
          } else {
            setBalances([]);

            errors.push(
              balancesResult.status === "rejected"
                ? `Balances: ${apiError(
                    balancesResult.reason,
                  )}`
                : "Invalid leave balance response.",
            );
          }

          setLoadError(
            errors.join("\n"),
          );
        } catch (error) {
          if (active) {
            setTypes([]);
            setTypesError(apiError(error));
            setLoadError(
              apiError(error),
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void load();

      return () => {
        active = false;
      };
    }, [refreshVersion, session]),
  );

  const filteredRequests =
    requests.filter(
      (request) =>
        filter === "ALL" ||
        request.status === filter,
    );

  const selectedCancelRequest =
    requests.find(
      (request) =>
        request.id === cancelId,
    );

  const canApply =
    !loading &&
    !saving &&
    Boolean(companyId) &&
    Boolean(branchId) &&
    types.length > 0;

  function openApplication() {
    if (!canApply) return;

    setStartDate(todayUTC());
    setEndDate(todayUTC());
    setReason("");
    setFormError("");
    setNotice("");

    setLeaveTypeId(
      types.some(
        (type) =>
          type.id === leaveTypeId,
      )
        ? leaveTypeId
        : types[0].id,
    );

    setApplyOpen(true);
  }

  useEffect(() => {
    if (autoApply && canApply && !applicationOpenedRef.current) {
      applicationOpenedRef.current = true;
      openApplication();
    }
  }, [autoApply, canApply]);

  async function submit() {
    if (busyRef.current) return;

    if (
      !companyId ||
      !branchId ||
      !userId ||
      !leaveTypeId
    ) {
      setFormError(
        "A company, branch and leave type are required.",
      );
      return;
    }

    if (
      !types.some(
        (type) =>
          type.id === leaveTypeId,
      )
    ) {
      setFormError(
        "Select a valid leave type.",
      );
      return;
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate)
    ) {
      setFormError(
        "Enter valid dates as YYYY-MM-DD.",
      );
      return;
    }

    if (
      startDate < todayUTC() ||
      endDate < startDate
    ) {
      setFormError(
        "Choose dates from today onwards.",
      );
      return;
    }

    if (
      startDate.slice(0, 4) !==
      endDate.slice(0, 4)
    ) {
      setFormError(
        "Split cross-year leave into separate requests.",
      );
      return;
    }

    if (!reason.trim()) {
      setFormError(
        "Please enter a reason.",
      );
      return;
    }

    const overlaps =
      requests.some(
        (request) =>
          (request.status === "PENDING" ||
            request.status === "APPROVED") &&
          startDate <=
            request.endDate.slice(0, 10) &&
          endDate >=
            request.startDate.slice(0, 10),
      );

    if (overlaps) {
      setFormError(
        "These dates overlap another pending or approved leave request.",
      );
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setFormError("");
    setNotice("");

    try {
      const created =
        await leaveApi.apply({
          companyId,
          branchId,
          leaveTypeId,
          startDate,
          endDate,
          reason: reason.trim(),
        });

      setRequests((current) => [
        created,
        ...current.filter(
          (request) =>
            request.id !== created.id,
        ),
      ]);

      setApplyOpen(false);
      setNotice(
        "Leave request submitted successfully. It will remain pending until reviewed by another authorized administrator.",
      );

      refresh();
    } catch (error) {
      setFormError(
        apiError(error),
      );

      // Re-fetch after failed responses because
      // the server could have processed the request.
      refresh();
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  function openCancellation(id: string) {
    if (saving) return;

    const request =
      requests.find(
        (entry) =>
          entry.id === id,
      );

    if (
      !request ||
      !canCancel(request)
    ) {
      setNotice(
        "This request is no longer eligible for cancellation.", 'info',
      );
      refresh();
      return;
    }

    setCancelError("");
    setNotice("");
    setCancelId(id);
  }

  function closeCancellation() {
    if (saving) return;

    setCancelId(null);
    setCancelError("");
  }

  async function confirmCancellation() {
    if (
      !cancelId ||
      busyRef.current
    ) {
      return;
    }

    const request =
      requests.find(
        (entry) =>
          entry.id === cancelId,
      );

    if (
      !request ||
      !canCancel(request)
    ) {
      setCancelError(
        "This request is not eligible for cancellation.",
      );
      refresh();
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setCancelError("");
    setNotice("");

    try {
      const updated =
        await leaveApi.cancel(
          request.id,
        );

      setRequests(
        (current) =>
          current.map(
            (entry) =>
              entry.id === updated.id
                ? updated
                : entry,
          ),
      );

      setCancelId(null);
      setNotice(
        "Your leave request was cancelled successfully.",
      );

      refresh();
    } catch (error) {
      setCancelError(
        apiError(error),
      );

      refresh();
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <AdminPageHeading title="My leave" style={styles.sectionHeader} onBack={() => router.replace('/admin/attendance')} backDisabled={saving}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh leave"
              disabled={loading || saving}
              onPress={refresh}
              style={[styles.backButton, Platform.OS === 'web' && { flexDirection: 'row', alignItems: 'center', gap: 7 }]}
            >
              <AppIcon name="refresh-cw" size={16} color="#345cf2" />
              {Platform.OS === 'web' && <Text style={styles.backText}>Refresh</Text>}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={!canApply}
              onPress={openApplication}
              style={[
                styles.primary,
                !canApply &&
                  styles.dim,
              ]}
            >
              <Text style={styles.primaryText}>
                + Apply
              </Text>
            </Pressable>
            </View>
          </AdminPageHeading>

          <View style={styles.wrap}>
            {[{ id: '', name: 'All branches' }, ...branches].map((branch) => (
              <Pressable
                key={branch.id}
                accessibilityRole="button"
                accessibilityLabel={`Personal leave branch: ${branch.name}`}
                accessibilityState={{ selected: branchId === branch.id }}
                disabled={
                  loading || saving
                }
                onPress={() => {
                  void selectAdminBranch(branch.id || null).then(() => { setNotice(''); setBranchId(branch.id); setApplyOpen(false); }).catch(error => setLoadError(apiError(error)));
                }}
                style={[
                  styles.option,
                  branchId === branch.id &&
                    styles.selected,
                ]}
              >
                <Text
                  style={styles.optionText}
                >
                  {branch.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {!branchId && !loading && <Text style={styles.muted}>Select a branch to apply for leave. Leave balances are shared across the company.</Text>}

          {!!notice && (
            <View style={styles.noticeBox}>
              <Text
                accessibilityLiveRegion="polite"
                style={styles.notice}
              >
                {notice}
              </Text>
            </View>
          )}

          {!!loadError && (
            <View style={styles.errorBox}>
              <Text style={styles.error}>
                {loadError}
              </Text>

              <Pressable
                onPress={refresh}
                style={styles.retry}
              >
                <Text style={styles.link}>
                  Retry loading
                </Text>
              </Pressable>
            </View>
          )}

          {loading ? (
            <ActivityIndicator
              color="#345CF2"
              size="large"
            />
          ) : (
            <>
              {types.length > 0 && (
                <Text style={styles.heading}>
                  Leave balances · {currentYear()}
                </Text>
              )}

              <View style={styles.balanceGrid}>
                {types.map((type) => {
                  const balance =
                    balances.find(
                      (item) =>
                        item.leaveTypeId ===
                        type.id,
                    );

                  const pending =
                    requests
                      .filter(
                        (request) =>
                          request.leaveTypeId ===
                            type.id &&
                          request.status ===
                            "PENDING" &&
                          request.startDate.slice(
                            0,
                            4,
                          ) ===
                            String(currentYear()),
                      )
                      .reduce(
                        (sum, request) =>
                          sum +
                          Number(
                            request.days,
                          ),
                        0,
                      );

                  return (
                    <View
                      key={type.id}
                      style={styles.balanceCard}
                    >
                      <Text
                        style={styles.cardTitle}
                      >
                        {type.name}
                      </Text>

                      <Text
                        style={styles.balanceNumber}
                      >
                        {balance
                          ? `${balance.remainingDays} days`
                          : "Not allocated"}
                      </Text>

                      <Text style={styles.muted}>
                        Policy allowance:{" "}
                        {type.annualAllowance}
                      </Text>

                      <Text style={styles.muted}>
                        Pending: {pending} days
                      </Text>

                      <Text style={styles.muted}>
                        {type.isPaid
                          ? "Paid leave"
                          : "Unpaid leave"}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {types.length === 0 && !typesError && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    Set up leave before applying
                  </Text>

                  <Text style={styles.muted}>
                    {canConfigureTypes
                      ? "Your company has no active leave types. Add the leave names, paid status and annual allowances your company uses, then return here to apply."
                      : "Your company has no active leave types. Ask HR or your company administrator to configure them before you apply."}
                  </Text>
                  {canConfigureTypes && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({
                        pathname: "/admin/leave-management",
                        params: { tab: "types", returnTo: "attendance", branchId },
                      })}
                      style={styles.primary}
                    >
                      <Text style={styles.primaryText}>Set up leave types</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <View style={styles.headerRow}>
                <Text style={styles.heading}>
                  My requests
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh leave requests"
                  style={styles.refreshRequests}
                  disabled={saving}
                  onPress={refresh}
                >
                  <Text style={styles.link}>
                    Refresh
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.wrap}
              >
                {FILTERS.map((status) => (
                  <Pressable
                    key={status}
                    accessibilityRole="tab"
                    accessibilityState={{
                      selected:
                        filter === status,
                    }}
                    onPress={() =>
                      setFilter(status)
                    }
                    style={[
                      styles.option,
                      filter === status &&
                        styles.selected,
                    ]}
                  >
                    <Text
                      style={styles.optionText}
                    >
                      {status === "ALL"
                        ? "All"
                        : status[0] +
                          status
                            .slice(1)
                            .toLowerCase()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {filteredRequests.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    No matching leave requests
                  </Text>

                  <Text style={styles.muted}>
                    Your submitted leave requests
                    will appear here.
                  </Text>
                </View>
              ) : (
                filteredRequests.map(
                  (request) => {
                    const type =
                      types.find(
                        (entry) =>
                          entry.id ===
                          request.leaveTypeId,
                      );

                    return (
                      <View
                        key={request.id}
                        testID={`personal-leave-request-${request.id}`}
                        style={styles.card}
                      >
                        <View
                          style={
                            styles.headerRow
                          }
                        >
                          <View
                            style={
                              styles.flex
                            }
                          >
                            <Text
                              style={
                                styles.cardTitle
                              }
                            >
                              {userName}
                            </Text>

                            <Text
                              style={
                                styles.muted
                              }
                            >
                              {type?.name ??
                                request
                                  .leaveType
                                  ?.name ??
                                "Leave"}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              request.status ===
                                "APPROVED" &&
                                styles.approved,
                              request.status ===
                                "REJECTED" &&
                                styles.rejected,
                              request.status ===
                                "CANCELLED" &&
                                styles.cancelled,
                            ]}
                          >
                            <Text
                              style={
                                styles.statusText
                              }
                            >
                              {request.status}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={styles.dates}
                        >
                          {displayDate(
                            request.startDate,
                          )}
                          {" – "}
                          {displayDate(
                            request.endDate,
                          )}
                          {" · "}
                          {request.days}
                          {" day(s)"}
                        </Text>

                        <Text
                          style={styles.muted}
                        >
                          {request.reason}{'\n'}{branches.find(branch => branch.id === request.branchId)?.name ?? 'Branch'}
                        </Text>

                        {!!request.reviewNote && (
                          <Text
                            style={
                              styles.muted
                            }
                          >
                            Review note:{" "}
                            {request.reviewNote}
                          </Text>
                        )}

                        {request.status ===
                          "PENDING" && (
                          <Text
                            style={
                              styles.pendingNote
                            }
                          >
                            Awaiting review.
                            Self-approval is
                            disabled.
                          </Text>
                        )}

                        {canCancel(request) && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Cancel leave request for ${displayDate(
                              request.startDate,
                            )}`}
                            disabled={saving}
                            onPress={() =>
                              openCancellation(
                                request.id,
                              )
                            }
                            style={[
                              styles.cancelButton,
                              saving &&
                                styles.dim,
                            ]}
                          >
                            <Text
                              style={
                                styles.cancelButtonText
                              }
                            >
                              Cancel request
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  },
                )
              )}
            </>
          )}
        </ScrollView>

        <AdminBottomNavigation
          disabled={saving}
        />
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={applyOpen}
        onRequestClose={() => {
          if (!saving) {
            setApplyOpen(false);
          }
        }}
      >
        <View
          style={styles.overlay}

        >
          <View
            style={styles.modal}
          >
            <Text style={styles.heading}>
              Apply for leave
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Text style={styles.label}>
                Leave type *
              </Text>

              <View style={styles.wrap}>
                {types.map((type) => (
                  <Pressable
                    key={type.id}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked:
                        leaveTypeId ===
                        type.id,
                    }}
                    disabled={saving}
                    onPress={() =>
                      setLeaveTypeId(
                        type.id,
                      )
                    }
                    style={[
                      styles.option,
                      leaveTypeId ===
                        type.id &&
                        styles.selected,
                    ]}
                  >
                    <Text
                      style={
                        styles.optionText
                      }
                    >
                      {type.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>
                Start date *
              </Text>

              <DatePickerField hideLabel label="Start date" value={startDate} onChange={setStartDate} minDate={todayUTC()} maxDate={endDate || undefined} disabled={saving} style={styles.input} />

              <Text style={styles.label}>
                End date *
              </Text>

              <DatePickerField hideLabel label="End date" value={endDate} onChange={setEndDate} minDate={startDate || todayUTC()} disabled={saving} style={styles.input} />



              <TextInput validation={{ required: true, maxLength: 2000 }} label={"Reason *"}
                multiline
                accessibilityLabel="Reason for leave"
                style={[
                  styles.input,
                  styles.reasonInput,
                ]}
                value={reason}
                onChangeText={setReason}
                editable={!saving}
              />

              {!!formError && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {formError}
                </Text>
              )}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() =>
                void submit()
              }
              style={[
                styles.primary,
                saving && styles.dim,
              ]}
            >
              <Text
                style={styles.primaryText}
              >
                {saving
                  ? "Submitting..."
                  : "Submit leave request"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() =>
                setApplyOpen(false)
              }
              style={styles.secondary}
            >
              <Text
                style={
                  styles.secondaryText
                }
              >
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={cancelId !== null}
        onRequestClose={
          closeCancellation
        }
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.heading}>
              Cancel leave request
            </Text>

            {!!selectedCancelRequest && (
              <Text style={styles.dates}>
                {displayDate(
                  selectedCancelRequest.startDate,
                )}
                {" – "}
                {displayDate(
                  selectedCancelRequest.endDate,
                )}
                {" · "}
                {selectedCancelRequest.days}
                {" day(s)"}
              </Text>
            )}

            <Text style={styles.subtitle}>
              This will change the leave status
              to Cancelled. Future approved
              paid leave will be refunded
              according to the backend balance rules.
            </Text>

            {!!cancelError && (
              <Text
                accessibilityLiveRegion="polite"
                style={styles.error}
              >
                {cancelError}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() =>
                void confirmCancellation()
              }
              style={[
                styles.primary,
                styles.dangerButton,
                saving && styles.dim,
              ]}
            >
              <Text
                style={styles.primaryText}
              >
                {saving
                  ? "Cancelling..."
                  : "Confirm cancellation"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={
                closeCancellation
              }
              style={styles.secondary}
            >
              <Text
                style={
                  styles.secondaryText
                }
              >
                Keep request
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const web = Platform.OS === 'web';
const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F8FD",
  },
  page: {
    flex: 1,
    alignSelf: "center",
    width: "100%",
    maxWidth: 900,
  },
  content: {
    padding: 20,
    paddingBottom: 50,
    gap: 15,
  },
  sectionHeader: {
    marginBottom: 0,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#20334F",
  },
  subtitle: {
    fontSize: 12,
    color: "#71849F",
    lineHeight: 20,
  },
  heading: {
    fontSize: 17,
    fontWeight: "800",
    color: "#20334F",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
    marginTop: formSpacing.field,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#20334F",
  },
  muted: {
    fontSize: 12,
    color: "#71849F",
    lineHeight: 19,
  },
  backButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  backText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
  },
  primary: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: web ? webWorkspaceTheme.radiusControl : 12,
    backgroundColor: "#345CF2",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondary: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#DCE5F3",
    borderRadius: web ? webWorkspaceTheme.radiusControl : 12,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#405573",
  },
  dim: {
    opacity: 0.5,
  },
  refreshRequests: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    color: "#345CF2",
    fontSize: 12,
    fontWeight: "700",
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: web ? webWorkspaceTheme.border : "#E0E8F5",
    backgroundColor: "#FFFFFF",
  },
  selected: {
    borderColor: "#345CF2",
    backgroundColor: "#EAF0FF",
  },
  optionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  balanceCard: {
    flexGrow: 1,
    flexBasis: 180,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: web ? webWorkspaceTheme.border : "#E0E8F5",
    backgroundColor: "#FFFFFF",
    gap: 7,
  },
  balanceNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#20334F",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: web ? webWorkspaceTheme.border : "#E0E8F5",
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: "#FFF1D9",
  },
  approved: {
    backgroundColor: "#E1F3EB",
  },
  rejected: {
    backgroundColor: "#FCE8EC",
  },
  cancelled: {
    backgroundColor: "#EDF0F6",
  },
  statusText: {
    fontSize: 10,
    color: "#52627C",
    fontWeight: "700",
  },
  dates: {
    fontSize: 12,
    color: "#405573",
    fontWeight: "600",
    lineHeight: 19,
  },
  pendingNote: {
    fontSize: 11,
    color: "#9A6A24",
    lineHeight: 18,
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: web ? webWorkspaceTheme.radiusControl : 12,
    borderWidth: 1,
    borderColor: "#F0C4CB",
    backgroundColor: "#FFF5F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B94D61",
  },
  noticeBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#E1F3EB",
  },
  notice: {
    color: "#176B4F",
    fontSize: 12,
    lineHeight: 19,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FCE8EC",
  },
  error: {
    fontSize: 12,
    color: "#B94D61",
    lineHeight: 19,
  },
  retry: {
    marginTop: 8,
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
  },
  input: {
    minHeight: 46,
    borderRadius: web ? webWorkspaceTheme.radiusControl : 12,
    borderWidth: 1,
    borderColor: "#DCE5F3",
    backgroundColor: "#FCFDFF",
    padding: 12,
    fontSize: 14,
    color: "#20334F",
  },
  reasonInput: {
    marginTop: formSpacing.field,
    minHeight: 100,
    textAlignVertical: "top",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(27,43,68,0.4)",
  },
  modal: {
    width: "100%",
    maxWidth: 470,
    maxHeight: "90%",
    alignSelf: "center",
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    gap: formSpacing.field,
  },
  dangerButton: {
    backgroundColor: "#C63E51",
  },
});
