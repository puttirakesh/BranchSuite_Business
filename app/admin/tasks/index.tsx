import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEmployees, type Employee } from '../../../src/core/employees';

type Form = {
  title: string; type: string; branch: string; employeeId: string;
  dueDate: string; dueTime: string; priority: string; relatedLead: string; instructions: string;
};
type Picker = 'type' | 'branch' | 'employeeId' | 'priority';
export type Task = Form & {
  id: string; createdAt: string;
  status: 'pending' | 'open' | 'in_progress' | 'completed' | 'cancelled';
  assignedBy?: string;
  history?: { id: string; createdAt: string; status: Task['status']; note: string; kind: 'progress' | 'edit' }[];
};
const initialForm: Form = {
  title: '', type: 'Task', branch: '', employeeId: '', dueDate: '', dueTime: '',
  priority: 'Normal', relatedLead: '', instructions: '',
};
const storageKey = 'branchsuite:tasks:v1';

function normalizeDate(value: string): string | null {
  const match = /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[3]), year = Number(match[4]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${match[1]}/${match[3]}/${match[4]}`;
}
function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]), period = match[3]?.toUpperCase();
  if (minute > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (period) hour = hour % 12 + (period === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

export default function AssignTaskPage() {
  const { styles } = useAdminLayout(baseStyles, 'form');
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [form, setForm] = useState<Form>(initialForm);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [picker, setPicker] = useState<Picker | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const cardPosition = useRef(0);
  const fieldPositions = useRef<Partial<Record<keyof Form, number>>>({});

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    Promise.all([getEmployees(), edit ? AsyncStorage.getItem(storageKey) : Promise.resolve(null)]).then(([records, stored]) => {
      if (!active) return;
      setEmployees(records.filter(employee => employee.status !== 'inactive'));
      if (edit) {
        const tasks: unknown = stored === null ? [] : JSON.parse(stored);
        if (!Array.isArray(tasks)) throw new Error('Saved tasks could not be read.');
        const task = tasks.find(item => item.id === edit) as Task | undefined;
        if (!task) throw new Error('Task could not be found.');
        setForm({ title: task.title, type: task.type, branch: task.branch, employeeId: task.employeeId, dueDate: task.dueDate, dueTime: task.dueTime, priority: task.priority, relatedLead: task.relatedLead, instructions: task.instructions });
      }
    })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load the form. Please retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, edit]));

  const availableEmployees = employees.filter(employee => !form.branch || employee.branch === form.branch);
  const selectedEmployee = employees.find(employee => employee.id === form.employeeId);
  const branches = [...new Set(employees.map(employee => employee.branch).filter(Boolean))].sort();
  const update = (key: keyof Form, value: string) => {
    setForm(current => ({ ...current, [key]: value, ...(key === 'branch' ? { employeeId: '' } : {}) }));
    setErrors(current => ({ ...current, [key]: undefined, ...(key === 'branch' ? { employeeId: undefined } : {}) }));
    setSaveError('');
  };
  const back = () => {
    if (savingRef.current) return;
    if (router.canGoBack()) router.back(); else router.replace('/admin/dashboard');
  };
  const assignTask = async () => {
    if (savingRef.current || loading) return;
    Keyboard.dismiss();
    if (loadError) { setSaveError('Employee data could not be loaded. Tap Retry above, then try again.'); return; }
    if (employees.length === 0) { setSaveError('No active employees are available. Add an employee or mark an existing employee active first.'); return; }
    const nextErrors: Partial<Record<keyof Form, string>> = {};
    const dueDate = normalizeDate(form.dueDate), dueTime = normalizeTime(form.dueTime);
    if (!form.title.trim()) nextErrors.title = 'Enter a task title.';
    if (!availableEmployees.some(employee => employee.id === form.employeeId)) nextErrors.employeeId = 'Select an employee.';
    if (!dueDate) nextErrors.dueDate = 'Enter a valid date as DD/MM/YYYY or DD-MM-YYYY.';
    if (!dueTime) nextErrors.dueTime = 'Enter a valid time, such as HH:MM or HH:MM AM/PM.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !dueDate || !dueTime) {
      setSaveError('Please complete the highlighted fields before assigning the task.');
      const firstField = Object.keys(nextErrors)[0] as keyof Form;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, cardPosition.current + (fieldPositions.current[firstField] || 0) - 12), animated: true }));
      return;
    }
    savingRef.current = true; setSaving(true); setSaveError('');
    try {
      // Recheck availability before saving, since an employee may have been deactivated.
      const currentEmployees = await getEmployees();
      const employee = currentEmployees.find(item => item.id === form.employeeId && item.status !== 'inactive');
      if (!employee || (form.branch && employee.branch !== form.branch)) throw new Error('This employee is no longer available. Choose another employee.');
      const stored = await AsyncStorage.getItem(storageKey);
      const tasks: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(tasks) || !tasks.every(task => task && typeof task.id === 'string' && typeof task.title === 'string' && typeof task.employeeId === 'string')) throw new Error('Saved tasks could not be read.');
      const existing = edit ? tasks.find(item => item.id === edit) as Task | undefined : undefined;
      if (edit && !existing) throw new Error('Task could not be found.');
      const task: Task = {
        ...existing,
        ...form, title: form.title.trim(), branch: employee.branch,
        instructions: form.instructions.trim(), relatedLead: form.relatedLead.trim(), dueDate, dueTime,
        id: existing?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        createdAt: existing?.createdAt || new Date().toISOString(), status: existing?.status || 'open',
        history: existing ? [...(existing.history || []), { id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), status: existing.status, note: 'Task details updated.', kind: 'edit' }] : [],
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(existing ? tasks.map(item => item.id === task.id ? task : item) : [task, ...tasks]));
      router.replace({ pathname: '/admin/tasks/[id]', params: { id: task.id } });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not assign the task. Please try again.');
    } finally { savingRef.current = false; setSaving(false); }
  };
  const options = picker === 'type' ? ['Task', 'Follow-up', 'Call', 'Meeting'].map(value => ({ value, label: value }))
    : picker === 'priority' ? ['Low', 'Normal', 'High', 'Urgent'].map(value => ({ value, label: value }))
    : picker === 'branch' ? [{ value: '', label: 'All branches' }, ...branches.map(value => ({ value, label: value }))]
    : availableEmployees.map(employee => ({ value: employee.id, label: employee.fullName }));
  const pickerTitles = { type: 'Type', branch: 'Branch', employeeId: 'Assign to employee', priority: 'Priority' };

  const field = (key: keyof Form, label: string, hint?: string, multiline = false) => (
    <View style={[styles.field, multiline && styles.fullField]} onLayout={event => { fieldPositions.current[key] = event.nativeEvent.layout.y; }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} editable={!saving} value={form[key]} onChangeText={value => update(key, value)} style={[styles.input, multiline && styles.multiline, errors[key] && styles.invalid]} multiline={multiline} autoCorrect={false} autoCapitalize={key === 'dueTime' ? 'characters' : 'sentences'} />
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {errors[key] && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors[key]}</Text>}
    </View>
  );
  const select = (key: Picker, label: string, value: string) => (
    <View style={styles.field} onLayout={event => { fieldPositions.current[key] = event.nativeEvent.layout.y; }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={saving || (key === 'employeeId' && (loading || !!loadError))} onPress={() => setPicker(key)} style={[styles.input, styles.select, errors[key] && styles.invalid]}><Text style={[styles.inputText, !value && styles.placeholder]}>{value || (key === 'employeeId' ? 'Select employee' : 'Select branch')}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
      {errors[key] && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors[key]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={[styles.between, styles.headerIdentity]}><View style={styles.flex}><Text style={styles.companyName}>{/* Company name */}</Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.headerIcon}><Text style={styles.searchGlyph}>⌕</Text></View><View style={styles.avatar}>{/* Profile initial */}</View></View>
            <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerFilterLabel}>Company</Text><Text style={styles.chevron}>⌄</Text></View><View style={[styles.headerFilter, styles.branchFilter]}><Text style={styles.headerFilterLabel}>Branch</Text><Text numberOfLines={1} style={styles.headerBranch}>{form.branch}</Text><Text style={styles.chevron}>⌄</Text></View></View>
          </View>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={back} style={styles.back}><Text style={styles.backText}>‹  Back</Text></Pressable>
            <Text style={styles.title}>{edit ? 'Edit / reassign task' : 'Assign a task'}</Text>
            <Text style={styles.subtitle}>{edit ? 'Update the task details or choose another employee.' : 'Assign work to an employee.'}</Text>
            {loadError !== '' && <View style={styles.notice}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View>}
            {!loading && !loadError && employees.length === 0 && <View style={styles.notice}><Text style={styles.hint}>Add an active employee before assigning a task.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/admin/employees/create')} style={styles.retry}><Text style={styles.link}>Add employee</Text></Pressable></View>}
            <View style={[styles.card, styles.formCard]} onLayout={event => { cardPosition.current = event.nativeEvent.layout.y; }}>
              {field('title', 'Task title *')}
              {select('type', 'Type', form.type)}
              {select('branch', 'Branch', form.branch || 'All branches')}
              {select('employeeId', 'Assign to employee *', selectedEmployee?.fullName || '')}
              {field('dueDate', 'Due date *', 'DD/MM/YYYY or DD-MM-YYYY')}
              {field('dueTime', 'Due time *', 'HH:MM or HH:MM AM/PM')}
              {select('priority', 'Priority', form.priority)}
              {field('relatedLead', 'Related lead (optional)')}
              {field('instructions', 'Instructions / expected outcome', undefined, true)}
            </View>
          </ScrollView>
          {saveError !== '' && <Text accessibilityLiveRegion="polite" style={styles.saveError}>{saveError}</Text>}
          <View style={styles.actions}><Pressable accessibilityRole="button" disabled={saving} onPress={back} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ busy: saving || loading, disabled: saving || loading }} disabled={saving || loading} onPress={assignTask} style={({ pressed }) => [styles.assign, (pressed || saving || loading) && styles.dim]}><Text style={styles.assignText}>{loading ? 'Loading…' : saving ? 'Saving…' : edit ? 'Save changes' : 'Assign task'}</Text></Pressable></View>
          <View style={styles.navigation}>{([{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }] as const).map(tab => <Pressable key={tab.label} accessibilityRole="tab" disabled={saving} onPress={tab.label === 'Home' ? () => router.replace('/admin/dashboard') : tab.label === 'People' ? () => router.push('/admin/employees/people') : tab.label === 'Payroll' ? () => router.push('/admin/payroll') : undefined} style={styles.navItem}><Text style={styles.navGlyph}>{tab.icon}</Text><Text style={styles.navLabel}>{tab.label}</Text></Pressable>)}</View>
        </View>
      </KeyboardAvoidingView>
      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.between}><Text style={styles.modalTitle}>{picker && pickerTitles[picker]}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close picker" onPress={() => setPicker(null)} style={styles.close}><Text style={styles.chevron}>×</Text></Pressable></View>
          <ScrollView>{options.map(option => <Pressable accessibilityRole="button" key={option.value} onPress={() => { if (picker) update(picker, option.value); setPicker(null); }} style={styles.option}><Text style={styles.inputText}>{option.label}</Text><Text style={styles.link}>{picker && form[picker] === option.value ? '✓' : ''}</Text></Pressable>)}{options.length === 0 && <Text style={styles.hint}>No employees available for this branch.</Text>}</ScrollView>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, flex: { flex: 1 },
  page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e4eaf5' },
  companyName: { minHeight: 18, fontSize: 14, fontWeight: '800', color: '#20334f' },
  headerCaption: { fontSize: 9, color: '#8794aa', marginTop: 4 },
  headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' },
  searchGlyph: { fontSize: 26, color: '#304560' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' },
  headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 },
  headerFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff' },
  branchFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, headerFilterLabel: { fontSize: 9, color: '#8492a9' },
  headerBranch: { flex: 1, fontSize: 9, color: '#405573', paddingHorizontal: 6 }, chevron: { fontSize: 20, color: '#8798b1' },
  content: { padding: 16, paddingBottom: 24 }, back: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', marginBottom: 8 },
  backText: { fontSize: 12, color: '#657995' }, title: { fontSize: 25, fontWeight: '800', color: '#20334f', letterSpacing: -0.7 },
  subtitle: { fontSize: 12, color: '#7a8ba5', marginTop: 6, lineHeight: 19 },
  card: { marginTop: 22, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' },
  field: { marginBottom: 20 }, label: { fontSize: 12, fontWeight: '600', color: '#405573', marginBottom: 8 },
  input: { minHeight: 46, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 13, backgroundColor: '#fcfdff', fontSize: 14, color: '#20334f' },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, inputText: { fontSize: 14, color: '#20334f', flexShrink: 1 },
  placeholder: { color: '#8d9bb2' }, multiline: { minHeight: 90, textAlignVertical: 'top' }, invalid: { borderColor: '#cc6574' },
  hint: { fontSize: 10, lineHeight: 16, color: '#8192ad', marginTop: 6 }, error: { fontSize: 11, color: '#b94d61', marginTop: 6 },
  success: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: '#e6f4ee', color: '#34856c', fontSize: 12 },
  notice: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: '#fff' }, retry: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontSize: 12, fontWeight: '600', color: '#345cf2' }, saveError: { padding: 12, fontSize: 12, color: '#b94d61', backgroundColor: '#fff' },
  actions: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5' },
  cancel: { flex: 1, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f4fa' }, cancelText: { fontSize: 12, fontWeight: '700', color: '#405573' },
  assign: { flex: 1.4, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#345cf2' }, assignText: { fontSize: 12, fontWeight: '700', color: '#fff' }, dim: { opacity: 0.6 },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, alignItems: 'center', gap: 4 }, navGlyph: { fontSize: 22, color: '#71829c' }, navLabel: { fontSize: 9, color: '#71829c' },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '80%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#20334f', flex: 1 }, close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
});
