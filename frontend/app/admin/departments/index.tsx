import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { departmentsApi, type DepartmentDto, type DepartmentEmployeeDto } from '../../../src/core/admin/api';
import { useAdminScope } from '../../../src/core/admin/scope';
import { useAvailableBranches } from '../../../src/core/admin/available-branches';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { BranchOptionsStatus } from '../../../src/ui/BranchOptionsStatus';
import { FloatingTextInput } from '../../../src/ui/FloatingTextInput';
import { SelectField } from '../../../src/ui/SelectField';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

export default function DepartmentsPage() {
  const { styles } = useAdminLayout(baseStyles, 'page');
  const scope = useAdminScope();
  const router = useRouter();
  const { branches, loading: branchesLoading, error: branchError, refresh: refreshBranches } = useAvailableBranches();
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentDto | null>(null);
  const [employees, setEmployees] = useState<DepartmentEmployeeDto[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState('');
  const [employeeAttempt, setEmployeeAttempt] = useState(0);
  const filterLabel = branches.find(branch => branch.id === filterBranchId)?.name ?? 'All branches';
  const availableDepartments = useMemo(() => {
    const groups = new Map<string, DepartmentDto>();
    for (const department of departments) {
      const key = department.name.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!groups.has(key) || !department.branchId) groups.set(key, { ...department, employeeCount: department.totalEmployeeCount });
    }
    return [...groups.values()];
  }, [departments]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const selectedCompany = useRef(scope?.companyId);
  selectedCompany.current = scope?.companyId;
  useEffect(() => { setName(''); setBranchId(''); setFilterBranchId(''); setSelectedDepartment(null); setNotice(''); setSaveError(''); }, [scope?.companyId]);
  useEffect(() => { if (!branchesLoading && branchId && !branches.some(branch => branch.id === branchId)) setBranchId(''); }, [branches, branchesLoading, branchId]);
  useEffect(() => { if (!branchesLoading && filterBranchId && !branches.some(branch => branch.id === filterBranchId)) setFilterBranchId(''); }, [branches, branchesLoading, filterBranchId]);
  useEffect(() => {
    if (!selectedDepartment || selectedDepartment.companyId !== scope?.companyId) return;
    let active = true;
    setEmployees([]); setEmployeesError(''); setEmployeesLoading(true);
    departmentsApi.employees(selectedDepartment.id, filterBranchId || undefined)
      .then(items => { if (active) setEmployees(items); })
      .catch(cause => { if (active) setEmployeesError(cause instanceof Error ? cause.message : 'Could not load department employees.'); })
      .finally(() => { if (active) setEmployeesLoading(false); });
    return () => { active = false; };
  }, [selectedDepartment, scope?.companyId, filterBranchId, employeeAttempt]);
  useFocusEffect(useCallback(() => {
    if (!scope?.companyId) return;
    let active = true;
    setLoading(true); setError(''); setDepartments([]);
    departmentsApi.list(scope.companyId, filterBranchId || undefined).then(items => { if (active) setDepartments(items); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load departments.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope?.companyId, attempt, filterBranchId]));
  const save = async () => {
    if (savingRef.current || !scope?.companyId || loading || branchesLoading || error || branchError) return;
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > 100) { setSaveError('Enter a department name of 1 to 100 characters.'); return; }
    if (branchId && !branches.some(branch => branch.id === branchId)) { setSaveError('Choose an available branch.'); return; }
    if (departments.some(item => item.branchId === (branchId || null) && item.name.toLowerCase() === clean.toLowerCase())) {
      setSaveError('This department already exists for the selected scope.'); return;
    }
    const companyId = scope.companyId;
    savingRef.current = true; setSaving(true); setSaveError(''); setNotice('');
    try {
      const saved = await departmentsApi.create({ companyId, ...(branchId ? { branchId } : {}), name: clean });
      if (selectedCompany.current !== companyId) return;
      setAttempt(value => value + 1);
      setName(''); setNotice(`${saved.name} created. It is now available when adding employees.`);
    } catch (cause) {
      if (selectedCompany.current === companyId) setSaveError(cause instanceof Error ? cause.message : 'Could not create department.');
    } finally { savingRef.current = false; setSaving(false); }
  };
  const blocked = loading || saving || branchesLoading || !!error || !!branchError || !scope?.companyId;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AdminPageHeading title="Departments" onBack={() => router.canGoBack() ? router.back() : router.replace('/admin/more')} />
      <Text style={styles.subtitle}>Create departments for {scope?.companyName ?? 'your company'} before assigning employees.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create department</Text>
        <FloatingTextInput label="Department name *" accessibilityLabel="Department name" value={name} onChangeText={value => { setName(value); setSaveError(''); setNotice(''); }} editable={!blocked} maxLength={100} validation={{ required: true, maxLength: 100 }} />
        <SelectField label="Available in" value={branchId} options={[{ value: '', label: 'Entire company' }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} disabled={blocked} onChange={value => { setBranchId(value); setSaveError(''); setNotice(''); }} />
        <Text style={styles.subtitle}>{branchId ? 'Available to employees in this branch.' : 'Available to employees in every branch of this company.'}</Text>
        <BranchOptionsStatus loading={branchesLoading} error={branchError} empty={!branches.length} onRetry={refreshBranches} />
        {!!saveError && <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>}
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Create department" accessibilityState={{ disabled: blocked, busy: saving }} disabled={blocked} onPress={() => void save()} style={[styles.submit, blocked && styles.dim]}><Text style={styles.submitText}>{saving ? 'Creating…' : 'Create department'}</Text></Pressable>
      </View>
      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>Available departments</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh departments" disabled={saving || loading} onPress={() => setAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Refresh</Text></Pressable></View>
        <SelectField label="Filter branch" value={filterBranchId} options={[{ value: '', label: 'All branches' }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} disabled={saving || branchesLoading || !!branchError} onChange={value => { setSelectedDepartment(null); setFilterBranchId(value); }} />
        <Text style={styles.subtitle}>{filterBranchId ? `Employees in ${filterLabel}.` : 'Employee totals across all available branches.'} Select a department to view its employees.</Text>
        {loading ? <ActivityIndicator accessibilityLabel="Loading departments" /> : error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : availableDepartments.length ? availableDepartments.map(department => <Pressable key={department.id} testID={`department-${department.id}`} accessibilityRole="button" accessibilityLabel={`View employees in ${department.name}, ${filterLabel}: ${department.employeeCount} employees`} onPress={() => setSelectedDepartment(department)} style={({ pressed }) => [styles.department, pressed && styles.pressed]}>
          <View style={styles.row}><View style={styles.flex}><Text style={styles.name}>{department.name}</Text><Text style={styles.subtitle}>{filterLabel}</Text></View><View style={styles.countBadge}><Text style={styles.count}>{department.employeeCount} {department.employeeCount === 1 ? 'employee' : 'employees'}</Text></View></View>
          <Text style={styles.link}>View employees ›</Text>
        </Pressable>) : <Text style={styles.subtitle}>{filterBranchId ? 'No departments are available in this branch.' : 'No departments yet. Create the first department above.'}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Add an employee" onPress={() => router.push('/admin/employees/create')} style={styles.secondary}><Text style={styles.link}>Add an employee</Text></Pressable>
      </View>
    </ScrollView><AdminBottomNavigation disabled={saving} />
  </View>
    <Modal transparent visible={!!selectedDepartment && selectedDepartment.companyId === scope?.companyId} animationType="fade" onRequestClose={() => setSelectedDepartment(null)}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}>
        <View style={styles.row}><Text accessibilityRole="header" style={styles.cardTitle}>{selectedDepartment?.name} employees</Text><Pressable accessibilityRole="button" accessibilityLabel="Close department employees" onPress={() => setSelectedDepartment(null)} style={styles.secondary}><Text style={styles.link}>Close</Text></Pressable></View>
        <Text style={styles.subtitle}>{filterLabel}{!employeesLoading && !employeesError ? ` · ${employees.length} ${employees.length === 1 ? 'employee' : 'employees'}` : ''}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.employeeList}>
          {employeesLoading ? <ActivityIndicator accessibilityLabel="Loading department employees" /> : employeesError ? <View><Text accessibilityRole="alert" style={styles.error}>{employeesError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry department employees" onPress={() => setEmployeeAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable></View> : employees.length ? employees.map(employee => <View key={employee.id} style={styles.employee}>
            <Text style={styles.name}>{employee.name}</Text><Text style={styles.subtitle}>{[employee.employeeCode, employee.designation].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.subtitle}>{employee.branches.map(branch => branch.name).join(', ')}</Text><Text style={styles.subtitle}>{employee.email} · {employee.status.charAt(0) + employee.status.slice(1).toLowerCase()}</Text>
          </View>) : <Text style={styles.subtitle}>No employees are assigned to this department{filterBranchId ? ' in this branch' : ''}.</Text>}
        </ScrollView>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', alignSelf: 'center' },
  content: { padding: 16, gap: 16, paddingBottom: 32 }, card: { padding: 16, gap: 12, borderWidth: 1, borderColor: '#e0e8f5', borderRadius: 16, backgroundColor: '#fff' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#20334f', flexShrink: 1 }, subtitle: { fontSize: 12, lineHeight: 19, color: '#607591' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  department: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e4eaf5', gap: 4 }, name: { fontSize: 14, fontWeight: '600', color: '#20334f' },
  flex: { flex: 1, minWidth: 0 }, countBadge: { padding: 8, borderRadius: 8, backgroundColor: '#eaf0ff', flexShrink: 1 }, count: { color: '#345cf2', fontSize: 12, fontWeight: '600' }, pressed: { backgroundColor: '#f3f6fc' },
  overlay: { flex: 1, padding: 20, backgroundColor: 'rgba(21,43,60,0.3)', justifyContent: 'center' }, modal: { width: '100%', maxWidth: 680, maxHeight: '85%', alignSelf: 'center', padding: 20, gap: 12, borderRadius: 16, backgroundColor: '#fff' },
  employeeList: { gap: 10 }, employee: { padding: 12, gap: 4, backgroundColor: '#f7f9fc', borderWidth: 1, borderColor: '#e0e8f5', borderRadius: 10 },
  submit: { minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#345cf2', borderRadius: 10 }, submitText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  secondary: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: '#345cf2', fontSize: 13, fontWeight: '600' },
  error: { color: '#b94d61', fontSize: 13 }, notice: { color: '#138f80', fontSize: 13 }, dim: { opacity: 0.5 },
});
