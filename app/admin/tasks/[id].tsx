import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEmployees, type Employee } from '../../../src/core/employees';
import type { Task } from './index';

const storageKey = 'branchsuite:tasks:v1';
const statuses = [{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }] as const;
type Status = typeof statuses[number]['value'];
const normalizedStatus = (status: Task['status']): Status => status === 'pending' ? 'open' : status;
const statusLabel = (status: Task['status']) => statuses.find(option => option.value === normalizedStatus(status))?.label || 'Open';

async function readTasks(): Promise<Task[]> {
  const stored = await AsyncStorage.getItem(storageKey);
  const tasks: unknown = stored === null ? [] : JSON.parse(stored);
  if (!Array.isArray(tasks) || !tasks.every(task => task && typeof task.id === 'string' && typeof task.title === 'string' && typeof task.employeeId === 'string')) throw new Error('Saved tasks could not be read.');
  return tasks as Task[];
}

export default function TaskDetailsPage() {
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [status, setStatus] = useState<Status>('open');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const savingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    Promise.all([readTasks(), getEmployees()]).then(([tasks, records]) => {
      const found = tasks.find(item => item.id === id);
      if (!found) throw new Error('Task could not be found.');
      if (active) { setTask(found); setEmployees(records); setStatus(normalizedStatus(found.status)); }
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load the task.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]));

  const back = () => { if (!savingRef.current) router.replace('/admin/dashboard'); };
  const saveUpdate = async () => {
    if (!task || savingRef.current) return;
    setSaveError(''); setNotice('');
    if (status === normalizedStatus(task.status) && !note.trim()) { setSaveError('Choose a new status or add a progress note.'); return; }
    savingRef.current = true; setSaving(true);
    try {
      const tasks = await readTasks();
      const current = tasks.find(item => item.id === id);
      if (!current) throw new Error('Task could not be found.');
      const updated: Task = { ...current, status, history: [...(current.history || []), {
        id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), status, note: note.trim(), kind: 'progress',
      }] };
      await AsyncStorage.setItem(storageKey, JSON.stringify(tasks.map(item => item.id === id ? updated : item)));
      setTask(updated); setNote(''); setNotice('Progress update saved.');
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save the update. Please retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const assignedEmployee = employees.find(employee => employee.id === task?.employeeId);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={[styles.between, styles.headerIdentity]}><View style={styles.flex}><Text style={styles.companyName}>{/* Company name */}</Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.headerIcon}><Text style={styles.searchGlyph}>⌕</Text></View><View style={styles.avatar}>{/* Profile initial */}</View></View>
            <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerFilterLabel}>Company</Text><Text style={styles.chevron}>⌄</Text></View><View style={[styles.headerFilter, styles.branchFilter]}><Text style={styles.headerFilterLabel}>Branch</Text><Text numberOfLines={1} style={styles.headerBranch}>{task?.branch}</Text><Text style={styles.chevron}>⌄</Text></View></View>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.between}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={back} style={styles.back}><Text style={styles.backText}>‹  Back</Text></Pressable>
              {task && !loadError && <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.push({ pathname: '/admin/tasks', params: { edit: task.id } })} style={styles.edit}><Text style={styles.editText}>Edit / reassign</Text></Pressable>}
            </View>
            {loading ? <ActivityIndicator accessibilityLabel="Loading task" color="#345cf2" style={styles.loading} /> : loadError ? <View style={styles.card}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.back}><Text style={styles.link}>Retry</Text></Pressable></View> : task && <>
              <Text style={styles.title}>{task.title}</Text><Text style={styles.subtitle}>{[task.type, task.branch].filter(Boolean).join(' · ')}</Text>
              <View style={styles.card}>
                <View style={styles.between}><Text style={styles.cardTitle}>Task details</Text><View style={[styles.badge, task.status === 'completed' && styles.completedBadge]}><Text style={styles.badgeText}>{statusLabel(task.status)}</Text></View></View>
                {[{ label: 'Assigned to', value: assignedEmployee?.fullName || 'Employee unavailable' }, { label: 'Due', value: `${task.dueDate} · ${task.dueTime}` }, { label: 'Priority', value: task.priority }, { label: 'Assigned by', value: task.assignedBy || '—' }, ...(task.relatedLead ? [{ label: 'Related lead', value: task.relatedLead }] : [])].map(field => <View key={field.label} style={styles.detail}><Text style={styles.detailLabel}>{field.label}</Text><Text style={styles.detailValue}>{field.value}</Text></View>)}
                <View style={styles.instructions}><Text style={styles.instructionsText}>{task.instructions || 'No extra instructions.'}</Text></View>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Update progress</Text>
                <Text style={styles.label}>Task status</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Task status" disabled={saving} onPress={() => setPicker(true)} style={[styles.input, styles.between]}><Text style={styles.inputText}>{statusLabel(status)}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
                <Text style={styles.label}>Progress / completion note</Text>
                <TextInput accessibilityLabel="Progress / completion note" value={note} onChangeText={value => { setNote(value); setSaveError(''); setNotice(''); }} editable={!saving} multiline style={[styles.input, styles.multiline]} />
                {saveError !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{saveError}</Text>}
                {notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
                <Pressable accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} onPress={saveUpdate} style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.dim]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save update'}</Text></Pressable>
              </View>
              <Text style={styles.historyTitle}>Activity history</Text>
              {task.history?.length ? [...task.history].reverse().map(entry => <View style={styles.historyCard} key={entry.id}><View style={styles.between}><Text style={styles.detailValue}>{entry.kind === 'edit' ? 'Task edited / reassigned' : statusLabel(entry.status)}</Text><Text style={styles.detailLabel}>{new Date(entry.createdAt).toLocaleString()}</Text></View>{entry.note !== '' && <Text style={styles.historyNote}>{entry.note}</Text>}</View>) : <View style={[styles.historyCard, styles.emptyHistory]}><View style={styles.check}><Text style={styles.checkText}>✓</Text></View><Text style={styles.detailValue}>No updates yet</Text><Text style={styles.subtitle}>Progress updates will appear here.</Text></View>}
            </>}
          </ScrollView>
          <View style={styles.navigation}>{([{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }] as const).map(tab => <Pressable key={tab.label} accessibilityRole="tab" disabled={saving} onPress={tab.label === 'Home' ? back : tab.label === 'People' ? () => router.push('/admin/employees/people') : tab.label === 'Payroll' ? () => router.push('/admin/payroll') : undefined} style={styles.navItem}><Text style={styles.navGlyph}>{tab.icon}</Text><Text style={styles.navLabel}>{tab.label}</Text></Pressable>)}</View>
        </View>
      </KeyboardAvoidingView>
      <Modal transparent visible={picker} animationType="fade" onRequestClose={() => setPicker(false)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.between}><Text style={styles.cardTitle}>Task status</Text><Pressable accessibilityRole="button" accessibilityLabel="Close picker" onPress={() => setPicker(false)} style={styles.back}><Text style={styles.chevron}>×</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">{statuses.map(option => <Pressable accessibilityRole="button" key={option.value} onPress={() => { setStatus(option.value); setPicker(false); setSaveError(''); setNotice(''); }} style={styles.option}><Text style={styles.inputText}>{option.label}</Text><Text style={styles.link}>{option.value === status ? '✓' : ''}</Text></Pressable>)}</ScrollView></View></View></Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, flex: { flex: 1 }, page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, companyName: { minHeight: 18, fontSize: 14, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, color: '#8794aa', marginTop: 4 }, headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' }, searchGlyph: { fontSize: 26, color: '#304560' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' },
  headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff' }, branchFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, headerFilterLabel: { fontSize: 9, color: '#8492a9' }, headerBranch: { flex: 1, fontSize: 9, color: '#405573', paddingHorizontal: 6 }, chevron: { fontSize: 20, color: '#8798b1' },
  content: { padding: 16, paddingBottom: 30 }, back: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 4 }, backText: { fontSize: 12, color: '#657995' }, edit: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fff' }, editText: { fontSize: 11, fontWeight: '600', color: '#405573' }, title: { fontSize: 25, fontWeight: '800', color: '#20334f', marginTop: 12 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#7a8ba5', marginTop: 5 }, loading: { marginTop: 30 },
  card: { marginTop: 22, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' }, cardTitle: { fontSize: 17, fontWeight: '800', color: '#20334f' }, badge: { borderRadius: 7, backgroundColor: '#fff1d9', paddingVertical: 5, paddingHorizontal: 9 }, completedBadge: { backgroundColor: '#e6f4ee' }, badgeText: { fontSize: 9, fontWeight: '600', color: '#6d6846' }, detail: { marginTop: 22 }, detailLabel: { fontSize: 10, color: '#8192ad', flexShrink: 1 }, detailValue: { fontSize: 12, fontWeight: '600', color: '#20334f', marginTop: 5 }, instructions: { padding: 14, marginTop: 24, backgroundColor: '#f5f7fc', borderRadius: 12 }, instructionsText: { fontSize: 12, lineHeight: 19, color: '#405573' },
  label: { fontSize: 12, fontWeight: '600', color: '#405573', marginTop: 20, marginBottom: 8 }, input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fcfdff', padding: 13, fontSize: 14, color: '#20334f' }, inputText: { fontSize: 14, color: '#20334f' }, multiline: { minHeight: 90, textAlignVertical: 'top' }, error: { fontSize: 12, color: '#b94d61', marginTop: 10 }, notice: { fontSize: 12, color: '#34856c', marginTop: 10 }, saveButton: { minHeight: 46, marginTop: 22, borderRadius: 13, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center' }, saveText: { fontSize: 12, fontWeight: '700', color: '#fff' }, dim: { opacity: 0.6 },
  historyTitle: { fontSize: 17, fontWeight: '800', color: '#20334f', marginTop: 24, marginBottom: 14 }, historyCard: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', marginBottom: 12 }, historyNote: { fontSize: 12, lineHeight: 19, color: '#405573', marginTop: 12 }, emptyHistory: { alignItems: 'center', paddingVertical: 26 }, check: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#eaf5f0', marginBottom: 10 }, checkText: { fontSize: 20, color: '#34856c' },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, alignItems: 'center', gap: 4 }, navGlyph: { fontSize: 22, color: '#71829c' }, navLabel: { fontSize: 9, color: '#71829c' }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 22 }, option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#edf1f8' }, link: { fontSize: 12, fontWeight: '600', color: '#345cf2' },
});
