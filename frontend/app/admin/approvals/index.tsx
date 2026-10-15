
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../../src/core/api/client';
import { call, fetchAll } from '../../../src/core/admin/http';
import {
  leaveApi,
  type LeaveRequestDto,
} from '../../../src/core/admin/api';
import {
  readRequests as readServerRequests,
} from '../../../src/core/admin/attendance';
import {
  getAdminScope,
  getCompanyBranches,
  branchNameMap,
} from '../../../src/core/admin/scope';

import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';
type RequestType = 'leave' | 'correction';
type Filter = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

type ApprovalRequest = {
  id: string;
  type: RequestType;
  startDate: string;
  endDate: string;
  reason: string;
  status: Status;
  createdAt: string;
  reviewedAt?: string;
  employeeId?: string;
  employeeName?: string;
  branch?: string;
  leaveType?: string;
  correctCheckIn?: string;
  correctCheckOut?: string;
  reviewNote?: string;
};

type CorrectionDto = {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  userId: string;
  attendanceId: string;
  requestedCheckInAt: string;
  requestedCheckOutAt: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  requestedBy: {
    id: string;
    name: string;
    email: string;
  };
  attendance: {
    attendanceDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: string;
  };
};

const statusFilters: Filter[] = [
  'All',
  'Pending',
  'Approved',
  'Rejected',
  'Cancelled',
];

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function displayDate(value: string): string {
  const date = new Date(`${dateOnly(value)}T12:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function displayTime(value?: string): string {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('en-GB', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
}

function dateSummary(request: ApprovalRequest): string {
  if (request.type === 'correction') {
    return displayDate(request.startDate);
  }

  const days =
    Math.round(
      (Date.parse(request.endDate) - Date.parse(request.startDate)) /
        86400000,
    ) + 1;

  return `${displayDate(request.startDate)} – ${displayDate(
    request.endDate,
  )}${days > 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}`;
}

async function loadRequests(): Promise<ApprovalRequest[]> {
  const scope = await getAdminScope();

  const [leaveRequests, corrections, branches] = await Promise.all([
    readServerRequests(),
    fetchAll<CorrectionDto>((page) =>
      call(
        api.get('/attendance/corrections', {
          params: {
            companyId: scope.companyId,
            page,
            limit: 100,
          },
        }),
      ),
    ),
    getCompanyBranches(),
  ]);

  const branchNames = branchNameMap(branches);

  const leave: ApprovalRequest[] = leaveRequests
    .filter((request) => request.type === 'leave')
    .map((request) => ({
      id: request.id,
      type: 'leave',
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      employeeId: request.employeeId,
      employeeName: request.employeeName,
      branch: request.branch,
      leaveType: request.leaveType,
    }));

  const attendance: ApprovalRequest[] = corrections.map((record) => ({
    id: record.id,
    type: 'correction',
    startDate: dateOnly(record.attendance.attendanceDate),
    endDate: dateOnly(record.attendance.attendanceDate),
    reason: record.reason,
    status: record.status.toLowerCase() as Status,
    createdAt: record.createdAt,
    reviewedAt: record.reviewedAt ?? undefined,
    reviewNote: record.reviewNote ?? undefined,
    employeeId: record.userId,
    employeeName: record.requestedBy.name,
    branch: branchNames.get(record.branchId) ?? 'Unknown branch',
    correctCheckIn: displayTime(record.requestedCheckInAt),
    correctCheckOut: displayTime(record.requestedCheckOutAt),
  }));

  return [...leave, ...attendance].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

async function saveDecision(
  request: ApprovalRequest,
  decision: 'approved' | 'rejected',
  note: string,
): Promise<void> {
  if (request.type === 'leave') {
    if (decision === 'approved') {
      await leaveApi.approve(request.id);
    } else {
      await leaveApi.reject(request.id);
    }

    return;
  }

  const action = decision === 'approved' ? 'approve' : 'reject';

  await call(
    api.patch(
      `/attendance/corrections/${request.id}/${action}`,
      { note },
    ),
  );
}

export default function ApprovalsPage() {
  const { styles, columns, columnWrapperStyle } =
    useAdminLayout(baseStyles, 'list');

  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [myUserId, setMyUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [type, setType] = useState<RequestType | ''>('');
  const [branch, setBranch] = useState('');

  const [picker, setPicker] = useState<'type' | 'branch' | null>(null);
  const [reviewing, setReviewing] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] =
    useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');

  const [savingId, setSavingId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const searchRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setLoadError('');

      Promise.all([loadRequests(), getAdminScope()])
        .then(([records, scope]) => {
          if (!active) return;
          setRequests(records);
          setMyUserId(scope.user.id);
        })
        .catch((error: unknown) => {
          if (active) {
            setLoadError(
              error instanceof Error
                ? error.message
                : 'Could not load approval requests.',
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [attempt]),
  );

  const nameFor = (request: ApprovalRequest) =>
    request.employeeName || 'Team member';

  const branchFor = (request: ApprovalRequest) =>
    request.branch || 'Unknown branch';

  const typeFor = (request: ApprovalRequest) =>
    request.type === 'leave'
      ? request.leaveType || 'Leave request'
      : 'Attendance correction';

  const branches = [
    ...new Set(requests.map(branchFor).filter(Boolean)),
  ].sort();

  const scoped = requests.filter(
    (request) => !branch || branchFor(request) === branch,
  );

  const query = search.trim().toLowerCase();

  const filtered = scoped.filter(
    (request) =>
      (filter === 'All' ||
        request.status === filter.toLowerCase()) &&
      (!type || request.type === type) &&
      [
        nameFor(request),
        typeFor(request),
        branchFor(request),
        request.reason,
      ].some((value) => value.toLowerCase().includes(query)),
  );

  const options =
    picker === 'branch'
      ? [
          { value: '', label: 'All branches' },
          ...branches.map((value) => ({
            value,
            label: value,
          })),
        ]
      : [
          { value: '', label: 'All types' },
          { value: 'leave', label: 'Leave requests' },
          { value: 'correction', label: 'Attendance corrections' },
        ];

  function openDecision(
    request: ApprovalRequest,
    action: 'approved' | 'rejected',
  ) {
    if (savingRef.current) return;

    if (
      request.type === 'correction' &&
      request.employeeId === myUserId
    ) {
      setDecisionError(
        'You cannot review your own attendance correction.',
      );
      return;
    }

    setReviewing(request);
    setDecision(action);
    setReviewNote('');
    setDecisionError('');
  }

  async function confirmDecision() {
    if (!reviewing || savingRef.current) return;

    const note = reviewNote.trim();

    if (
      reviewing.type === 'correction' &&
      decision === 'rejected' &&
      !note
    ) {
      setDecisionError('Enter a reason for rejecting this correction.');
      return;
    }

    savingRef.current = true;
    setSavingId(reviewing.id);
    setDecisionError('');
    setNotice('');

    try {
      await saveDecision(reviewing, decision, note);
      const records = await loadRequests();

      setRequests(records);
      setNotice(
        `${reviewing.type === 'leave' ? 'Leave request' : 'Attendance correction'} ${decision}.`,
      );
      setReviewing(null);
      setReviewNote('');
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : 'Could not save the decision.',
      );
    } finally {
      savingRef.current = false;
      setSavingId(null);
    }
  }

  const listHeader = (
    <View>
      <Text style={styles.eyebrow}>WORKSPACE</Text>
      <Text style={styles.title}>Approvals</Text>
      <Text style={styles.subtitle}>
        Review leave and attendance correction requests.
      </Text>

      <View style={styles.summaryGrid}>
        {([
          {
            label: 'Leave requests',
            type: 'leave',
            icon: '▦',
          },
          {
            label: 'Corrections',
            type: 'correction',
            icon: '◷',
          },
        ] as const).map((item) => (
          <View key={item.type} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              {item.icon} {item.label}
            </Text>
            <Text style={styles.summaryValue}>
              {loading || loadError
                ? '—'
                : scoped.filter(
                    (request) =>
                      request.type === item.type &&
                      request.status === 'pending',
                  ).length}
            </Text>
            <Text style={styles.subtitle}>Waiting for review</Text>
          </View>
        ))}
      </View>

      <View style={styles.searchField}>
        <TextInput
          ref={searchRef}
          accessibilityLabel="Search requests"
          placeholder="Search employee or request"
          placeholderTextColor="#8c96a6"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
      >
        {statusFilters.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{
              selected: filter === value,
            }}
            onPress={() => setFilter(value)}
            style={[
              styles.filterTab,
              filter === value && styles.selectedFilter,
            ]}
          >
            <Text style={styles.filterText}>{value}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Request type</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setPicker('type')}
        style={styles.selector}
      >
        <Text style={styles.inputText}>
          {type === 'leave'
            ? 'Leave requests'
            : type === 'correction'
              ? 'Attendance corrections'
              : 'All types'}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Text style={styles.label}>Branch</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setPicker('branch')}
        style={styles.selector}
      >
        <Text style={styles.inputText}>
          {branch || 'All branches'}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      )}

      {!!decisionError && !reviewing && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {decisionError}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.between}>
            <View style={styles.flex}>
              <Text style={styles.companyName}>Business workspace</Text>
              <Text style={styles.headerCaption}>
                Approvals · Admin workspace
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Focus request search"
              onPress={() => searchRef.current?.focus()}
              style={styles.headerIcon}
            >
              <Text style={styles.chevron}>⌕</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          key={columns}
          data={loading || loadError ? [] : filtered}
          numColumns={columns}
          columnWrapperStyle={
            columns > 1 ? columnWrapperStyle : undefined
          }
          keyExtractor={(request) => `${request.type}:${request.id}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator
                accessibilityLabel="Loading requests"
                color="#345cf2"
              />
            ) : loadError ? (
              <View style={styles.card}>
                <Text style={styles.error}>{loadError}</Text>
                <Pressable
                  onPress={() => setAttempt((value) => value + 1)}
                  style={styles.button}
                >
                  <Text style={styles.link}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.name}>
                  {requests.length === 0
                    ? 'No requests yet'
                    : 'No matching requests'}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const selfCorrection =
              item.type === 'correction' &&
              item.employeeId === myUserId;

            return (
              <View style={styles.card}>
                <View style={styles.between}>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{nameFor(item)}</Text>
                    <Text style={styles.requestType}>
                      {typeFor(item)} · {branchFor(item)}
                    </Text>
                  </View>
                  <Text style={styles.statusBadge}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.dateSummary}>
                  {dateSummary(item)}
                </Text>

                <Text style={styles.reason}>{item.reason}</Text>

                {item.type === 'correction' && (
                  <Text style={styles.dateSummary}>
                    Requested times (UTC): {item.correctCheckIn} –{' '}
                    {item.correctCheckOut}
                  </Text>
                )}

                {!!item.reviewNote && (
                  <Text style={styles.reason}>
                    Review note: {item.reviewNote}
                  </Text>
                )}

                {item.status === 'pending' && !selfCorrection && (
                  <View style={styles.decisionButtons}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={savingId !== null}
                      onPress={() => openDecision(item, 'rejected')}
                      style={styles.rejectButton}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      disabled={savingId !== null}
                      onPress={() => openDecision(item, 'approved')}
                      style={styles.approveButton}
                    >
                      <Text style={styles.approveText}>Approve</Text>
                    </Pressable>
                  </View>
                )}

                {selfCorrection && item.status === 'pending' && (
                  <Text style={styles.subtitle}>
                    Your own correction requires another authorized reviewer.
                  </Text>
                )}
              </View>
            );
          }}
        />

        <AdminBottomNavigation />
      </View>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.between}>
              <Text style={styles.modalTitle}>
                {picker === 'branch' ? 'Choose branch' : 'Request type'}
              </Text>
              <Pressable onPress={() => setPicker(null)}>
                <Text style={styles.chevron}>×</Text>
              </Pressable>
            </View>

            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    if (picker === 'branch') {
                      setBranch(option.value);
                    } else {
                      setType(option.value as RequestType | '');
                    }
                    setPicker(null);
                  }}
                  style={styles.option}
                >
                  <Text style={styles.inputText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reviewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingRef.current) setReviewing(null);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {decision === 'approved' ? 'Approve' : 'Reject'} request
            </Text>

            <Text style={styles.subtitle}>
              {reviewing
                ? `${nameFor(reviewing)} · ${typeFor(reviewing)}`
                : ''}
            </Text>

            <Text style={styles.label}>
              {decision === 'rejected' &&
              reviewing?.type === 'correction'
                ? 'Rejection reason *'
                : 'Review note (optional)'}
            </Text>

            <TextInput
              multiline
              editable={savingId === null}
              value={reviewNote}
              onChangeText={setReviewNote}
              accessibilityLabel="Review note"
              placeholder="Enter a review note"
              style={styles.noteInput}
            />

            {!!decisionError && (
              <Text style={styles.error}>{decisionError}</Text>
            )}

            <View style={styles.decisionButtons}>
              <Pressable
                disabled={savingId !== null}
                onPress={() => {
                  setReviewing(null);
                  setDecisionError('');
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.inputText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={savingId !== null}
                onPress={() => void confirmDecision()}
                style={styles.approveButton}
              >
                <Text style={styles.approveText}>
                  {savingId !== null ? 'Saving…' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f6f8fd',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4eaf5',
  },
  companyName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#20334f',
  },
  headerCaption: {
    marginTop: 4,
    fontSize: 10,
    color: '#8794aa',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f5f7fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 22,
    color: '#607591',
  },
  list: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 35,
    gap: 12,
  },
  eyebrow: {
    fontSize: 9,
    color: '#8192ad',
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#20334f',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 18,
    color: '#7a8ba5',
    marginTop: 6,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e8f5',
    borderRadius: 16,
    padding: 15,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#607591',
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#20334f',
    marginTop: 8,
  },
  searchField: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#e1e8f4',
    backgroundColor: '#fff',
    borderRadius: 13,
    paddingHorizontal: 13,
    marginTop: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#20334f',
  },
  filterTabs: {
    gap: 8,
    paddingVertical: 14,
  },
  filterTab: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  selectedFilter: {
    backgroundColor: '#eaf0ff',
    borderColor: '#d5dfff',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#405573',
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#405573',
  },
  selector: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#dce5f3',
    backgroundColor: '#fff',
    borderRadius: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 13,
    color: '#20334f',
  },
  notice: {
    color: '#34856c',
    fontSize: 12,
    marginTop: 12,
  },
  error: {
    color: '#b94d61',
    fontSize: 12,
    marginTop: 10,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e8f5',
    backgroundColor: '#fff',
    borderRadius: 17,
    marginTop: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#20334f',
  },
  requestType: {
    fontSize: 11,
    color: '#71849f',
    marginTop: 4,
  },
  statusBadge: {
    fontSize: 10,
    color: '#405573',
    backgroundColor: '#edf0f6',
    padding: 7,
    borderRadius: 7,
    overflow: 'hidden',
  },
  dateSummary: {
    fontSize: 11,
    lineHeight: 18,
    color: '#405573',
    marginTop: 12,
  },
  reason: {
    fontSize: 12,
    lineHeight: 19,
    color: '#71849f',
    marginTop: 6,
  },
  decisionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#fce8ec',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    color: '#b94d61',
    fontSize: 12,
    fontWeight: '700',
  },
  approveButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#e1f3eb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: {
    color: '#34856c',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#edf0f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  link: {
    color: '#345cf2',
    fontSize: 12,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27,43,68,0.35)',
    padding: 20,
    justifyContent: 'center',
  },
  modal: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#20334f',
  },
  option: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f8',
    justifyContent: 'center',
  },
  noteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#dce5f3',
    backgroundColor: '#fcfdff',
    borderRadius: 12,
    padding: 12,
    color: '#20334f',
    textAlignVertical: 'top',
  },
});
