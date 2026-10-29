import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { getTaskAssignees } from '../../../src/core/admin/task-assignees';
import { useToastState } from '../../../src/ui/useToastState';
import { SearchField } from '../../../src/ui/SearchField';
import { SummaryMetrics } from '../../../src/ui/SummaryMetrics';
import { apiErrorMessage } from '../../../src/core/admin/http';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ToastModal as Modal } from '../../../src/ui/Toast';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useRouter,
} from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import axios from 'axios';
import { api } from '../../../src/core/api/client';

import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminPageHeading, useWebSectionHeader } from '../../../src/ui/AdminPageHeading';



import {
  getEmployees,
  type Employee,
} from '../../../src/core/employees';

import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';

import {
  getAdminScope,
  selectAdminBranch,
  useAdminScope,
} from '../../../src/core/admin/scope';
import { getAvailableBranches } from '../../../src/core/admin/available-branches';

// =====================================================
// CONFIGURATION
// =====================================================

const PAGE_SIZE = 10;

// =====================================================
// TYPES
// =====================================================

type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

type TaskPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

type TaskUser = {
  id: string;
  name: string;
  email?: string;
};

type Task = {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;

  title: string;
  description: string | null;

  status: TaskStatus;
  priority: TaskPriority;

  assignedToId: string;
  createdById: string;

  dueDate: string | null;
  completedAt: string | null;

  createdAt: string;
  updatedAt: string;

  assignedTo?: TaskUser;
  createdBy?: TaskUser;

  _count?: {
    comments: number;
  };
};

type BranchOption = {
  id: string;
  name: string;
  status: string;
};

const filters = [
  'All',
  'Today',
  'Open',
  'In progress',
  'On hold',
  'Completed',
  'Cancelled',
] as const;

type Filter = (typeof filters)[number];

// =====================================================
// HELPERS
// =====================================================

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'TODO':
      return 'Open';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'ON_HOLD':
      return 'On hold';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

function priorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Normal';
    case 'HIGH':
      return 'High';
    case 'URGENT':
      return 'Urgent';
    default:
      return priority;
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isDueToday(task: Task): boolean {
  if (!task.dueDate) return false;

  const dueDate = new Date(task.dueDate);

  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    dueDate.getFullYear() === now.getFullYear() &&
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getDate() === now.getDate()
  );
}

function isOverdue(task: Task): boolean {
  if (
    !task.dueDate ||
    task.status === 'COMPLETED' ||
    task.status === 'CANCELLED'
  ) {
    return false;
  }

  const dueDate = new Date(task.dueDate);

  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  // Date-only comparison in the user's local timezone.
  const dueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  return dueDay < today;
}

function isOpen(task: Task): boolean {
  return (
    task.status === 'TODO' ||
    task.status === 'IN_PROGRESS' ||
    task.status === 'ON_HOLD'
  );
}

function getErrorMessage(error: unknown): string {
  return apiErrorMessage(error, "Could not load tasks. Please retry.");
}

// =====================================================
// AUTHENTICATION
// =====================================================

// =====================================================
// BACKEND API
// =====================================================

async function getTasksFromApi(): Promise<Task[]> {
  const scope = await getAdminScope();
  const response = await api.get<Task[]>('/tasks', { params: { companyId: scope.companyId, ...(scope.branchId ? { branchId: scope.branchId } : {}) } });

  if (!Array.isArray(response.data)) {
    throw new Error(
      'Invalid tasks response from backend.',
    );
  }

  return response.data;
}

// =====================================================
// TASK ICON
// =====================================================

function TaskIcon({
  name,
}: {
  name: 'search' | 'task';
}) { return <AppIcon name={name === 'search' ? 'search' : 'check-square'} size={20} color="#71829c" />; }

// =====================================================
// COMPONENT
// =====================================================

export default function FollowUpsPage() {
  const webHeader = useWebSectionHeader();
  const selectedScope = useAdminScope();
  const { styles, recordGrid } =
    useAdminLayout(baseStyles);

  const { desktop } = useAdminViewport();

  const router = useRouter();

  const searchRef = useRef<TextInput>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] =
    useState<BranchOption[]>([]);

  const [companyName, setCompanyName] =
    useState('BranchSuite');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState('', 'error');
  const [attempt, setAttempt] = useState(0);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const [branchId, setBranchId] = useState('');
  const [branchPicker, setBranchPicker] =
    useState(false);

  const [page, setPage] = useState(0);
  useEffect(() => {
    setBranchId(selectedScope?.branchId ?? '');
    setPage(0);
  }, [selectedScope?.branchId]);

  // ===================================================
  // LOAD TASKS FROM POSTGRESQL API
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError('');

        try {
          const [scope, taskRecords, employeeRecords, branchRecords] =
            await Promise.all([
              getAdminScope(),
              getTasksFromApi(),
              getTaskAssignees(),
              getAvailableBranches(),
            ]);

          if (!active) return;

          const validTasks = taskRecords.filter(
            (task) => task.companyId === scope.companyId,
          );

          setTasks(validTasks);
          setEmployees(employeeRecords);

          setBranches(
            branchRecords.filter(
              (branch) => branch.status === 'ACTIVE',
            ),
          );

          setCompanyName('BranchSuite');
        } catch (reason) {
          if (active) {
            setError(getErrorMessage(reason));
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
    }, [attempt, selectedScope?.branchId]),
  );

  // ===================================================
  // DISPLAY HELPERS
  // ===================================================

  const employeeName = useCallback(
    (task: Task): string => {
      return (
        task.assignedTo?.name ||
        employees.find(
          (employee) =>
            employee.id === task.assignedToId,
        )?.fullName ||
        'Employee unavailable'
      );
    },
    [employees],
  );

  const branchName = useCallback(
    (task: Task): string => {
      return (
        branches.find(
          (branch) =>
            branch.id === task.branchId,
        )?.name ||
        employees.find(
          (employee) =>
            employee.branchId === task.branchId,
        )?.branch ||
        'Unknown branch'
      );
    },
    [branches, employees],
  );

  const selectedBranchName =
    branches.find(
      (branch) => branch.id === branchId,
    )?.name ?? 'All branches';

  // ===================================================
  // FILTER TASKS
  // ===================================================

  const scopedTasks = useMemo(() => {
    if (!branchId) return tasks;

    return tasks.filter(
      (task) => task.branchId === branchId,
    );
  }, [tasks, branchId]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();

    return scopedTasks.filter((task) => {
      const matchesSearch =
        !search ||
        [
          task.title,
          task.description ?? '',
          employeeName(task),
          branchName(task),
          priorityLabel(task.priority),
          statusLabel(task.status),
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);

      if (!matchesSearch) return false;

      switch (filter) {
        case 'Today':
          return isDueToday(task);

        case 'Open':
          return task.status === 'TODO';

        case 'In progress':
          return task.status === 'IN_PROGRESS';

        case 'On hold':
          return task.status === 'ON_HOLD';

        case 'Completed':
          return task.status === 'COMPLETED';

        case 'Cancelled':
          return task.status === 'CANCELLED';

        default:
          return true;
      }
    });
  }, [
    scopedTasks,
    query,
    filter,
    employeeName,
    branchName,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(visible.length / PAGE_SIZE),
  );

  const currentPage = Math.min(
    page,
    totalPages - 1,
  );

  const shown = visible.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  const metrics = useMemo(
    () => [
      {
        label: 'To do',
        value: scopedTasks.filter(isOpen).length,
      },
      {
        label: 'Due today',
        value: scopedTasks.filter(
          (task) =>
            isOpen(task) && isDueToday(task),
        ).length,
      },
      {
        label: 'Completed',
        value: scopedTasks.filter(
          (task) =>
            task.status === 'COMPLETED',
        ).length,
      },
    ],
    [scopedTasks],
  );

  // ===================================================
  // ACTIONS
  // ===================================================

  function updateBranch(value: string) {
    setBranchId(value);
    void selectAdminBranch(value || null);
    setPage(0);
    setBranchPicker(false);
  }

  function updateFilter(value: Filter) {
    setFilter(value);
    setPage(0);
  }

  function openTask(task: Task) {
    router.push({
      pathname: '/admin/tasks/[id]',
      params: {
        id: task.id,
      },
    });
  }

  function assignTask() {
    router.push('/admin/tasks');
  }

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>

        {/* MOBILE HEADER */}



        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* PAGE HEADING */}

          <AdminPageHeading
            title="Tasks & Follow-ups"
            branch={{ value: selectedBranchName, label: "Choose task branch", onPress: () => setBranchPicker(true) }} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Assign task"
              onPress={assignTask}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>
                Assign Task
              </Text>
            </Pressable>
          </AdminPageHeading>

          {/* LOADING */}

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                size="large"
                color="#345cf2"
              />
              <Text style={styles.subtitle}>
                Loading tasks...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.empty}>
              <Text style={styles.error}>
                {error}
              </Text>

              <Pressable
                onPress={() =>
                  setAttempt(
                    (current) => current + 1,
                  )
                }
                style={styles.filter}
              >
                <Text style={styles.link}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* SUMMARY */}

              <SummaryMetrics singleRow title="Task overview" items={metrics.map(metric => ({
                id: metric.label.toLowerCase().replaceAll(' ', '-'),
                label: metric.label,
                value: metric.value,
                icon: metric.label === 'Due today' ? 'clock' : metric.label === 'Completed' ? 'check-circle' : 'list',
                tone: metric.label === 'Due today' ? 'warning' : metric.label === 'Completed' ? 'success' : 'neutral',
              }))} />

              {/* SEARCH */}

              <SearchField
                  ref={searchRef}
                  accessibilityLabel="Search tasks or employee"
                  value={query}
                  onChangeText={(value) => {
                    setQuery(value);
                    setPage(0);
                  }}
                />

              {/* FILTERS */}

              <View style={styles.filters}>
                {filters.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: filter === value,
                    }}
                    onPress={() =>
                      updateFilter(value)
                    }
                    style={[
                      styles.filter,
                      filter === value &&
                        styles.selectedFilter,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        filter === value &&
                          styles.link,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}

                {desktop && !webHeader && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setBranchPicker(true)
                    }
                    style={styles.filter}
                  >
                    <Text style={styles.filterText}>
                      {selectedBranchName}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* RESULTS */}

              <Text style={styles.resultCount}>
                {visible.length} tasks
                {visible.length > 0
                  ? ` · showing ${
                      currentPage * PAGE_SIZE + 1
                    }–${
                      currentPage * PAGE_SIZE +
                      shown.length
                    }`
                  : ''}
              </Text>

              <View style={styles.taskGrid}>
                {shown.map((task) => (
                  <Pressable
                    key={task.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open task ${task.title}`}
                    onPress={() =>
                      openTask(task)
                    }
                    style={({ pressed }) => [
                      styles.taskCard,
                      {
                        width:
                          recordGrid.cardWidth,
                      },
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <View
                      style={styles.taskHeading}
                    >
                      <View style={styles.taskType}>
                        <TaskIcon name="task" />
                        <Text
                          style={
                            styles.taskTypeText
                          }
                        >
                          {priorityLabel(
                            task.priority,
                          )} Priority
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.badge,
                          task.status ===
                            'COMPLETED' &&
                            styles.completedBadge,
                          task.status ===
                            'IN_PROGRESS' &&
                            styles.progressBadge,
                          task.status ===
                            'CANCELLED' &&
                            styles.cancelledBadge,
                        ]}
                      >
                        <Text
                          style={styles.badgeText}
                        >
                          {statusLabel(
                            task.status,
                          )}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.taskTitle}>
                      {task.title}
                    </Text>

                    <View style={styles.taskFooter}>
                      <Text style={styles.taskMeta}>
                        Due {formatDate(task.dueDate)}
                        {' · '}
                        {employeeName(task)}
                      </Text>

                      {isOverdue(task) && (
                        <Text style={styles.overdue}>
                          Overdue
                        </Text>
                      )}
                    </View>

                    <Text style={styles.taskMeta}>
                      Branch: {branchName(task)}
                    </Text>

                    <Text style={styles.taskMeta}>
                      Created: {formatDate(task.createdAt)}
                    </Text>

                    {!!task._count?.comments && (
                      <Text style={styles.taskMeta}>
                        Comments: {task._count.comments}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* EMPTY STATE */}

              {visible.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.taskTitle}>
                    {tasks.length
                      ? 'No matching tasks'
                      : 'No tasks yet'}
                  </Text>

                  <Text style={styles.subtitle}>
                    {tasks.length
                      ? 'Try another search, status or branch.'
                      : 'Assign a task to begin tracking employee work.'}
                  </Text>

                  {!tasks.length && (
                    <Pressable
                      onPress={assignTask}
                      style={styles.primary}
                    >
                      <Text
                        style={styles.primaryText}
                      >
                        Assign First Task
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* PAGINATION */}

              {visible.length > PAGE_SIZE && (
                <View
                  style={styles.pagination}
                >
                  <Pressable
                    disabled={
                      currentPage === 0
                    }
                    onPress={() =>
                      setPage(
                        currentPage - 1,
                      )
                    }
                    style={[
                      styles.filter,
                      currentPage === 0 &&
                        styles.disabled,
                    ]}
                  >
                    <Text
                      style={styles.filterText}
                    >
                      Previous
                    </Text>
                  </Pressable>

                  <Text
                    style={styles.resultCount}
                  >
                    Page {currentPage + 1} of {totalPages}
                  </Text>

                  <Pressable
                    disabled={
                      currentPage + 1 >= totalPages
                    }
                    onPress={() =>
                      setPage(
                        currentPage + 1,
                      )
                    }
                    style={[
                      styles.filter,
                      currentPage + 1 >=
                        totalPages &&
                        styles.disabled,
                    ]}
                  >
                    <Text
                      style={styles.filterText}
                    >
                      Next
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>

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
            <View style={styles.taskHeading}>
              <Text style={styles.taskTitle}>
                Choose Branch
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setBranchPicker(false)
                }
                style={styles.filter}
              >
                <Text style={styles.filterText}>
                  Close
                </Text>
              </Pressable>
            </View>

            <ScrollView>
              <Pressable
                onPress={() =>
                  updateBranch('')
                }
                style={styles.branchOption}
              >
                <Text style={styles.filterText}>
                  All branches
                </Text>
              </Pressable>

              {branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  onPress={() =>
                    updateBranch(branch.id)
                  }
                  style={styles.branchOption}
                >
                  <Text style={styles.filterText}>
                    {branch.name}
                  </Text>
                </Pressable>
              ))}
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
    backgroundColor: '#f6f8fd',
  },

  page: {
    flex: 1,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
  },

  flex: {
    flex: 1,
    minWidth: 0,
  },

  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4eaf5',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  companyName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#20334f',
  },

  headerCaption: {
    fontSize: 9,
    lineHeight: 14,
    color: '#8192ad',
  },

  headerSearch: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f5f7fc',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#eaf0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#345cf2',
  },

  headerFilters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  headerFilter: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    borderRadius: 9,
    backgroundColor: '#f7f9ff',
  },

  content: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 14,
  },

  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  title: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    color: '#20334f',
  },

  subtitle: {
    fontSize: 11,
    lineHeight: 18,
    color: '#71829c',
    marginTop: 5,
  },

  primary: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#345cf2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  summary: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    borderRadius: 16,
    backgroundColor: '#fff',
    marginTop: 6,
  },

  summaryMetric: { flex: 1,

    paddingHorizontal: 14, alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 16, minWidth: 0 },

  metricDivider: {
    borderLeftWidth: 1,
    borderLeftColor: '#edf1f8',
  },

  metricValue: { fontSize: 21,
    fontWeight: '700',
    color: '#20334f', textAlign: 'left', flexShrink: 1 },

  metricLabel: { fontSize: 10,
    lineHeight: 16,
    color: '#71829c',
    marginTop: 3, textAlign: 'left', flexShrink: 1 },

  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#dce5f3',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },

  searchText: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    fontSize: 13,
    color: '#20334f',
    paddingVertical: 10,
  },

  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  filter: {
    minHeight: 38,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    borderRadius: 9,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },

  selectedFilter: {
    backgroundColor: '#eaf0ff',
    borderColor: '#d5dfff',
  },

  filterText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
    color: '#405573',
  },

  link: {
    color: '#345cf2',
    fontSize: 11,
    fontWeight: '600',
  },

  resultCount: {
    fontSize: 10,
    lineHeight: 16,
    color: '#71829c',
  },

  taskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  taskCard: {
    minWidth: 0,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#fff',
  },

  taskHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  taskType: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  taskTypeText: {
    fontSize: 10,
    color: '#71829c',
  },

  badge: {
    maxWidth: '45%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#fff1d9',
  },

  completedBadge: {
    backgroundColor: '#def6ef',
  },

  progressBadge: {
    backgroundColor: '#eee7ff',
  },

  cancelledBadge: {
    backgroundColor: '#f2edf0',
  },

  badgeText: {
    fontSize: 9,
    lineHeight: 13,
    color: '#405573',
    fontWeight: '600',
  },

  taskTitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: '#20334f',
    marginTop: 12,
    flexShrink: 1,
  },

  taskFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#edf1f8',
  },

  taskMeta: {
    fontSize: 10,
    lineHeight: 16,
    color: '#71829c',
    marginTop: 4,
  },

  overdue: {
    color: '#c34157',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },

  pressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.4,
  },

  empty: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#fff',
    gap: 8,
  },

  error: {
    fontSize: 13,
    lineHeight: 20,
    color: '#b94d61',
  },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  glyph: {
    fontSize: 17,
    color: '#71829c',
  },

  overlay: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(21,43,60,0.25)',
  },

  modal: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 18,
  },

  branchOption: {
    minHeight: 48,
    padding: 12,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f8',
  },
});
