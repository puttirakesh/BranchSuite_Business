import { useToastState } from '../../../src/ui/useToastState';
import { SearchField } from '../../../src/ui/SearchField';
import { SummaryMetrics } from '../../../src/ui/SummaryMetrics';
import { apiErrorMessage } from '../../../src/core/admin/http';

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
  useEmployeeStyles,
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
  return apiErrorMessage(error, "Could not load your assigned tasks.");
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
  const s = useEmployeeStyles();
  const router = useRouter();

  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState('', 'error');

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
      <SummaryMetrics title="Task overview" items={[
        { id: 'todo', label: 'To do', value: outstanding.length, icon: 'list', tone: 'neutral' },
        { id: 'due-today', label: 'Due today', value: outstanding.filter(task => isToday(task.dueDate)).length, icon: 'clock', tone: 'warning' },
        { id: 'completed', label: 'Completed', value: completed.length, icon: 'check-circle', tone: 'success' },
      ]} />

      <SearchField
        accessibilityLabel="Search tasks"
        value={query}
        onChangeText={setQuery}
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
