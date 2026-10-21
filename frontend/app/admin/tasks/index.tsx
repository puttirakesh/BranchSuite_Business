import { useToastState } from '../../../src/ui/useToastState';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { apiErrorMessage } from '../../../src/core/admin/http';
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";
import { DatePickerField } from "../../../src/ui/DatePickerField";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ToastModal as Modal } from '../../../src/ui/Toast';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import axios from 'axios';
import { api } from '../../../src/core/api/client';

import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { getEmployees, type Employee } from '../../../src/core/employees';
import {
  getAdminScope,
} from '../../../src/core/admin/scope';
import { getAvailableBranches } from '../../../src/core/admin/available-branches';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type Form = {
  title: string;
  description: string;
  branchId: string;
  employeeId: string;
  dueDate: string;
  priority: Priority;
};

type BranchOption = {
  id: string;
  name: string;
  status: string;
};

type SavedTask = {
  id: string;
  companyId: string;
  branchId: string;
  assignedToId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: Priority;
  status: string;
};

type Picker = 'branch' | 'employee' | 'priority';

const priorities: Array<{
  value: Priority;
  label: string;
}> = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Normal' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
  ];

const initialForm: Form = {
  title: '',
  description: '',
  branchId: '',
  employeeId: '',
  dueDate: '',
  priority: 'MEDIUM',
};

async function taskRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown,
): Promise<T> {
  try {
    const response = await api.request<T>({
      method,
      url: path,
      data,
    });

    return response.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Could not load tasks. Please retry.'));
  }
}

function dateToDisplay(value: string | null): string {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function dateToApi(value: string): string | null {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(
    value.trim(),
  );

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please retry.';
}

export default function AssignTaskPage() {
  const { styles } = useAdminLayout(baseStyles);

  const router = useRouter();

  const { edit } = useLocalSearchParams<{
    edit?: string;
  }>();

  const [form, setForm] = useState<Form>(initialForm);

  const [companyId, setCompanyId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useToastState('', 'error');
  const [saveError, setSaveError] = useToastState('', 'error');
  const [success, setSuccess] = useToastState('', 'success');

  const [picker, setPicker] = useState<Picker | null>(null);
  const [attempt, setAttempt] = useState(0);

  const savingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setLoadError('');

        try {
          const scope = await getAdminScope();

          const [employeeRecords, branchRecords, existing] =
            await Promise.all([
              getEmployees(),
              getAvailableBranches(scope.companyId),
              edit
                ? taskRequest<SavedTask>(
                  'GET',
                  `/tasks/${encodeURIComponent(edit)}`,
                )
                : Promise.resolve(null),
            ]);

          if (!active) return;

          const activeBranches = branchRecords.filter(
            (branch) => branch.status === 'ACTIVE',
          );

          const activeEmployees = employeeRecords.filter(
            (employee) =>
              employee.status !== 'inactive' &&
              employee.loginEnabled !== false,
          );

          setCompanyId(scope.companyId);
          setBranches(activeBranches);
          setEmployees(activeEmployees);

          if (existing) {
            if (existing.companyId !== scope.companyId) {
              throw new Error(
                'This task belongs to a different company.',
              );
            }

            setForm({
              title: existing.title,
              description: existing.description ?? '',
              branchId: existing.branchId,
              employeeId: existing.assignedToId,
              priority: existing.priority,
              dueDate: dateToDisplay(existing.dueDate),
            });
          } else {
            setForm({
              ...initialForm,
              branchId:
                activeBranches.length === 1
                  ? activeBranches[0].id
                  : '',
            });
          }
        } catch (error) {
          if (active) {
            setLoadError(errorMessage(error));
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
    }, [edit, attempt]),
  );

  const availableEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.branchId === form.branchId,
      ),
    [employees, form.branchId],
  );

  const selectedEmployee = employees.find(
    (employee) => employee.id === form.employeeId,
  );

  const selectedBranch = branches.find(
    (branch) => branch.id === form.branchId,
  );

  function update<K extends keyof Form>(
    key: K,
    value: Form[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'branchId'
        ? { employeeId: '' }
        : {}),
    }));

    setSaveError('');
    setSuccess('');
  }

  function goBack() {
    if (savingRef.current) return;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin/dashboard');
    }
  }

  async function saveTask() {
    if (savingRef.current || loading) return;

    Keyboard.dismiss();
    setSaveError('');
    setSuccess('');

    if (!companyId) {
      setSaveError('Company could not be identified.');
      return;
    }

    if (!form.title.trim()) {
      setSaveError('Enter the task title.');
      return;
    }

    if (form.title.trim().length > 150) {
      setSaveError('Task title cannot exceed 150 characters.');
      return;
    }

    if (!form.branchId) {
      setSaveError('Select a branch.');
      return;
    }

    if (
      !availableEmployees.some(
        (employee) => employee.id === form.employeeId,
      )
    ) {
      setSaveError('Select an active employee in this branch.');
      return;
    }

    if (form.description.length > 5000) {
      setSaveError(
        'Task description cannot exceed 5000 characters.',
      );
      return;
    }

    const dueDate = form.dueDate.trim()
      ? dateToApi(form.dueDate)
      : null;

    if (form.dueDate.trim() && !dueDate) {
      setSaveError(
        'Enter a valid due date in DD/MM/YYYY format.',
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const currentEmployees = await getEmployees();

      const currentAssignee = currentEmployees.find(
        (employee) =>
          employee.id === form.employeeId &&
          employee.branchId === form.branchId &&
          employee.status !== 'inactive' &&
          employee.loginEnabled !== false,
      );

      if (!currentAssignee) {
        throw new Error(
          'The selected employee is no longer active in this branch.',
        );
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        assignedToId: form.employeeId,
        priority: form.priority,
        ...(dueDate ? { dueDate } : {}),
      };

      let saved: SavedTask;

      if (edit) {
        // Existing backend does not allow changing
        // company/branch through PATCH.
        saved = await taskRequest<SavedTask>(
          'PATCH',
          `/tasks/${encodeURIComponent(edit)}`,
          payload,
        );
      } else {
        saved = await taskRequest<SavedTask>(
          'POST',
          '/tasks',
          {
            ...payload,
            companyId,
            branchId: form.branchId,
          },
        );
      }

      setSuccess(
        edit
          ? `Task updated successfully for ${currentAssignee.fullName}!`
          : `Task assigned successfully to ${currentAssignee.fullName}!`,
      );

      if (!edit) {
        setForm((current) => ({
          ...initialForm,
          branchId: current.branchId,
        }));
      }
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const options = picker === 'branch'
    ? branches.map((branch) => ({
      value: branch.id,
      label: branch.name,
    }))
    : picker === 'employee'
      ? availableEmployees.map((employee) => ({
        value: employee.id,
        label: employee.fullName,
      }))
      : priorities.map((priority) => ({
        value: priority.value,
        label: priority.label,
      }));

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <KeyboardAvoidingView enabled={Platform.OS === 'ios'}
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.page}>


          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <AdminPageHeading title={edit ? "Edit / Reassign Task" : "Assign a Task"} onBack={goBack} />

            {loading && (
              <View style={styles.notice}>
                <ActivityIndicator />
                <Text style={styles.hint}>
                  Loading company, branches and employees...
                </Text>
              </View>
            )}

            {!!loadError && (
              <View style={styles.notice}>
                <Text style={styles.error}>{loadError}</Text>
                <Pressable
                  onPress={() => setAttempt((n) => n + 1)}
                  style={styles.retry}
                >
                  <Text style={styles.link}>Retry</Text>
                </Pressable>
              </View>
            )}

            {!loading && loadError === '' && (
              <View style={styles.card}>


                <TextInput validation={{ required: true }} label={"Task Title *"}
                  style={styles.input}
                  value={form.title}
                  onChangeText={(value) => update('title', value)}
                  editable={!saving}
                  maxLength={150}
                />

                <Text style={styles.label}>Branch *</Text>

                <Pressable
                  style={styles.select}
                  disabled={saving || !!edit}
                  onPress={() => setPicker('branch')}
                >
                  <Text style={styles.selectText}>
                    {selectedBranch?.name ?? 'Select branch'}
                  </Text>
                  <AppIcon name="chevron-down" size={16} color="#607591" />
                </Pressable>

                {!!edit && (
                  <Text style={styles.hint}>
                    Branch cannot be changed when editing an existing task.
                  </Text>
                )}

                <Text style={styles.label}>Assigned To *</Text>

                <Pressable
                  style={styles.select}
                  disabled={saving || !form.branchId}
                  onPress={() => setPicker('employee')}
                >
                  <Text style={styles.selectText}>
                    {selectedEmployee?.fullName ?? 'Select employee'}
                  </Text>
                  <AppIcon name="chevron-down" size={16} color="#607591" />
                </Pressable>

                {!!form.branchId && availableEmployees.length === 0 && (
                  <Text style={styles.hint}>
                    No active employees are available in this branch.
                  </Text>
                )}

                <Text style={styles.label}>Priority</Text>

                <Pressable
                  style={styles.select}
                  disabled={saving}
                  onPress={() => setPicker('priority')}
                >
                  <Text style={styles.selectText}>
                    {priorities.find(
                      (item) => item.value === form.priority,
                    )?.label}
                  </Text>
                  <AppIcon name="chevron-down" size={16} color="#607591" />
                </Pressable>

                <Text style={styles.label}>
                  Due Date (DD/MM/YYYY)
                </Text>

                <DatePickerField
                  hideLabel
                  label="Due date"
                  value={dateToApi(form.dueDate) ?? ''}
                  onChange={(value) => update('dueDate', value ? dateToDisplay(value) : '')}
                  clearable
                  disabled={saving}
                  style={styles.input}
                />



                <TextInput label={"Instructions / Expected Outcome"}
                  style={[styles.input, styles.multiline]}
                  value={form.description}
                  onChangeText={(value) =>
                    update('description', value)
                  }
                  multiline
                  textAlignVertical="top"
                  editable={!saving}
                  maxLength={5000}
                />
              </View>
            )}

            {!!saveError && (
              <Text style={styles.errorNotice}>
                {saveError}
              </Text>
            )}

            {!!success && (
              <Text style={styles.successNotice}>
                {success}
              </Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={goBack}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.saveButton,
                (saving || loading || !!loadError) &&
                styles.disabled,
              ]}
              onPress={() => void saveTask()}
              disabled={saving || loading || !!loadError}
            >
              <Text style={styles.saveText}>
                {saving
                  ? 'Saving...'
                  : edit
                    ? 'Save Changes'
                    : 'Assign Task'}
              </Text>
            </Pressable>
          </View>

          <AdminBottomNavigation disabled={saving} />
        </View>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={picker !== null}
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {picker === 'branch'
                  ? 'Select Branch'
                  : picker === 'employee'
                    ? 'Select Employee'
                    : 'Select Priority'}
              </Text>

              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setPicker(null)}>
                <AppIcon symbol="×" style={styles.close} />
              </Pressable>
            </View>

            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={styles.option}
                  onPress={() => {
                    if (picker === 'branch') {
                      update('branchId', option.value);
                    } else if (picker === 'employee') {
                      update('employeeId', option.value);
                    } else if (picker === 'priority') {
                      update(
                        'priority',
                        option.value as Priority,
                      );
                    }

                    setPicker(null);
                  }}
                >
                  <Text style={styles.optionText}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}

              {options.length === 0 && (
                <Text style={styles.hint}>
                  No available options.
                </Text>
              )}
            </ScrollView>
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
  flex: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: {
    padding: 18,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4eaf5',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#20334f',
  },
  headerSubtitle: {
    marginTop: 5,
    fontSize: 11,
    color: '#8794aa',
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  back: {
    minHeight: 42,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 13,
    color: '#657995',
  },
  title: {
    marginTop: 4,
    fontSize: 25,
    fontWeight: '800',
    color: '#20334f',
  },
  subtitle: {
    marginTop: 7,
    fontSize: 12,
    color: '#7a8ba5',
    lineHeight: 19,
  },
  card: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    backgroundColor: '#ffffff',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#405573',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#dce5f3',
    borderRadius: 12,
    backgroundColor: '#fcfdff',
    color: '#20334f',
    fontSize: 14,
  },
  multiline: {
    minHeight: 110,
  },
  select: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#dce5f3',
    borderRadius: 12,
    backgroundColor: '#fcfdff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 14,
    color: '#20334f',
    flexShrink: 1,
  },
  chevron: {
    fontSize: 20,
    color: '#8798b1',
  },
  hint: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8192ad',
    marginTop: 7,
  },
  notice: {
    marginTop: 18,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    gap: 10,
  },
  retry: {
    minHeight: 40,
    justifyContent: 'center',
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: '#345cf2',
  },
  error: {
    fontSize: 12,
    color: '#b94d61',
  },
  errorNotice: {
    margin: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff0f1',
    color: '#b94d61',
    fontSize: 12,
  },
  successNotice: {
    margin: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#e6f4ee',
    color: '#34856c',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e4eaf5',
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#f1f4fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#405573',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#345cf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  overlay: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: 'rgba(27,43,68,0.35)',
  },
  modal: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    alignSelf: 'center',
    borderRadius: 18,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#20334f',
  },
  close: {
    fontSize: 25,
    color: '#71829c',
  },
  option: {
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f8',
  },
  optionText: {
    fontSize: 14,
    color: '#20334f',
  },
});
