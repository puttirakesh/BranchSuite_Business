
import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import axios from 'axios';

import { api } from '../../../src/core/api/client';

import { money } from '../../../src/features/employee/data';

import {
  Icon,
  Tile,
} from '../../../src/features/employee/components';

import { s } from '../../../src/features/employee/styles';

import {
  AttendanceCard,
} from '../../../src/features/employee/cards';

import {
  useEmployeeWorkspace,
} from '../../../src/features/employee/workspace';

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

type EmployeeTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  assignedToId: string;
};

// =====================================================
// HELPERS
// =====================================================

function isOutstanding(task: EmployeeTask): boolean {
  return (
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED'
  );
}

function formatDueDate(value: string | null): string {
  if (!value) return 'No due date';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'TODO':
      return 'To Do';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'ON_HOLD':
      return 'On Hold';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }

    if (error.response?.status === 401) {
      return 'Session expired. Please sign in again.';
    }

    if (error.response?.status === 403) {
      return 'You do not have access to these tasks.';
    }

    if (!error.response) {
      return 'Unable to connect to the backend.';
    }
  }

  return error instanceof Error
    ? error.message
    : 'Unable to load assigned tasks.';
}

// =====================================================
// EMPLOYEE DASHBOARD
// =====================================================

export default function DashboardScreen() {
  const router = useRouter();

  // Keep the existing employee workspace for
  // attendance, navigation, leave and payroll.
  const {
    width,
    splitLayout,
    go,
    leaveBalance,
    employeeName,
    payslips,
  } = useEmployeeWorkspace();

  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState('');

  const [reload, setReload] = useState(0);

  // ===================================================
  // LOAD ASSIGNED TASKS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadTasks() {
        setLoadingTasks(true);
        setTaskError('');

        try {
          const response = await api.get<EmployeeTask[]>(
            '/tasks/my',
          );

          if (!active) return;

          if (!Array.isArray(response.data)) {
            throw new Error(
              'Invalid task response received from backend.',
            );
          }

          setTasks(response.data);
        } catch (error) {
          if (active) {
            setTaskError(getErrorMessage(error));
            setTasks([]);
          }
        } finally {
          if (active) {
            setLoadingTasks(false);
          }
        }
      }

      void loadTasks();

      return () => {
        active = false;
      };
    }, [reload]),
  );

  // ===================================================
  // TASK STATISTICS
  // ===================================================

  const outstanding = useMemo(() => {
    return tasks.filter(isOutstanding);
  }, [tasks]);

  const completedCount = useMemo(() => {
    return tasks.filter(
      (task) => task.status === 'COMPLETED',
    ).length;
  }, [tasks]);

  const nextTasks = useMemo(() => {
    return [...outstanding].sort((a, b) => {
      const aDate = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      const bDate = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;

      return aDate - bDate;
    }).slice(0, 3);
  }, [outstanding]);

  const latestPayslip = payslips[0];

  const latestNetPay = latestPayslip
    ? Number(
      latestPayslip.netPay ??
      latestPayslip.netSalary ??
      0,
    )
    : null;

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <>
      {/* GREETING */}

      <View style={s.greeting}>
        <Text style={s.hello}>
          Hello, {employeeName}.
        </Text>

        <Text style={s.greetingSubtitle}>
          One clear place for your day, tasks and pay.
        </Text>
      </View>

      <View
        style={[
          s.columns,
          splitLayout && s.desktopColumns,
        ]}
      >
        {/* LEFT COLUMN */}

        <View style={s.column}>
          {/* Existing attendance component.
              Its underlying data source is unchanged. */}

          <AttendanceCard />

          <Tile
            title="Apply for leave"
            description={`${leaveBalance("Casual leave") ?? "—"
              } casual · ${leaveBalance("Sick leave") ?? "—"
              } sick days`} symbol="♧"
            onPress={() => go('leave')}
          />

          <Tile
            title="My profile"
            description="Details & documents"
            symbol="♙"
            onPress={() => go('profile')}
          />
        </View>

        {/* RIGHT COLUMN */}

        <View style={s.column}>
          <View style={s.metrics}>
            {/* TASK COUNT */}

            <Pressable
              accessibilityRole="button"
              onPress={() => go('tasks')}
              style={[
                s.metric,
                {
                  backgroundColor: '#EDF3FF',
                },
              ]}
            >
              <Icon symbol="☑" />

              <Text style={s.metricLabel}>
                Tasks to do
              </Text>

              {loadingTasks ? (
                <ActivityIndicator
                  color="#345cf2"
                  style={{ marginVertical: 8 }}
                />
              ) : (
                <Text style={s.metricValue}>
                  {taskError
                    ? '—'
                    : outstanding.length}
                </Text>
              )}

              <Text style={s.small}>
                Assigned only to you
              </Text>
            </Pressable>

            {/* PAYROLL */}

            <Pressable
              accessibilityRole="button"
              onPress={() => go('payroll')}
              style={[
                s.metric,
                {
                  backgroundColor: '#F3EEFC',
                },
              ]}
            >
              <Icon
                symbol="▤"
                lavender
              />

              <Text style={s.metricLabel}>
                Latest take-home
              </Text>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[
                  s.metricValue,
                  width < 360 && {
                    fontSize: 23,
                  },
                ]}
              >
                {latestNetPay === null ||
                  !Number.isFinite(latestNetPay)
                  ? '—'
                  : money(latestNetPay)}
              </Text>

              <Text style={s.small}>
                {latestPayslip
                  ? `${latestPayslip.run.period.month}/${latestPayslip.run.period.year} · ${latestPayslip.run.status}`
                  : 'No published payslip'}
              </Text>
            </Pressable>
          </View>

          {/* NEXT TASKS */}

          <View style={s.section}>
            <Text style={s.sectionTitle}>
              Your next tasks
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => go('tasks')}
            >
              <Text style={s.link}>
                View all ›
              </Text>
            </Pressable>
          </View>

          {/* TASK LOADING */}

          {loadingTasks ? (
            <View style={s.card}>
              <ActivityIndicator color="#345cf2" />

              <Text
                style={[
                  s.small,
                  {
                    marginTop: 10,
                  },
                ]}
              >
                Loading assigned tasks...
              </Text>
            </View>
          ) : taskError ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                Tasks unavailable
              </Text>

              <Text style={s.small}>
                {taskError}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setReload((value) => value + 1)
                }
                style={{
                  marginTop: 12,
                  paddingVertical: 10,
                }}
              >
                <Text style={s.link}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : nextTasks.length > 0 ? (
            nextTasks.map((task) => (
              <Pressable
                key={task.id}
                accessibilityRole="button"
                accessibilityLabel={`Open task ${task.title}`}
                onPress={() =>
                  router.push({
                    pathname: '/employee/tasks/[id]',
                    params: {
                      id: task.id,
                    },
                  })
                }
                style={[
                  s.card,
                  {
                    marginBottom: 12,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <Text
                    style={[
                      s.cardTitle,
                      {
                        flex: 1,
                      },
                    ]}
                  >
                    {task.title}
                  </Text>

                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color:
                        task.priority === 'URGENT'
                          ? '#c34157'
                          : '#345cf2',
                    }}
                  >
                    {task.priority}
                  </Text>
                </View>

                {!!task.description && (
                  <Text
                    style={[
                      s.small,
                      { marginTop: 8 },
                    ]}
                    numberOfLines={2}
                  >
                    {task.description}
                  </Text>
                )}

                <Text
                  style={[
                    s.small,
                    { marginTop: 10 },
                  ]}
                >
                  Due: {formatDueDate(task.dueDate)}
                </Text>

                <Text
                  style={[
                    s.small,
                    { marginTop: 4 },
                  ]}
                >
                  Status: {statusLabel(task.status)}
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                Your tasks are up to date
              </Text>

              <Text style={s.small}>
                No outstanding tasks are assigned to you.
              </Text>

              {completedCount > 0 && (
                <Text
                  style={[
                    s.small,
                    { marginTop: 8 },
                  ]}
                >
                  Completed tasks: {completedCount}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </>
  );
}
