import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { getTaskAssignees } from '../../../src/core/admin/task-assignees';
import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { useToastState } from '../../../src/ui/useToastState';
import { apiErrorMessage } from '../../../src/core/admin/http';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";
import { Dropdown } from "../../../src/ui/Dropdown";

import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import axios from 'axios';
import { api } from '../../../src/core/api/client';

import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import {
  getEmployees,
  type Employee,
} from '../../../src/core/employees';

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

type TaskComment = {
  id: string;
  message: string;
  createdAt: string;
  userId: string;
  user: TaskUser;
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
  assignedTo: TaskUser;
  createdBy: TaskUser;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: TaskComment[];
};

const statuses: {
  value: TaskStatus;
  label: string;
}[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const priorityLabels: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

function statusLabel(status: TaskStatus): string {
  return (
    statuses.find((item) => item.value === status)?.label ??
    status
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleDateString();
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  return apiErrorMessage(error, "Something went wrong. Please try again.");
}

async function taskApi<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await api.request<T>({
    url: path,
    method,
    data,
  });

  return response.data;
}

export default function TaskDetailsPage() {
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const router = useRouter();

  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [task, setTask] = useState<Task | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useToastState('', 'error');
  const [attempt, setAttempt] = useState(0);


  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useToastState('', 'error');
  const [notice, setNotice] = useToastState('', 'success');

  const savingRef = useRef(false);

  const loadTask = useCallback(async (): Promise<Task> => {
    if (!id) {
      throw new Error('Task ID is missing.');
    }

    return taskApi<Task>(
      'GET',
      `/tasks/${encodeURIComponent(id)}`,
    );
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setLoadError('');
        setSaveError('');
        setNotice('');

        try {
          const [record, employeeRecords] =
            await Promise.all([
              loadTask(),
              getTaskAssignees(),
            ]);

          if (!active) return;

          setTask(record);
          setEmployees(employeeRecords);
          setStatus(record.status);
          setNote('');
        } catch (error) {
          if (active) {
            setLoadError(getErrorMessage(error));
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
    }, [loadTask, attempt]),
  );

  const assignedEmployee = employees.find(
    (employee) => employee.id === task?.assignedToId,
  );

  const branchName =
    employees.find(
      (employee) => employee.branchId === task?.branchId,
    )?.branch ?? task?.branchId ?? 'Unknown branch';

  const statusChanged =
    task !== null && status !== task.status;

  const hasNote = note.trim().length > 0;

  const canSave =
    !loading &&
    !!task &&
    !saving &&
    (statusChanged || hasNote);

  function back() {
    if (savingRef.current) return;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin/tasks');
    }
  }

  function editTask() {
    if (!task || savingRef.current) return;

    router.push({
      pathname: '/admin/tasks',
      params: {
        edit: task.id,
      },
    });
  }

  async function saveUpdate() {
    if (
      !task ||
      !id ||
      savingRef.current ||
      !canSave
    ) {
      return;
    }

    if (!statusChanged && !hasNote) {
      setSaveError(
        'Select a different status or enter a progress note.',
      );
      return;
    }

    if (note.trim().length > 2000) {
      setSaveError(
        'Progress note cannot exceed 2000 characters.',
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    setNotice('');

    let statusWasSaved = false;

    try {
      if (statusChanged) {
        await taskApi(
          'PATCH',
          `/tasks/${encodeURIComponent(id)}/status`,
          {
            status,
          },
        );

        statusWasSaved = true;
      }

      if (hasNote) {
        await taskApi(
          'POST',
          `/tasks/${encodeURIComponent(id)}/comments`,
          {
            message: note.trim(),
          },
        );
      }

      const updated = await loadTask();

      setTask(updated);
      setStatus(updated.status);
      setNote('');

      setNotice(
        statusChanged && hasNote
          ? 'Task status and progress note saved.'
          : statusChanged
            ? 'Task status updated successfully.'
            : 'Progress note added successfully.',
      );
    } catch (error) {
      // A status change may have succeeded before a comment
      // request failed. Refresh rather than claiming that
      // both operations failed.
      if (statusWasSaved) {
        try {
          const updated = await loadTask();

          setTask(updated);
          setStatus(updated.status);
        } catch {
          // Preserve the original request error.
        }
      }

      setSaveError(
        statusWasSaved && hasNote
          ? `Task status was saved, but the note may not have been saved. ${getErrorMessage(error)}`
          : getErrorMessage(error),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const detailFields = task
    ? [
        {
          label: 'Assigned to',
          value:
            task.assignedTo?.name ??
            assignedEmployee?.fullName ??
            'Employee unavailable',
        },
        {
          label: 'Branch',
          value: branchName,
        },
        {
          label: 'Created on',
          value: formatDateTime(task.createdAt),
        },
        {
          label: 'Due date',
          value: formatDate(task.dueDate),
        },
        {
          label: 'Priority',
          value: priorityLabels[task.priority],
        },
        {
          label: 'Assigned by',
          value: task.createdBy?.name ?? 'Unknown',
        },
        {
          label: 'Completed on',
          value: formatDateTime(task.completedAt),
        },
      ]
    : [];

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View
        style={styles.flex}

      >
        <View style={styles.page}>


          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AdminPageHeading title={task?.title || "Task details"} onBack={back} backDisabled={saving}>{!!task && !loadError ? <Pressable accessibilityRole="button" disabled={saving} onPress={editTask} style={styles.edit}><Text style={styles.editText}>Edit / Reassign</Text></Pressable> : null}</AdminPageHeading>

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator
                  size="large"
                  color="#345cf2"
                />

                <Text style={styles.subtitle}>
                  Loading task details...
                </Text>
              </View>
            ) : loadError ? (
              <View style={styles.card}>
                <Text style={styles.error}>
                  {loadError}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  style={styles.back}
                  onPress={() =>
                    setAttempt((value) => value + 1)
                  }
                >
                  <Text style={styles.link}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : task ? (
              <>

                <View style={styles.card}>
                  <View style={styles.between}>
                    <Text style={styles.cardTitle}>
                      Task Details
                    </Text>

                    <View
                      style={[
                        styles.badge,
                        task.status === 'COMPLETED' &&
                          styles.completedBadge,
                        task.status === 'CANCELLED' &&
                          styles.cancelledBadge,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {statusLabel(task.status)}
                      </Text>
                    </View>
                  </View>

                  {detailFields.map((field) => (
                    <View
                      key={field.label}
                      style={styles.detail}
                    >
                      <Text style={styles.detailLabel}>
                        {field.label}
                      </Text>

                      <Text style={styles.detailValue}>
                        {field.value}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.instructions}>
                    <Text style={styles.instructionsLabel}>
                      Instructions / Expected Outcome
                    </Text>

                    <Text style={styles.instructionsText}>
                      {task.description?.trim() ||
                        'No extra instructions provided.'}
                    </Text>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    Update Progress
                  </Text>

                  <Dropdown
                    label="Task Status"
                    value={status}
                    options={statuses.map((option) => ({ value: option.value, label: option.label }))}
                    onChange={(value) => {
                      setStatus(value as typeof status);
                      setSaveError('');
                      setNotice('');
                    }}
                    disabled={saving}
                  />



            <TextInput label={"Progress / Completion Note"}
                    accessibilityLabel="Progress note"
                    value={note}
                    onChangeText={(value) => {
                      setNote(value);
                      setSaveError('');
                      setNotice('');
                    }}
                    editable={!saving}
                    maxLength={2000}
                    multiline
                    style={[
                      styles.input,
                      styles.multiline,
                    ]}
                  />

                  {!!saveError && (
                    <Text style={styles.error}>
                      {saveError}
                    </Text>
                  )}

                  {!!notice && (
                    <Text style={styles.notice}>
                      {notice}
                    </Text>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      busy: saving,
                      disabled: !canSave,
                    }}
                    disabled={!canSave}
                    onPress={() => void saveUpdate()}
                    style={[
                      styles.saveButton,
                      !canSave && styles.dim,
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator
                        color="#ffffff"
                      />
                    ) : (
                      <Text style={styles.saveText}>
                        Save Update
                      </Text>
                    )}
                  </Pressable>
                </View>

                <Text style={styles.historyTitle}>
                  Activity / Progress Comments
                </Text>

                {task.comments?.length ? (
                  task.comments.map((comment) => (
                    <View
                      key={comment.id}
                      style={styles.historyCard}
                    >
                      <View style={styles.between}>
                        <Text style={styles.commentAuthor}>
                          {comment.user?.name ??
                            'Team member'}
                        </Text>
                      </View>

                      <Text style={styles.detailLabel}>
                        {formatDateTime(
                          comment.createdAt,
                        )}
                      </Text>

                      <Text style={styles.historyNote}>
                        {comment.message}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View
                    style={[
                      styles.historyCard,
                      styles.emptyHistory,
                    ]}
                  >
                    <View style={styles.check}>
                      <AppIcon symbol="✓" style={styles.checkText} />
                    </View>

                    <Text style={styles.detailValue}>
                      No progress comments yet
                    </Text>

                    <Text style={styles.subtitle}>
                      Updates from admins and employees
                      will appear here.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.error}>
                  Task details are unavailable.
                </Text>
              </View>
            )}
          </ScrollView>

          <AdminBottomNavigation disabled={saving} />
        </View>
      </View>

    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f6f8fd',
  },
  flex: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e4eaf5',
  },
  companyName: {
    minHeight: 18,
    fontSize: 14,
    fontWeight: '800',
    color: '#20334f',
  },
  headerCaption: {
    fontSize: 10,
    color: '#8794aa',
    marginTop: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eaf0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#345cf2',
    fontSize: 16,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 35,
  },
  back: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 12,
    color: '#657995',
  },
  edit: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce5f3',
    backgroundColor: '#ffffff',
  },
  editText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#405573',
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#20334f',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 18,
    color: '#7a8ba5',
    marginTop: 5,
  },
  loading: {
    marginTop: 35,
    alignItems: 'center',
    gap: 12,
  },
  card: {
    marginTop: 22,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#ffffff',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#20334f',
  },
  badge: {
    borderRadius: 7,
    backgroundColor: '#fff1d9',
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  completedBadge: {
    backgroundColor: '#e6f4ee',
  },
  cancelledBadge: {
    backgroundColor: '#f7e6e9',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6d6846',
  },
  detail: {
    marginTop: 20,
  },
  detailLabel: {
    fontSize: 10,
    color: '#8192ad',
    flexShrink: 1,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#20334f',
    marginTop: 5,
  },
  instructions: {
    padding: 14,
    marginTop: 24,
    backgroundColor: '#f5f7fc',
    borderRadius: 12,
  },
  instructionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#405573',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 12,
    lineHeight: 19,
    color: '#405573',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#405573',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#dce5f3',
    backgroundColor: '#fcfdff',
    padding: 13,
    fontSize: 14,
    color: '#20334f',
  },
  inputText: {
    fontSize: 14,
    color: '#20334f',
  },
  multiline: {
    marginTop: formSpacing.field,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 12,
    color: '#b94d61',
    marginTop: 10,
  },
  notice: {
    fontSize: 12,
    color: '#34856c',
    marginTop: 10,
  },
  saveButton: {
    minHeight: 46,
    marginTop: 22,
    borderRadius: 13,
    backgroundColor: '#345cf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  dim: {
    opacity: 0.6,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#20334f',
    marginTop: 24,
    marginBottom: 14,
  },
  historyCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#20334f',
  },
  historyNote: {
    fontSize: 12,
    lineHeight: 19,
    color: '#405573',
    marginTop: 12,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  check: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#eaf5f0',
    marginBottom: 10,
  },
  checkText: {
    fontSize: 20,
    color: '#34856c',
  },
  link: {
    fontSize: 12,
    fontWeight: '600',
    color: '#345cf2',
  },
});
