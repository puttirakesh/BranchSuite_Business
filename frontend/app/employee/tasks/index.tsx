
import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import axios from 'axios';

import {
  colors,
} from '../../../src/features/employee/data';

import {
  Field,
} from '../../../src/features/employee/components';

import {
  s,
} from '../../../src/features/employee/styles';

import { api } from '../../../src/core/api/client';

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

type ApiTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignedToId: string;
  companyId: string;
  branchId: string;
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

    if (!error.response) {
      return 'Unable to connect to the server. Check your network.';
    }
  }

  return error instanceof Error
    ? error.message
    : 'Could not load your assigned tasks.';
}

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
  }
}

function formatDueDate(value: string | null): string {
  if (!value) return 'No due date';

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

function isToday(value: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function TasksScreen() {
  const router = useRouter();

  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError('');

        try {
          const response = await api.get<ApiTask[]>(
            '/tasks/my',
          );

          if (!active) return;

          if (!Array.isArray(response.data)) {
            throw new Error(
              'Invalid tasks response from server.',
            );
          }

          setTasks(response.data);
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
    }, [reload]),
  );

  const outstanding = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status !== 'COMPLETED' &&
          task.status !== 'CANCELLED',
      ),
    [tasks],
  );

  const completed = useMemo(
    () =>
      tasks.filter(
        (task) => task.status === 'COMPLETED',
      ),
    [tasks],
  );

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(search) ||
        (task.description ?? '')
          .toLowerCase()
          .includes(search);

      if (!matchesSearch) return false;

      switch (filter) {
        case 'Today':
          return isToday(task.dueDate);
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
  }, [tasks, query, filter]);

  return (
    <>
      <View style={s.summary}>
        <View style={s.taskSummaryItem}>
          <Text style={s.taskSummaryValue}>
            {outstanding.length}
          </Text>
          <Text style={s.taskSummaryLabel}>
            to do
          </Text>
        </View>

        <View style={s.taskSummaryDivider} />

        <View style={s.taskSummaryItem}>
          <Text style={s.taskSummaryValue}>
            {outstanding.filter(
              (task) => isToday(task.dueDate),
            ).length}
          </Text>
          <Text style={s.taskSummaryLabel}>
            due today
          </Text>
        </View>

        <View style={s.taskSummaryDivider} />

        <View style={s.taskSummaryItem}>
          <Text style={s.taskSummaryValue}>
            {completed.length}
          </Text>
          <Text style={s.taskSummaryLabel}>
            completed
          </Text>
        </View>
      </View>

      <Field
        label="Search tasks"
        value={query}
        onChange={setQuery}
        placeholder="Search your assigned work"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {filters.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{
              selected: filter === value,
            }}
            onPress={() => setFilter(value)}
            style={[
              s.chip,
              filter === value && s.chipSelected,
            ]}
          >
            <Text
              style={[
                s.body,
                filter === value && {
                  color: colors.primary,
                },
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ padding: 24 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={s.small}>
            Loading assigned tasks...
          </Text>
        </View>
      ) : error ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={s.small}>{error}</Text>

          <Pressable
            onPress={() =>
              setReload((value) => value + 1)
            }
            style={{
              padding: 12,
              backgroundColor: '#eaf0ff',
              borderRadius: 10,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: colors.primary }}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {visible.map((task) => (
            <Pressable
              key={task.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/employee/tasks/[id]',
                  params: { id: task.id },
                })
              }
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e4eaf5',
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#20334f',
                    flex: 1,
                  }}
                >
                  {task.title}
                </Text>

                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: colors.primary,
                  }}
                >
                  {task.priority}
                </Text>
              </View>

              {!!task.description && (
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 12,
                    color: '#71829c',
                    marginTop: 8,
                  }}
                >
                  {task.description}
                </Text>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  gap: 8,
                }}
              >
                <Text style={s.small}>
                  Due: {formatDueDate(task.dueDate)}
                </Text>

                <Text style={s.small}>
                  {statusLabel(task.status)}
                </Text>
              </View>
            </Pressable>
          ))}

          {visible.length === 0 && (
            <Text style={s.small}>
              {tasks.length === 0
                ? 'No tasks assigned yet.'
                : 'No matches. Try another search or filter.'}
            </Text>
          )}
        </>
      )}
    </>
  );
}
