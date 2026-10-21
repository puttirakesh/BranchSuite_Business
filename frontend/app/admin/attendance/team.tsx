import { useToastState } from '../../../src/ui/useToastState';
import { SearchField } from '../../../src/ui/SearchField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";
import { DatePickerField } from "../../../src/ui/DatePickerField";
import { SummaryMetrics } from "../../../src/ui/SummaryMetrics";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ToastModal as Modal } from '../../../src/ui/Toast';

import {
  useRouter,
} from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  AdminBottomNavigation,
} from '../../../src/ui/AdminBottomNavigation';

import {
  useAdminLayout,
} from '../../../src/ui/useAdminLayout';

import {
  getEmployees,
  type Employee,
} from '../../../src/core/employees';

import {
  approveCorrection,
  markAttendance,
  readCorrectionRequests,
  readTeamAttendance,
  rejectCorrection,
  shiftAttendanceDate,
  utcToday,
  validAttendanceDate,
  type CorrectionRequest,
  type Shift,
} from '../../../src/core/admin/attendance';

import {
  leaveApi,
} from '../../../src/core/admin/api';

import {
  getAdminScope,
  selectAdminBranch,
  useAdminScope,
  type AdminScope,
} from '../../../src/core/admin/scope';

// ======================================================
// TYPES
// ======================================================

const filters = [
  'All',
  'Present',
  'Absent',
  'On leave',
  'Needs review',
  'Not checked in',
] as const;

type TeamStatus = (typeof filters)[number];

type LeaveRecord = {
  employeeId: string;
  branchId: string;
  status: string;
  startDate: string;
  endDate: string;
};

type Row = {
  employee: Employee;
  userId?: string;
  branchId?: string;
  shift?: Shift;
  status: TeamStatus;
  branch: string;
};

type Decision = {
  request: CorrectionRequest;
  action: 'approve' | 'reject';
};

// ======================================================
// HELPERS
// ======================================================

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred.';
}

function dateLabel(value: string): string {
  return new Date(
    `${value}T12:00:00.000Z`,
  ).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function timestampLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid time';
  }

  // Backend currently stores UTC attendance dates.
  return date.toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function canReviewCorrections(
  scope: AdminScope | null,
): boolean {
  return Boolean(
    scope &&
      [
        'BUSINESS_OWNER',
        'BUSINESS_ADMIN',
        'BRANCH_MANAGER',
      ].includes(scope.role),
  );
}

function employeeUserId(
  employee: Employee,
): string | undefined {
  // The employee adapter maps the login User.id to employee.id and keeps
  // EmployeeProfile.id separately as profileId.
  return employee.id || undefined;
}

function calculateStatus(
  shift: Shift | undefined,
  onLeave: boolean,
): TeamStatus {
  // A recorded attendance and approved leave on the
  // same day require reconciliation.
  if (shift && onLeave) {
    return 'Needs review';
  }

  if (shift?.needsReview) {
    return 'Needs review';
  }

  if (shift?.status === 'ABSENT') {
    return 'Absent';
  }

  if (shift?.status === 'ON_LEAVE' || onLeave) {
    return 'On leave';
  }

  if (shift?.status === 'HALF_DAY') {
    return 'Needs review';
  }

  if (
    shift?.status === 'PRESENT' ||
    Boolean(shift?.checkIn)
  ) {
    return 'Present';
  }

  return 'Not checked in';
}

// ======================================================
// TEAM ATTENDANCE PAGE
// ======================================================

export default function TeamAttendancePage() {
  const workspaceScope = useAdminScope();
  const { styles } = useAdminLayout(
    baseStyles,
    'list',
  );

  const router = useRouter();


  const searchRef = useRef<TextInput>(null);
  const markingRef = useRef(false);
  const reviewRef = useRef(false);

  const [scope, setScope] =
    useState<AdminScope | null>(null);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [shifts, setShifts] =
    useState<Shift[]>([]);

  const [leaves, setLeaves] =
    useState<LeaveRecord[]>([]);

  const [corrections, setCorrections] =
    useState<CorrectionRequest[]>([]);

  const [date, setDate] =
    useState(utcToday);

  const [dateText, setDateText] =
    useState(utcToday);

  const [branchId, setBranchId] =
    useState('');
  useEffect(() => {
    setBranchId(workspaceScope?.branchId ?? '');
  }, [workspaceScope?.branchId]);


  const [filter, setFilter] =
    useState<TeamStatus>('All');

  const [search, setSearch] =
    useState('');

  const [branchPicker, setBranchPicker] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useToastState('', 'error');

  const [notice, setNotice] =
    useToastState('', 'success');

  const [attempt, setAttempt] =
    useState(0);

  const [marking, setMarking] =
    useState<string | null>(null);

  const [decision, setDecision] =
    useState<Decision | null>(null);

  const [reviewNote, setReviewNote] =
    useState('');

  const [reviewing, setReviewing] =
    useState(false);

  // ====================================================
  // LOAD DATA
  // ====================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError('');

      async function load() {
        const adminScope = await getAdminScope();

        if (!active) return;

        setScope(adminScope);

        const selectedBranchId = adminScope.branchId ?? '';

        const authorizedBranchIds = new Set(
          adminScope.branches.map(
            (branch) => branch.id,
          ),
        );

        if (
          selectedBranchId &&
          !authorizedBranchIds.has(selectedBranchId)
        ) {
          throw new Error(
            'You no longer have access to this branch.',
          );
        }

        const [
          team,
          attendance,
          leaveRequests,
          correctionRequests,
        ] = await Promise.all([
          getEmployees(),

          readTeamAttendance({
            date,
            ...(selectedBranchId
              ? { branchId: selectedBranchId }
              : {}),
          }),

          leaveApi.requests(adminScope.companyId),

          canReviewCorrections(adminScope)
            ? readCorrectionRequests(
                selectedBranchId || undefined,
              )
            : Promise.resolve(
                [] as CorrectionRequest[],
              ),
        ]);

        if (!active) return;

        setEmployees(team);
        setShifts(attendance);

        setLeaves(
          leaveRequests.map((request) => ({
            employeeId: request.userId,
            branchId: request.branchId,
            status: request.status,
            startDate:
              request.startDate.slice(0, 10),
            endDate:
              request.endDate.slice(0, 10),
          })),
        );

        setCorrections(correctionRequests);

      }

      void load()
        .catch((cause) => {
          if (active) setError(message(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [
      attempt,
      date,
      branchId,
    ]),
  );

  // ====================================================
  // BRANCHES AND ROWS
  // ====================================================

  const authorizedBranches = scope?.branches ?? [];

  const selectedBranchName =
    authorizedBranches.find(
      (branch) => branch.id === branchId,
    )?.name ?? 'All branches';

  const rows = useMemo<Row[]>(() => {
    const allowedIds = new Set(
      authorizedBranches.map(
        (item) => item.id,
      ),
    );

    return employees
      .filter(
        (employee) =>
          employee.status !== 'inactive',
      )
      .filter((employee) => {
        if (!employee.branchId) return false;

        return (
          allowedIds.has(employee.branchId) &&
          (!branchId ||
            employee.branchId === branchId)
        );
      })
      .map((employee) => {
        const userId = employeeUserId(employee);
        const employeeBranchId =
          employee.branchId;

        const shift = shifts.find(
          (item) =>
            Boolean(userId) &&
            item.employeeId === userId &&
            item.date === date &&
            item.branchId === employeeBranchId,
        );

        const onLeave = leaves.some(
          (item) =>
            Boolean(userId) &&
            item.employeeId === userId &&
            item.branchId === employeeBranchId &&
            item.status === 'APPROVED' &&
            item.startDate <= date &&
            item.endDate >= date,
        );

        return {
          employee,
          userId,
          branchId: employeeBranchId,
          shift,
          branch: employee.branch,
          status: calculateStatus(
            shift,
            onLeave,
          ),
        };
      });
  }, [
    employees,
    shifts,
    leaves,
    date,
    branchId,
    authorizedBranches,
  ]);

  const searchText =
    search.trim().toLowerCase();

  const visible = rows.filter(
    (row) =>
      (filter === 'All' ||
        row.status === filter) &&
      [
        row.employee.fullName,
        row.employee.department ?? '',
        row.employee.employeeCode ?? '',
        row.branch,
        row.shift?.shiftName ?? '',
      ].some((value) =>
        value.toLowerCase().includes(
          searchText,
        ),
      ),
  );

  const total = (status: TeamStatus) =>
    rows.filter(
      (row) => row.status === status,
    ).length;

  const pendingCorrections =
    corrections.filter(
      (request) =>
        request.status === 'PENDING' &&
        (!branchId ||
          request.branchId === branchId),
    );

  // ====================================================
  // DATE SELECTION
  // ====================================================

  function updateDate(value: string) {
    if (!validAttendanceDate(value)) {
      setError(
        'Enter a valid date in YYYY-MM-DD format.',
      );
      return;
    }

    if (value > utcToday()) {
      setError(
        'Attendance dates cannot be in the future.',
      );
      return;
    }

    setError('');
    setDate(value);
    setDateText(value);
  }

  function moveDate(days: number) {
    try {
      updateDate(
        shiftAttendanceDate(date, days),
      );
    } catch (cause) {
      setError(message(cause));
    }
  }

  // ====================================================
  // MANUAL MARKING
  // ====================================================

  async function mark(
    row: Row,
    status: 'PRESENT' | 'ABSENT',
  ) {
    if (
      markingRef.current ||
      row.shift ||
      row.status === 'On leave' ||
      row.status === 'Needs review'
    ) {
      return;
    }

    if (!row.userId || !row.branchId) {
      setError(
        'Attendance cannot be marked because this employee is not linked to an account or branch.',
      );
      return;
    }

    markingRef.current = true;
    setMarking(row.userId);
    setError('');
    setNotice('');

    try {
      await markAttendance({
        employeeId: row.userId,
        branchId: row.branchId,
        date,
        status,
        notes: 'Marked by administrator',
      });

      setNotice(
        `Attendance updated for ${row.employee.fullName}.`,
      );

      setAttempt((value) => value + 1);
    } catch (cause) {
      setError(message(cause));
    } finally {
      markingRef.current = false;
      setMarking(null);
    }
  }

  // ====================================================
  // REVIEW CORRECTION
  // ====================================================

  function openDecision(
    request: CorrectionRequest,
    action: 'approve' | 'reject',
  ) {
    if (reviewRef.current) return;

    setDecision({ request, action });
    setReviewNote('');
    setError('');
  }

  async function submitDecision() {
    if (!decision || reviewRef.current) return;

    if (
      decision.action === 'reject' &&
      !reviewNote.trim()
    ) {
      setError(
        'A rejection reason is required.',
      );
      return;
    }

    reviewRef.current = true;
    setReviewing(true);
    setError('');

    try {
      if (decision.action === 'approve') {
        await approveCorrection(
          decision.request.id,
          reviewNote,
        );
      } else {
        await rejectCorrection(
          decision.request.id,
          reviewNote,
        );
      }

      setNotice(
        decision.action === 'approve'
          ? 'Correction approved successfully.'
          : 'Correction rejected successfully.',
      );

      setDecision(null);
      setReviewNote('');
      setAttempt((value) => value + 1);
    } catch (cause) {
      setError(message(cause));
    } finally {
      reviewRef.current = false;
      setReviewing(false);
    }
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>


        <FlatList
          data={
            loading || error
              ? []
              : visible
          }
          keyExtractor={(row) =>
            row.employee.id
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <AdminPageHeading title="Team attendance" onBack={() => router.replace('/admin/employees/people')} />

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Attendance date</Text>

                <View style={styles.dateControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Previous day"
                    onPress={() =>
                      moveDate(-1)
                    }
                    style={styles.iconButton}
                  >
                    <AppIcon symbol="‹" style={styles.iconText} />
                  </Pressable>

                  <DatePickerField
                    label="Attendance date"
                    value={dateText}
                    hideLabel
                    onChange={value => {
                      setDateText(value);
                      updateDate(value);
                    }}
                    maxDate={utcToday()}
                    style={styles.dateInput}
                  />

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Next day"
                    disabled={date >= utcToday()}
                    onPress={() =>
                      moveDate(1)
                    }
                    style={styles.iconButton}
                  >
                    <AppIcon symbol="›" style={styles.iconText} />
                  </Pressable>
                </View>

                {date !== utcToday() && <Pressable
                  accessibilityRole="button"
                  onPress={() => updateDate(utcToday())}
                  style={styles.todayButton}
                >
                  <Text style={styles.link}>Today</Text>
                </Pressable>}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Branch
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setBranchPicker(true)
                  }
                  style={styles.branchButton}
                >
                  <Text style={styles.name}>
                    {selectedBranchName}
                  </Text>
                  <AppIcon name="chevron-down" size={16} color="#607591" />
                </Pressable>
              </View>

              <View style={styles.overviewBlock}>
              <SummaryMetrics title="Attendance overview" dense items={[
                { id: 'present', label: 'Present', value: total('Present'), icon: 'user-check', tone: 'success' },
                { id: 'not-checked-in', label: 'Not in', value: total('Not checked in'), icon: 'clock', tone: 'warning' },
                { id: 'absent', label: 'Absent', value: total('Absent'), icon: 'x-circle', tone: 'danger' },
                { id: 'leave', label: 'Leave', value: total('On leave'), icon: 'calendar', tone: 'purple' },
                { id: 'review', label: 'Review', value: total('Needs review'), icon: 'alert-circle', tone: 'warning' },
              ]} loading={loading} />
              </View>

              <View style={styles.coverage}>
                <View style={styles.row}>
                  <Text style={styles.sectionTitle}>
                    Check-in coverage
                  </Text>

                  <Text style={styles.success}>
                    {rows.length ? Math.round((total('Present') / rows.length) * 100) : 0}% checked in
                  </Text>
                </View>

                <View style={styles.track}>
                  <View
                    style={[
                      styles.progress,
                      {
                        width: `${
                          rows.length
                            ? (total('Present') /
                                rows.length) *
                              100
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.subtitle}>
                  {rows.length} employees
                  {' · '}
                  {total('Absent')} absent
                  {' · '}
                  {total('On leave')} on leave
                  {' · '}
                  {total('Needs review')} need review
                </Text>
              </View>

              {!!notice && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.notice}
                >
                  {notice}
                </Text>
              )}

              {!!error && (
                <View style={styles.errorCard}>
                  <Text style={styles.error}>
                    {error}
                  </Text>

                  <Pressable
                    onPress={() =>
                      setAttempt((value) => value + 1)
                    }
                    style={styles.linkButton}
                  >
                    <Text style={styles.link}>
                      Retry loading
                    </Text>
                  </Pressable>
                </View>
              )}

              {canReviewCorrections(scope) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Pending attendance corrections
                  </Text>

                  <Text style={styles.subtitle}>
                    {pendingCorrections.length}
                    {" "}
                    requests awaiting review
                  </Text>

                  {pendingCorrections.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.muted}>
                        No pending corrections.
                      </Text>
                    </View>
                  ) : (
                    pendingCorrections.map(
                      (request) => {
                        const selfRequest =
                          request.userId ===
                          scope?.user.id;

                        return (
                          <View
                            key={request.id}
                            style={styles.card}
                          >
                            <View style={styles.row}>
                              <View style={styles.flex}>
                                <Text style={styles.name}>
                                  {request.employeeName}
                                </Text>

                                <Text style={styles.subtitle}>
                                  {request.branchName}
                                  {' · '}
                                  {request.attendanceDate}
                                </Text>
                              </View>

                              <View style={styles.warningBadge}>
                                <Text style={styles.warningText}>
                                  Pending
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.details}>
                              Requested check-in:
                              {" "}
                              {timestampLabel(
                                request.requestedCheckInAt,
                              )}
                            </Text>

                            <Text style={styles.details}>
                              Requested check-out:
                              {" "}
                              {timestampLabel(
                                request.requestedCheckOutAt,
                              )}
                            </Text>

                            <Text style={styles.details}>
                              Reason: {request.reason}
                            </Text>

                            {selfRequest ? (
                              <Text style={styles.muted}>
                                You cannot review your own request.
                              </Text>
                            ) : (
                              <View style={styles.actions}>
                                <Pressable
                                  accessibilityRole="button"
                                  onPress={() =>
                                    openDecision(
                                      request,
                                      'approve',
                                    )
                                  }
                                  style={styles.approveButton}
                                >
                                  <Text style={styles.primaryText}>
                                    Approve
                                  </Text>
                                </Pressable>

                                <Pressable
                                  accessibilityRole="button"
                                  onPress={() =>
                                    openDecision(
                                      request,
                                      'reject',
                                    )
                                  }
                                  style={styles.rejectButton}
                                >
                                  <Text style={styles.rejectText}>
                                    Reject
                                  </Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      },
                    )
                  )}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Employee attendance
                </Text>

                <SearchField
                  ref={searchRef}
                  accessibilityLabel="Search employee"
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filters}
                >
                  {filters.map((item) => (
                    <Pressable
                      key={item}
                      accessibilityRole="tab"
                      accessibilityState={{
                        selected: filter === item,
                      }}
                      onPress={() =>
                        setFilter(item)
                      }
                      style={[
                        styles.filter,
                        filter === item &&
                          styles.selectedFilter,
                      ]}
                    >
                      <Text style={styles.filterText}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.subtitle}>
                  Showing {visible.length} of
                  {" "}
                  {rows.length} employees
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator
                accessibilityLabel="Loading team attendance"
                color="#345cf2"
                style={styles.loading}
              />
            ) : error ? null : (
              <View style={styles.emptyCard}>
                <Text style={styles.name}>
                  No matching employees
                </Text>

                <Text style={styles.subtitle}>
                  Try another date, branch, or filter.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const canMark =
              Boolean(item.userId) &&
              Boolean(item.branchId) &&
              !item.shift &&
              item.status === 'Not checked in' &&
              date <= utcToday();

            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.initialBadge}>
                    <Text style={styles.initials}>
                      {item.employee.fullName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map(
                          (part) =>
                            part.charAt(0),
                        )
                        .join('')
                        .toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.flex}>
                    <Text style={styles.name}>
                      {item.employee.fullName}
                    </Text>

                    <Text style={styles.subtitle}>
                      {item.branch}
                      {' · '}
                      {item.employee.department}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'Present'
                        ? styles.presentBadge
                        : item.status === 'On leave'
                          ? styles.leaveBadge
                          : item.status === 'Needs review'
                            ? styles.warningBadge
                            : null,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.times}>
                  <Text style={styles.details}>
                    In:
                    {" "}
                    {item.shift?.checkIn || '—'}
                  </Text>

                  <Text style={styles.details}>
                    Out:
                    {" "}
                    {item.shift?.checkOut || '—'}
                  </Text>
                </View>

                {!item.userId && (
                  <Text style={styles.muted}>
                    No employee account is linked, so attendance actions are unavailable.
                  </Text>
                )}

                {canMark && (
                  <View style={styles.actions}>
                    {([
                      'PRESENT',
                      'ABSENT',
                    ] as const).map(
                      (status) => (
                        <Pressable
                          key={status}
                          accessibilityRole="button"
                          disabled={marking !== null}
                          onPress={() =>
                            void mark(item, status)
                          }
                          style={[
                            styles.secondaryButton,
                            marking !== null &&
                              styles.disabled,
                          ]}
                        >
                          <Text style={styles.link}>
                            {marking === item.userId
                              ? 'Saving...'
                              : status === 'PRESENT'
                                ? 'Mark present'
                                : 'Mark absent'}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />

        <AdminBottomNavigation />
      </View>

      {/* Branch selector */}
      <Modal
        transparent
        visible={branchPicker}
        animationType="fade"
        onRequestClose={() =>
          setBranchPicker(false)
        }
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.row}>
              <Text style={styles.sectionTitle}>
                Select branch
              </Text>

              <Pressable accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() =>
                  setBranchPicker(false)
                }
              >
                <AppIcon symbol="×" style={styles.iconText} />
              </Pressable>
            </View>

            <ScrollView>
              {[
                {
                  id: '',
                  name: 'All branches',
                },
                ...authorizedBranches,
              ].map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setBranchId(item.id);
                    void selectAdminBranch(item.id || null);
                    setBranchPicker(false);
                  }}
                  style={styles.option}
                >
                  <Text style={styles.name}>
                    {item.name}
                  </Text>

                  <AppIcon symbol={branchId === item.id
                      ? '✓'
                      : ''} style={styles.link} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Approval / rejection confirmation */}
      <Modal
        transparent
        visible={decision !== null}
        animationType="fade"
        onRequestClose={() => {
          if (!reviewing) setDecision(null);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.sectionTitle}>
              {decision?.action === 'approve'
                ? 'Approve correction'
                : 'Reject correction'}
            </Text>

            <Text style={styles.subtitle}>
              {decision?.request.employeeName}
              {' · '}
              {decision?.request.attendanceDate}
            </Text>



            <TextInput validation={{ required: decision?.action === 'reject', maxLength: 1000 }} label={decision?.action === 'reject'
                ? 'Rejection reason *'
                : 'Review note (optional)'}
              accessibilityLabel="Correction review note"
              value={reviewNote}
              onChangeText={setReviewNote}
              multiline
              editable={!reviewing}
              style={[
                styles.input,
                styles.multiline,
              ]}
            />

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={reviewing}
                onPress={() => {
                  setDecision(null);
                  setError('');
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.link}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={reviewing}
                onPress={() =>
                  void submitDecision()
                }
                style={[
                  styles.primaryButton,
                  reviewing && styles.disabled,
                ]}
              >
                <Text style={styles.primaryText}>
                  {reviewing
                    ? 'Saving...'
                    : decision?.action === 'approve'
                      ? 'Confirm approval'
                      : 'Confirm rejection'}
                </Text>
              </Pressable>
            </View>

            {!!error && (
              <Text style={styles.error}>
                {error}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ======================================================
// STYLES
// ======================================================

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f6f8fd',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    minWidth: 0,
    width: 'auto',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4eaf5',
  },
  companyName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#20334f',
  },
  list: {
    padding: 16,
    paddingBottom: 36,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#20334f',
  },
  section: {
    marginTop: 22,
    gap: 10,
  },
  overviewBlock: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#20334f',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7a8ba5',
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#405573',
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#20334f',
  },
  muted: {
    fontSize: 11,
    color: '#8292a8',
    marginTop: 9,
    lineHeight: 17,
  },
  details: {
    fontSize: 12,
    lineHeight: 19,
    color: '#405573',
    marginTop: 5,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce5f3',
    backgroundColor: '#fff',
    fontSize: 13,
    color: '#20334f',
  },
  multiline: {
    minHeight: 100,
    paddingVertical: 12,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#fff',
  },
  iconText: {
    fontSize: 22,
    color: '#607591',
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#345cf2',
  },
  primaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  linkButton: {
    minHeight: 38,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  todayButton: {
    minHeight: 36,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#edf1ff',
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
    color: '#345cf2',
  },
  branchButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#d5dfff',
    backgroundColor: '#eaf0ff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverage: {
    borderWidth: 1,
    borderColor: '#e0e8f5',
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
    backgroundColor: '#fff',
    gap: 10,
  },
  track: {
    height: 6,
    backgroundColor: '#e8edf5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progress: {
    height: 6,
    backgroundColor: '#138f80',
  },
  success: {
    fontSize: 12,
    fontWeight: '700',
    color: '#138f80',
  },
  card: {
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e8f5',
    borderRadius: 16,
    gap: 5,
  },
  emptyCard: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e8f5',
    marginTop: 10,
  },
  initialBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8eeff',
    borderRadius: 13,
  },
  initials: {
    fontSize: 13,
    fontWeight: '800',
    color: '#345cf2',
  },
  statusBadge: {
    borderRadius: 7,
    padding: 7,
    backgroundColor: '#edf0f6',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#52627c',
  },
  presentBadge: {
    backgroundColor: '#e1f3eb',
  },
  leaveBadge: {
    backgroundColor: '#eee7ff',
  },
  warningBadge: {
    borderRadius: 7,
    backgroundColor: '#fff1d9',
    padding: 7,
  },
  warningText: {
    color: '#a36b0d',
    fontSize: 10,
    fontWeight: '700',
  },
  times: {
    marginTop: 10,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#f0f3f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 13,
  },
  approveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#168b78',
  },
  rejectButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f1',
  },
  rejectText: {
    color: '#b94d61',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#dce5f3',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  filters: {
    gap: 8,
    paddingVertical: 8,
  },
  filter: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  selectedFilter: {
    backgroundColor: '#eaf0ff',
    borderColor: '#345cf2',
  },
  filterText: {
    color: '#405573',
    fontSize: 11,
    fontWeight: '600',
  },
  notice: {
    marginTop: 13,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#e6f4ee',
    color: '#168b78',
    fontSize: 12,
  },
  errorCard: {
    marginTop: 13,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#fff1f1',
  },
  error: {
    color: '#b94d61',
    fontSize: 12,
    lineHeight: 18,
  },
  loading: {
    marginTop: 24,
  },
  overlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: 'rgba(27,43,68,0.35)',
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 22,
    borderRadius: 20,
    gap: 10,
  },
  option: {
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabled: {
    opacity: 0.5,
  },
});
