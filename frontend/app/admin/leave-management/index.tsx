import { useDesktopStyles } from "../../../src/ui/useDesktopStyles";


import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { AdminBottomNavigation } from
  "../../../src/ui/AdminBottomNavigation";

import { useAdminViewport } from
  "../../../src/ui/useAdminViewport";

import {
  employeesApi,
  leaveApi,
  type EmployeeProfileDto,
  type LeaveBalanceDto,
  type LeaveRequestDto,
  type LeaveRequestStatus,
  type LeaveTypeDto,
} from "../../../src/core/admin/api";

import { getAdminScope } from
  "../../../src/core/admin/scope";

type Tab = "requests" | "types" | "balances";

type RequestFilter =
  | "ALL"
  | LeaveRequestStatus;

const currentYear = new Date().getUTCFullYear();

function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string | string[];
          };
        };
      }
    ).response;

    const message = response?.data?.message;

    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function displayDate(value: string): string {
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

const requestFilters: RequestFilter[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "ALL",
];

export default function LeaveManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; returnTo?: string; branchId?: string }>();
  const styles = useDesktopStyles(baseStyles);

  const { desktop } = useAdminViewport();

  const [tab, setTab] = useState<Tab>(
    params.tab === "types" || params.tab === "balances" ? params.tab : "requests",
  );
  useEffect(() => {
    if (params.tab === "types" || params.tab === "balances" || params.tab === "requests") {
      setTab(params.tab);
    }
  }, [params.tab]);

  const returnToAttendance = () => router.replace({
    pathname: "/admin/attendance",
    params: { view: "leave", apply: "1", ...(params.branchId ? { branchId: params.branchId } : {}) },
  });
  const [companyId, setCompanyId] = useState("");
  const [adminUserId, setAdminUserId] = useState("");

  const [types, setTypes] = useState<LeaveTypeDto[]>([]);
  const [employees, setEmployees] =
    useState<EmployeeProfileDto[]>([]);
  const [requests, setRequests] =
    useState<LeaveRequestDto[]>([]);
  const [balances, setBalances] =
    useState<LeaveBalanceDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] =
    useState(false);
  const [balancesLoading, setBalancesLoading] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [notice, setNotice] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [allowance, setAllowance] = useState("12");
  const [isPaid, setIsPaid] = useState(true);

  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [year, setYear] =
    useState(String(currentYear));
  const [allocatedDays, setAllocatedDays] =
    useState("12");

  const [balanceRevision, setBalanceRevision] =
    useState(0);

  const [requestFilter, setRequestFilter] =
    useState<RequestFilter>("PENDING");

  const [search, setSearch] = useState("");

  const [reviewNotes, setReviewNotes] =
    useState<Record<string, string>>({});

  const [reviewingId, setReviewingId] =
    useState<string | null>(null);

  const reviewingRef = useRef(false);

  const selectedEmployee = employees.find(
    (employee) => employee.userId === employeeId,
  );

  const pendingCount = requests.filter(
    (request) => request.status === "PENDING",
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "APPROVED",
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status === "REJECTED",
  ).length;

  const filteredRequests = requests.filter((request) => {
    if (
      requestFilter !== "ALL" &&
      request.status !== requestFilter
    ) {
      return false;
    }

    const employee = employees.find(
      (item) => item.userId === request.userId,
    );

    const type = types.find(
      (item) => item.id === request.leaveTypeId,
    );

    const query = search.trim().toLowerCase();

    if (!query) return true;

    return [
      employee?.user.name ?? "",
      employee?.employeeCode ?? "",
      employee?.branch.name ?? "",
      type?.name ?? "",
      request.leaveType?.name ?? "",
      request.reason,
      request.status,
    ].some((value) =>
      value.toLowerCase().includes(query),
    );
  });

  const loadRequests = useCallback(
    async (selectedCompanyId?: string) => {
      setRequestsLoading(true);
      setRequestsError("");

      try {
        const resolvedCompanyId =
          selectedCompanyId ||
          (await getAdminScope()).companyId;

        const result = await leaveApi.requests(
          resolvedCompanyId,
        );

        setRequests(
          result
            .filter(
              (request) =>
                request.companyId === resolvedCompanyId,
            )
            .sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
        );
      } catch (cause) {
        setRequestsError(errorMessage(cause));
      } finally {
        setRequestsLoading(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const scope = await getAdminScope();

      setCompanyId(scope.companyId);
      setAdminUserId(scope.user.id);

      const [typesResult, employeesResult] =
        await Promise.allSettled([
          leaveApi.types(scope.companyId),
          employeesApi.list(scope.companyId),
        ]);

      if (typesResult.status === "fulfilled") {
        setTypes(typesResult.value);

        setLeaveTypeId((previous) =>
          typesResult.value.some(
            (type) => type.id === previous,
          )
            ? previous
            : "",
        );
      } else {
        setTypes([]);
        setError(
          `Leave types: ${errorMessage(typesResult.reason)}`,
        );
      }

      if (employeesResult.status === "fulfilled") {
        setEmployees(employeesResult.value);

        setEmployeeId((previous) =>
          employeesResult.value.some(
            (employee) =>
              employee.userId === previous,
          )
            ? previous
            : "",
        );
      } else {
        setEmployees([]);
        setError((previous) =>
          [
            previous,
            `Employees: ${errorMessage(
              employeesResult.reason,
            )}`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      // Keep the request inbox independent from optional
      // employee-directory and leave-type lookup failures.
      await loadRequests(scope.companyId);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [loadRequests]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    let active = true;

    if (
      !companyId ||
      !selectedEmployee ||
      !/^\d{4}$/.test(year)
    ) {
      setBalances([]);
      setBalancesLoading(false);
      return;
    }

    setBalancesLoading(true);

    leaveApi
      .balances({
        companyId,
        branchId: selectedEmployee.branchId,
        userId: selectedEmployee.userId,
        year: Number(year),
      })
      .then((result) => {
        if (active) setBalances(result);
      })
      .catch((cause) => {
        if (!active) return;
        setBalances([]);
        setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setBalancesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    companyId,
    selectedEmployee?.branchId,
    selectedEmployee?.userId,
    year,
    balanceRevision,
  ]);

  const createType = async () => {
    if (saving) return;

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const days = Number(allowance);

    if (!companyId) {
      setError("Company information is unavailable.");
      return;
    }

    if (
      !cleanCode ||
      !cleanName ||
      cleanCode.length > 30 ||
      cleanName.length > 100
    ) {
      setError(
        "Enter a valid leave code and name.",
      );
      return;
    }

    if (
      allowance.trim() === "" ||
      !Number.isInteger(days) ||
      days < 0 ||
      days > 366
    ) {
      setError(
        "Annual allowance must be between 0 and 366.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await leaveApi.createType({
        companyId,
        code: cleanCode,
        name: cleanName,
        isPaid,
        annualAllowance: days,
      });

      const updated = await leaveApi.types(companyId);

      setTypes(updated);
      setCode("");
      setName("");
      setAllowance("12");

      setNotice("Leave type created successfully.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const allocate = async () => {
    if (saving) return;

    const parsedYear = Number(year);
    const days = Number(allocatedDays);

    if (!selectedEmployee || !leaveTypeId) {
      setError(
        "Select an employee and a leave type.",
      );
      return;
    }

    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 2000 ||
      parsedYear > 2100
    ) {
      setError("Enter a valid year.");
      return;
    }

    if (
      allocatedDays.trim() === "" ||
      !Number.isInteger(days) ||
      days < 0 ||
      days > 366
    ) {
      setError(
        "Allocated days must be between 0 and 366.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await leaveApi.allocateBalance({
        companyId,
        branchId: selectedEmployee.branchId,
        userId: selectedEmployee.userId,
        leaveTypeId,
        year: parsedYear,
        allocatedDays: days,
      });

      setBalanceRevision((value) => value + 1);
      setNotice("Leave balance saved successfully.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const reviewRequest = async (
    request: LeaveRequestDto,
    decision: "APPROVED" | "REJECTED",
  ) => {
    if (reviewingRef.current) return;

    if (request.status !== "PENDING") {
      setRequestsError(
        "Only pending requests can be reviewed.",
      );
      return;
    }

    if (request.userId === adminUserId) {
      setRequestsError(
        "You cannot approve or reject your own leave.",
      );
      return;
    }

    reviewingRef.current = true;
    setReviewingId(request.id);
    setRequestsError("");
    setNotice("");

    try {
      const note = reviewNotes[request.id]?.trim();

      if (decision === "APPROVED") {
        await leaveApi.approve(request.id, note);
      } else {
        await leaveApi.reject(request.id, note);
      }

      setNotice(
        `Leave request ${decision.toLowerCase()} successfully.`,
      );
    } catch (cause) {
      setRequestsError(errorMessage(cause));
    } finally {
      // Always reload authoritative state after a mutation.
      await loadRequests(companyId);

      reviewingRef.current = false;
      setReviewingId(null);
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {params.returnTo === "attendance" && (
            <Pressable
              accessibilityRole="button"
              onPress={returnToAttendance}
              disabled={saving}
              style={styles.tab}
            >
              <Text style={styles.tabText}>Back to my leave</Text>
            </Pressable>
          )}
          <Text style={styles.eyebrow}>
            BUSINESS WORKSPACE
          </Text>

          <Text style={styles.title}>
            Leave management
          </Text>

          <Text style={styles.subtitle}>
            Review employee requests, configure leave
            types and allocate yearly balances.
          </Text>

          {params.returnTo === "attendance" && !loading && types.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={returnToAttendance}
              disabled={saving}
              style={[styles.primaryButton, saving && styles.disabled]}
            >
              <Text style={styles.primaryText}>Continue to leave application</Text>
            </Pressable>
          )}

          <View style={styles.tabRow}>
            {(
              [
                { value: "requests", label: "Requests" },
                { value: "types", label: "Leave types" },
                { value: "balances", label: "Balances" },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: tab === item.value,
                }}
                onPress={() => setTab(item.value)}
                style={[
                  styles.tab,
                  tab === item.value &&
                    styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === item.value &&
                      styles.activeTabText,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

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

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator
              color="#345CF2"
              size="large"
            />
          ) : (
            <>
              {tab === "requests" && (
                <>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>
                        Pending
                      </Text>
                      <Text style={styles.summaryValue}>
                        {pendingCount}
                      </Text>
                    </View>

                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>
                        Approved
                      </Text>
                      <Text style={styles.summaryValue}>
                        {approvedCount}
                      </Text>
                    </View>

                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>
                        Rejected
                      </Text>
                      <Text style={styles.summaryValue}>
                        {rejectedCount}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <View style={styles.headerRow}>
                      <View style={styles.flex}>
                        <Text style={styles.sectionTitle}>
                          Employee leave requests
                        </Text>
                        <Text style={styles.subtitle}>
                          Review requests from your
                          permitted company.
                        </Text>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        disabled={requestsLoading}
                        onPress={() =>
                          void loadRequests(companyId)
                        }
                        style={styles.refresh}
                      >
                        <Text style={styles.link}>
                          Refresh
                        </Text>
                      </Pressable>
                    </View>

                    <TextInput
                      style={styles.input}
                      placeholder="Search employee, leave type or reason"
                      value={search}
                      onChangeText={setSearch}
                    />

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filters}
                    >
                      {requestFilters.map((status) => (
                        <Pressable
                          key={status}
                          accessibilityRole="button"
                          onPress={() =>
                            setRequestFilter(status)
                          }
                          style={[
                            styles.filter,
                            requestFilter === status &&
                              styles.selectedFilter,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterText,
                              requestFilter === status &&
                                styles.selectedFilterText,
                            ]}
                          >
                            {status === "ALL"
                              ? "All"
                              : status.charAt(0) +
                                status.slice(1).toLowerCase()}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {!!requestsError && (
                      <View style={styles.errorBox}>
                        <Text style={styles.error}>
                          {requestsError}
                        </Text>
                      </View>
                    )}

                    {requestsLoading && (
                      <ActivityIndicator color="#345CF2" />
                    )}

                    {!requestsLoading &&
                      filteredRequests.length === 0 && (
                        <Text style={styles.empty}>
                          No leave requests found.
                        </Text>
                      )}

                    {!requestsLoading &&
                      filteredRequests.map((request) => {
                        const employee = employees.find(
                          (item) =>
                            item.userId === request.userId,
                        );

                        const type = types.find(
                          (item) =>
                            item.id === request.leaveTypeId,
                        );

                        const isOwn =
                          request.userId === adminUserId;

                        const busy = reviewingId !== null;

                        return (
                          <View
                            key={request.id}
                            style={styles.requestCard}
                          >
                            <View style={styles.headerRow}>
                              <View style={styles.flex}>
                                <Text style={styles.itemTitle}>
                                  {employee?.user.name ??
                                    (isOwn
                                      ? "My request"
                                      : "Team member")}
                                </Text>

                                <Text style={styles.itemSubtitle}>
                                  {type?.name ??
                                    request.leaveType?.name ??
                                    "Leave"}
                                  {" · "}
                                  {employee?.branch.name ??
                                    "Branch"}
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
                                <Text style={styles.statusText}>
                                  {request.status}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.requestDates}>
                              {displayDate(request.startDate)}
                              {" – "}
                              {displayDate(request.endDate)}
                              {" · "}
                              {request.days} day(s)
                            </Text>

                            <Text style={styles.requestReason}>
                              {request.reason}
                            </Text>

                            {!!request.reviewNote && (
                              <Text
                                style={styles.itemSubtitle}
                              >
                                Review note: {request.reviewNote}
                              </Text>
                            )}

                            {request.status === "PENDING" &&
                              isOwn && (
                                <Text
                                  style={styles.itemSubtitle}
                                >
                                  Your request must be
                                  reviewed by another
                                  authorized administrator.
                                </Text>
                              )}

                            {request.status === "PENDING" &&
                              !isOwn && (
                                <>
                                  <TextInput
                                    style={styles.input}
                                    placeholder="Review note (optional)"
                                    value={
                                      reviewNotes[request.id] ??
                                      ""
                                    }
                                    onChangeText={(value) =>
                                      setReviewNotes(
                                        (current) => ({
                                          ...current,
                                          [request.id]: value,
                                        }),
                                      )
                                    }
                                    editable={!busy}
                                    multiline
                                  />

                                  <View
                                    style={styles.actionRow}
                                  >
                                    <Pressable
                                      accessibilityRole="button"
                                      disabled={busy}
                                      onPress={() =>
                                        void reviewRequest(
                                          request,
                                          "REJECTED",
                                        )
                                      }
                                      style={[
                                        styles.action,
                                        styles.rejectButton,
                                        busy &&
                                          styles.disabled,
                                      ]}
                                    >
                                      <Text
                                        style={styles.rejectText}
                                      >
                                        {reviewingId ===
                                        request.id
                                          ? "Saving..."
                                          : "Reject"}
                                      </Text>
                                    </Pressable>

                                    <Pressable
                                      accessibilityRole="button"
                                      disabled={busy}
                                      onPress={() =>
                                        void reviewRequest(
                                          request,
                                          "APPROVED",
                                        )
                                      }
                                      style={[
                                        styles.action,
                                        styles.approveButton,
                                        busy &&
                                          styles.disabled,
                                      ]}
                                    >
                                      <Text
                                        style={styles.approveText}
                                      >
                                        {reviewingId ===
                                        request.id
                                          ? "Saving..."
                                          : "Approve"}
                                      </Text>
                                    </Pressable>
                                  </View>
                                </>
                              )}
                          </View>
                        );
                      })}
                  </View>
                </>
              )}

              {tab === "types" && (
                <>
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      Create leave type
                    </Text>

                    <Text style={styles.label}>
                      Code
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="CL"
                      accessibilityLabel="Leave code"
                      autoCapitalize="characters"
                      value={code}
                      onChangeText={setCode}
                      editable={!saving}
                    />

                    <Text style={styles.label}>
                      Leave name
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="Casual Leave"
                      accessibilityLabel="Leave name"
                      value={name}
                      onChangeText={setName}
                      editable={!saving}
                    />

                    <Text style={styles.label}>
                      Annual allowance
                    </Text>

                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      accessibilityLabel="Annual allowance"
                      value={allowance}
                      onChangeText={setAllowance}
                      editable={!saving}
                    />

                    <View style={styles.headerRow}>
                      <Text style={styles.label}>
                        Paid leave
                      </Text>

                      <Switch
                        accessibilityLabel="Paid leave"
                        value={isPaid}
                        onValueChange={setIsPaid}
                        disabled={saving}
                      />
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void createType()}
                      style={[
                        styles.primaryButton,
                        saving && styles.disabled,
                      ]}
                    >
                      <Text style={styles.primaryText}>
                        {saving
                          ? "Saving..."
                          : "Create leave type"}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      Available leave types
                    </Text>

                    {types.length === 0 ? (
                      <Text style={styles.empty}>
                        No active leave types.
                      </Text>
                    ) : (
                      types.map((type) => (
                        <View
                          key={type.id}
                          style={styles.infoRow}
                        >
                          <View style={styles.flex}>
                            <Text style={styles.itemTitle}>
                              {type.name}
                            </Text>

                            <Text
                              style={styles.itemSubtitle}
                            >
                              {type.code}
                              {" · "}
                              {type.isPaid
                                ? "Paid"
                                : "Unpaid"}
                            </Text>
                          </View>

                          <Text style={styles.value}>
                            {type.annualAllowance} days
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </>
              )}

              {tab === "balances" && (
                <>
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>
                      Allocate leave balance
                    </Text>

                    <Text style={styles.subtitle}>
                      Choose an employee and leave
                      type to allocate annual days.
                    </Text>

                    <Text style={styles.label}>
                      Employee
                    </Text>

                    <View style={styles.selectionList}>
                      {employees.map((employee) => (
                        <Pressable
                          key={employee.id}
                          accessibilityRole="button"
                          onPress={() =>
                            setEmployeeId(
                              employee.userId,
                            )
                          }
                          style={[
                            styles.selection,
                            employeeId ===
                              employee.userId &&
                              styles.selected,
                          ]}
                        >
                          <Text style={styles.itemTitle}>
                            {employee.user.name}
                          </Text>

                          <Text
                            style={styles.itemSubtitle}
                          >
                            {employee.employeeCode}
                            {" · "}
                            {employee.branch.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {employees.length === 0 && (
                      <Text style={styles.empty}>
                        No employee profiles available.
                      </Text>
                    )}

                    <Text style={styles.label}>
                      Leave type
                    </Text>

                    <View style={styles.selectionList}>
                      {types.map((type) => (
                        <Pressable
                          key={type.id}
                          accessibilityRole="button"
                          onPress={() =>
                            setLeaveTypeId(type.id)
                          }
                          style={[
                            styles.selection,
                            leaveTypeId === type.id &&
                              styles.selected,
                          ]}
                        >
                          <Text style={styles.itemTitle}>
                            {type.name}
                          </Text>

                          <Text
                            style={styles.itemSubtitle}
                          >
                            {type.code}
                            {" · "}
                            {type.isPaid
                              ? "Paid"
                              : "Unpaid"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.label}>
                      Year
                    </Text>

                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={year}
                      onChangeText={setYear}
                      editable={!saving}
                    />

                    <Text style={styles.label}>
                      Total allocated days
                    </Text>

                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={allocatedDays}
                      onChangeText={setAllocatedDays}
                      editable={!saving}
                    />

                    <Text style={styles.helper}>
                      Updating an existing allocation
                      replaces its total. It does not add
                      days to the previous allocation.
                    </Text>

                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        saving ||
                        !selectedEmployee ||
                        !leaveTypeId
                      }
                      onPress={() => void allocate()}
                      style={[
                        styles.primaryButton,
                        (saving ||
                          !selectedEmployee ||
                          !leaveTypeId) &&
                          styles.disabled,
                      ]}
                    >
                      <Text style={styles.primaryText}>
                        {saving
                          ? "Saving..."
                          : "Save allocation"}
                      </Text>
                    </Pressable>
                  </View>

                  {!!selectedEmployee && (
                    <View style={styles.card}>
                      <Text style={styles.sectionTitle}>
                        Employee leave balances
                      </Text>

                      <Text style={styles.subtitle}>
                        {selectedEmployee.user.name}
                        {" · "}
                        {year}
                      </Text>

                      {balancesLoading ? (
                        <ActivityIndicator
                          color="#345CF2"
                        />
                      ) : balances.length === 0 ? (
                        <Text style={styles.empty}>
                          No balances allocated for
                          this employee and year.
                        </Text>
                      ) : (
                        balances.map((balance) => (
                          <View
                            key={balance.id}
                            style={styles.infoRow}
                          >
                            <View style={styles.flex}>
                              <Text
                                style={styles.itemTitle}
                              >
                                {balance.leaveType.name}
                              </Text>

                              <Text
                                style={styles.itemSubtitle}
                              >
                                Allocated:{" "}
                                {balance.allocatedDays}
                                {" · "}
                                Used: {balance.usedDays}
                              </Text>
                            </View>

                            <Text style={styles.value}>
                              {balance.remainingDays} left
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>

        {!desktop && <AdminBottomNavigation />}
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F8FD",
  },
  page: {
    flex: 1,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#8192AD",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#20334F",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: "#71849F",
    marginTop: 3,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE5F3",
    backgroundColor: "#FFFFFF",
  },
  activeTab: {
    backgroundColor: "#345CF2",
    borderColor: "#345CF2",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#405573",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E8F5",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#20334F",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
    marginTop: 6,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DCE5F3",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: "#20334F",
    backgroundColor: "#FCFDFF",
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E8F5",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#71849F",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#20334F",
    marginTop: 8,
  },
  filters: {
    gap: 8,
    paddingVertical: 4,
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F4F7FC",
    borderWidth: 1,
    borderColor: "#E0E8F5",
  },
  selectedFilter: {
    backgroundColor: "#EAF0FF",
    borderColor: "#345CF2",
  },
  filterText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#607591",
  },
  selectedFilterText: {
    color: "#345CF2",
  },
  refresh: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  link: {
    fontSize: 12,
    fontWeight: "700",
    color: "#345CF2",
  },
  requestCard: {
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E1E8F4",
    backgroundColor: "#FCFDFF",
    gap: 10,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
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
    fontWeight: "700",
    color: "#52627C",
  },
  requestDates: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
  },
  requestReason: {
    fontSize: 12,
    lineHeight: 19,
    color: "#607591",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  approveButton: {
    backgroundColor: "#E1F3EB",
  },
  approveText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#217663",
  },
  rejectButton: {
    backgroundColor: "#FCE8EC",
  },
  rejectText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B94D61",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#345CF2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  primaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.5,
  },
  selectionList: {
    gap: 8,
  },
  selection: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E8F5",
    borderRadius: 12,
    backgroundColor: "#FCFDFF",
  },
  selected: {
    borderColor: "#345CF2",
    backgroundColor: "#EAF0FF",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F8",
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#20334F",
  },
  itemSubtitle: {
    fontSize: 11,
    color: "#71849F",
    marginTop: 4,
    lineHeight: 17,
  },
  value: {
    fontSize: 12,
    fontWeight: "700",
    color: "#345CF2",
  },
  helper: {
    fontSize: 11,
    lineHeight: 18,
    color: "#71849F",
  },
  empty: {
    fontSize: 12,
    color: "#8192AD",
    paddingVertical: 12,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FCE8EC",
  },
  error: {
    fontSize: 12,
    lineHeight: 19,
    color: "#B94D61",
  },
  noticeBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#E1F3EB",
  },
  notice: {
    fontSize: 12,
    lineHeight: 19,
    color: "#34856C",
  },
});
