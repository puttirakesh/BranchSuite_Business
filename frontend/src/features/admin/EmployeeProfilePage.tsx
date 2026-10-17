import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { employeesApi, type EmployeeProfileDto } from '../../core/admin/api';
import { getAdminScope, useAdminScope } from '../../core/admin/scope';
import { getAvailableBranches } from '../../core/admin/available-branches';
import { AdminBottomNavigation } from '../../ui/AdminBottomNavigation';
import { useAdminLayout } from '../../ui/useAdminLayout';

const emptyForm = { department: '', designation: '', workEmail: '', joiningDate: '', notes: '', branchId: '' };
export function EmployeeProfilePage({ edit = false }: { edit?: boolean }) {
  const { styles } = useAdminLayout(baseStyles, edit ? 'form' : 'detail');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scope = useAdminScope();
  const [employee, setEmployee] = useState<EmployeeProfileDto | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true; setLoading(true); setError(''); setEmployee(null);
    (async () => {
      const current = await getAdminScope();
      const [team, choices] = await Promise.all([employeesApi.list(current.companyId), getAvailableBranches()]);
      const found = team.find(row => row.id === id || row.userId === id);
      if (!found) throw new Error('Employee not found in this workspace.');
      if (!active) return;
      setEmployee(found); setBranches(choices);
      setForm({ department: found.department ?? '', designation: found.designation ?? '', workEmail: found.workEmail ?? '', joiningDate: found.joiningDate.slice(0, 10), notes: found.notes ?? '', branchId: found.branchId });
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load employee.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt, scope?.companyId]));
  const save = async () => {
    if (!employee || busy.current) return;
    const date = new Date(`${form.joiningDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== form.joiningDate || !branches.some(branch => branch.id === form.branchId) || (form.workEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail.trim()))) { setError('Select an available branch and enter a valid email and joining date (YYYY-MM-DD).'); return; }
    if (employee.workEmail && !form.workEmail.trim()) { setError('Enter a replacement work email.'); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      await employeesApi.update(employee.id, { ...form, ...(form.workEmail.trim() ? { workEmail: form.workEmail.trim() } : { workEmail: undefined }) });
      router.replace({ pathname: '/admin/employees/[id]', params: { id: employee.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save employee.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable disabled={saving} onPress={() => router.push('/admin/employees')} style={styles.secondary}><Text style={styles.link}>Back to employees</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>{edit ? 'Edit employee' : 'Employee profile'}</Text>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading employee" /> : employee ? <View style={styles.card}>
        <Text style={styles.cardTitle}>{employee.user.name}</Text><Text style={styles.subtitle}>{employee.employeeCode} · {employee.status}</Text>
        {edit ? <>
          {(['department', 'designation', 'workEmail', 'joiningDate', 'notes'] as const).map(field => <View key={field} style={[styles.field, styles.fullField]}>
            <Text style={styles.label}>{field === 'joiningDate' ? 'Joining date (YYYY-MM-DD)' : field === 'workEmail' ? 'Work email' : field.charAt(0).toUpperCase() + field.slice(1)}</Text>
            <TextInput accessibilityLabel={field} editable={!saving} style={styles.input} value={form[field]} maxLength={field === 'notes' ? 1000 : field === 'joiningDate' ? 10 : field === 'workEmail' ? 254 : 100} multiline={field === 'notes'} autoCapitalize={field === 'workEmail' ? 'none' : 'sentences'} onChangeText={value => setForm(current => ({ ...current, [field]: value }))} />
          </View>)}
          <Text style={styles.label}>Branch</Text><View style={styles.actions}>{branches.map(branch => <Pressable disabled={saving} key={branch.id} onPress={() => setForm(current => ({ ...current, branchId: branch.id }))} style={[styles.secondary, form.branchId === branch.id && styles.selected]}><Text>{branch.name}</Text></Pressable>)}</View>
          <Pressable disabled={saving} onPress={() => void save()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save employee'}</Text></Pressable>
        </> : <>
          {[['Email', employee.workEmail ?? employee.user.email], ['Phone', employee.user.phone], ['Department', employee.department], ['Job title', employee.designation], ['Branch', employee.branch.name], ['Joining date', employee.joiningDate.slice(0, 10)], ['Notes', employee.notes]].map(([label, value]) => <View key={label} style={styles.field}><Text style={styles.label}>{label}</Text><Text selectable style={styles.detailValue}>{value || 'Not set'}</Text></View>)}
          {scope?.role !== 'PAYROLL_MANAGER' && <Pressable onPress={() => router.push({ pathname: '/admin/employees/[id]/edit', params: { id: employee.id } })} style={styles.primary}><Text style={styles.primaryText}>Edit employee</Text></Pressable>}
        </>}
      </View> : <Pressable onPress={() => setAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable>}
    </ScrollView><AdminBottomNavigation disabled={saving} />
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 16 }, title: { fontSize: 25, fontWeight: '700', color: '#20334f' },
  card: { padding: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16, gap: 14 }, cardTitle: { fontSize: 20, fontWeight: '700', color: '#20334f' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#607591' }, field: { gap: 6 }, label: { fontSize: 13, fontWeight: '600', color: '#607591' }, detailValue: { fontSize: 15, lineHeight: 23, color: '#20334f' },
  input: { minHeight: 48, minWidth: 0, padding: 12, borderWidth: 1, borderColor: '#ccd6e5', borderRadius: 9, fontSize: 15 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: { minHeight: 44, padding: 10, justifyContent: 'center', borderRadius: 8 }, selected: { backgroundColor: '#e8eeff' }, link: { color: '#345cf2', fontWeight: '600' }, error: { color: '#b3261e', fontSize: 14, lineHeight: 22 },
  primary: { minHeight: 48, padding: 12, backgroundColor: '#345cf2', borderRadius: 9, justifyContent: 'center', alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
