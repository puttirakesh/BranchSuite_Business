import { toast } from '../../ui/toast-store';
import { useToastState } from '../../ui/useToastState';
import { FloatingTextInput as TextInput } from "../../ui/FloatingTextInput";
import { AdminPageHeading } from '../../ui/AdminPageHeading';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../core/admin/useWorkspaceFocusEffect';
import { employeesApi, type EmployeeProfileDto } from '../../core/admin/api';
import { employeeDocumentsApi, type EmployeeDocumentDto } from '../../core/admin/workspace-records.api';
import { getAdminScope, useAdminScope } from '../../core/admin/scope';
import { getAvailableBranches } from '../../core/admin/available-branches';
import { AdminBottomNavigation } from '../../ui/AdminBottomNavigation';
import { AppIcon } from '../../ui/AppIcon';
import { DatePickerField } from '../../ui/DatePickerField';
import { useAdminLayout } from '../../ui/useAdminLayout';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

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
  const [error, setError] = useToastState('', 'error');
  const [attempt, setAttempt] = useState(0);
  const [documents, setDocuments] = useState<EmployeeDocumentDto[]>([]);
  const [documentsError, setDocumentsError] = useToastState('', 'error');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [documentKind, setDocumentKind] = useState<EmployeeDocumentDto['kind']>('LETTER');
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentFile, setDocumentFile] = useState<{ name: string; mimeType: string; base64: string } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true; setLoading(true); setError(''); setDocumentsError(''); setEmployee(null); setDocuments([]);
    (async () => {
      const current = await getAdminScope();
      const [team, choices] = await Promise.all([employeesApi.list(current.companyId), getAvailableBranches()]);
      const found = team.find(row => row.id === id || row.userId === id);
      if (!found) throw new Error('Employee not found in this workspace.');
      if (!active) return;
      setEmployee(found); setBranches(choices);
      setForm({ department: found.department ?? '', designation: found.designation ?? '', workEmail: found.workEmail ?? '', joiningDate: found.joiningDate.slice(0, 10), notes: found.notes ?? '', branchId: found.branchId });
      if (['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(current.role)) {
        employeeDocumentsApi.list(current.companyId, found.userId).then(items => { if (active) setDocuments(items); }).catch(cause => { if (active) setDocumentsError(cause instanceof Error ? cause.message : 'Could not load employee documents.'); });
      }
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load employee.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt, scope?.companyId]));
  const save = async () => {
    if (!employee || busy.current) return;
    const date = new Date(`${form.joiningDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== form.joiningDate || !branches.some(branch => branch.id === form.branchId) || (form.workEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail.trim()))) { setError('Select an available branch, enter a valid joining date, and provide a valid email if supplied.'); return; }
    if (employee.workEmail && !form.workEmail.trim()) { setError('Enter a replacement work email.'); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      await employeesApi.update(employee.id, { ...form, department: form.department.trim(), designation: form.designation.trim(), notes: form.notes.trim(), ...(form.workEmail.trim() ? { workEmail: form.workEmail.trim() } : { workEmail: undefined }) });
      toast.success('Employee updated successfully.');
      router.replace({ pathname: '/admin/employees/[id]', params: { id: employee.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save employee.'); }
    finally { busy.current = false; setSaving(false); }
  };
  const issueDocument = async () => {
    if (!employee || !scope?.companyId || !documentTitle.trim() || (!documentContent.trim() && !documentFile) || documentSaving) return;
    setDocumentSaving(true); setDocumentsError('');
    try {
      const saved = await employeeDocumentsApi.issue({ companyId: scope.companyId, branchId: employee.branchId, employeeId: employee.userId, title: documentTitle.trim(), kind: documentKind, ...(documentContent.trim() ? { content: documentContent.trim() } : {}), ...(documentFile ? { fileName: documentFile.name, mimeType: documentFile.mimeType, fileDataBase64: documentFile.base64 } : {}) });
      setDocuments(current => [saved, ...current]); toast.success('Document issued successfully.'); setDocumentTitle(''); setDocumentContent(''); setDocumentFile(null);
    } catch (cause) { setDocumentsError(cause instanceof Error ? cause.message : 'Could not issue document.'); }
    finally { setDocumentSaving(false); }
  };
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AdminPageHeading title={edit ? 'Edit employee' : 'Employee profile'} onBack={() => router.push('/admin/employees')} backDisabled={saving} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading employee" /> : employee ? <View style={styles.card}>
        <Text style={styles.cardTitle}>{employee.user.name}</Text><Text style={styles.subtitle}>{employee.employeeCode} · {employee.status}</Text>
        {edit ? <>
          {(['department', 'designation', 'workEmail', 'joiningDate', 'notes'] as const).map(field => <View key={field} style={[styles.field, styles.fullField]}>
            <Text style={styles.label}>{field === 'joiningDate' ? 'Joining date' : field === 'workEmail' ? 'Work email' : field.charAt(0).toUpperCase() + field.slice(1)}</Text>
            {field === 'joiningDate' ? <DatePickerField hideLabel label="Joining date" value={form.joiningDate} onChange={value => setForm(current => ({ ...current, joiningDate: value }))} disabled={saving} style={styles.input} /> : <TextInput accessibilityLabel={field} editable={!saving} style={styles.input} value={form[field]} maxLength={field === 'notes' ? 1000 : field === 'workEmail' ? 254 : 100} multiline={field === 'notes'} autoCapitalize={field === 'workEmail' ? 'none' : 'sentences'} keyboardType={field === 'workEmail' ? 'email-address' : 'default'} onChangeText={value => setForm(current => ({ ...current, [field]: value }))} />}
          </View>)}
          <Text style={styles.label}>Branch</Text><View style={styles.actions}>{branches.map(branch => <Pressable disabled={saving} key={branch.id} onPress={() => setForm(current => ({ ...current, branchId: branch.id }))} style={[styles.secondary, form.branchId === branch.id && styles.selected]}><Text>{branch.name}</Text></Pressable>)}</View>
          <Pressable disabled={saving} onPress={() => void save()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save employee'}</Text></Pressable>
        </> : <>
          {[['Email', employee.workEmail ?? employee.user.email], ['Phone', employee.user.phone], ['Department', employee.department], ['Job title', employee.designation], ['Branch', employee.branch.name], ['Joining date', employee.joiningDate.slice(0, 10)], ['Notes', employee.notes]].map(([label, value]) => <View key={label} style={styles.field}><Text style={styles.label}>{label}</Text><Text selectable style={styles.detailValue}>{value || 'Not set'}</Text></View>)}
          {scope?.role !== 'PAYROLL_MANAGER' && <Pressable onPress={() => router.push({ pathname: '/admin/employees/[id]/edit', params: { id: employee.id } })} style={styles.primary}><Text style={styles.primaryText}>Edit employee</Text></Pressable>}
        </>}
      </View> : <Pressable onPress={() => setAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable>}
      {!edit && employee && ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(scope?.role ?? '') && <View style={styles.card}>
        <Text style={styles.cardTitle}>Employment documents</Text>
        {documentsError !== '' && <Text accessibilityRole="alert" style={styles.error}>{documentsError}</Text>}
        {documents.map(document => <View key={document.id} style={styles.documentRow}><Text style={styles.label}>{document.title} · {document.kind.toLowerCase()}</Text>{document.content ? <Text selectable style={styles.detailValue}>{document.content}</Text> : null}{document.fileName ? <Pressable accessibilityRole="button" onPress={async () => { try { const file = await employeeDocumentsApi.file(document.id); if (Platform.OS === 'web') { const link = window.document.createElement('a'); link.href = `data:${file.mimeType};base64,${file.fileDataBase64}`; link.download = file.fileName; link.click(); } else { const uri = `${FileSystem.cacheDirectory}${file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`; await FileSystem.writeAsStringAsync(uri, file.fileDataBase64, { encoding: FileSystem.EncodingType.Base64 }); const Sharing = await import('expo-sharing'); await Sharing.shareAsync(uri, { mimeType: file.mimeType, dialogTitle: file.fileName }); } } catch (cause) { setDocumentsError(cause instanceof Error ? cause.message : 'Could not open document file.'); } }}><Text style={styles.link}>{document.fileName} · Download</Text></Pressable> : null}</View>)}

        <TextInput validation={{ required: true, minLength: 2 }} label={"Issue a document"} accessibilityLabel="Document title" value={documentTitle} onChangeText={setDocumentTitle} editable={!documentSaving} style={styles.input} maxLength={180} />
        <View style={styles.actions}>{(['LETTER', 'VERIFICATION', 'OTHER'] as const).map(kind => <Pressable key={kind} disabled={documentSaving} onPress={() => setDocumentKind(kind)} style={[styles.secondary, documentKind === kind && styles.selected]}><Text>{kind.toLowerCase()}</Text></Pressable>)}</View>
        <TextInput accessibilityLabel="Document content" value={documentContent} onChangeText={setDocumentContent} editable={!documentSaving} multiline maxLength={20000} style={[styles.input, styles.documentInput]} />
        <Pressable accessibilityRole="button" disabled={documentSaving} onPress={async () => { try { const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'text/plain'] }); if (result.canceled) return; const file = result.assets[0]; if (file.size && file.size > 5 * 1024 * 1024) { setDocumentsError('Choose a file no larger than 5 MB.'); return; } const base64 = Platform.OS === 'web' && file.file ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('Could not read the selected file.')); reader.readAsDataURL(file.file!); }) : await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 }); const extension = file.name.split('.').pop()?.toLowerCase(); const inferred: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' }; const mimeType = file.mimeType || inferred[extension || '']; if (!mimeType) { setDocumentsError('Choose a PDF, DOCX, PNG, JPEG or text file.'); return; } setDocumentFile({ name: file.name, mimeType, base64 }); setDocumentsError(''); } catch (cause) { setDocumentsError(cause instanceof Error ? cause.message : 'Could not read the selected file.'); } }} style={styles.secondary}><Text>{documentFile ? `Attached: ${documentFile.name}` : 'Attach a file (optional)'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={documentSaving || !documentTitle.trim() || (!documentContent.trim() && !documentFile)} onPress={() => void issueDocument()} style={styles.primary}><Text style={styles.primaryText}>{documentSaving ? 'Issuing…' : 'Issue verified document'}</Text></Pressable>
      </View>}
    </ScrollView><AdminBottomNavigation disabled={saving} />
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 16 }, title: { fontSize: 25, fontWeight: '700', color: '#20334f' },
  card: { padding: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16, gap: 14 }, cardTitle: { fontSize: 20, fontWeight: '700', color: '#20334f' }, documentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e8edf5', gap: 6 }, documentInput: { minHeight: 120, textAlignVertical: 'top' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#607591' }, field: { gap: 6 }, label: { fontSize: 13, fontWeight: '600', color: '#607591' }, detailValue: { fontSize: 15, lineHeight: 23, color: '#20334f' },
  input: { minHeight: 48, minWidth: 0, padding: 12, borderWidth: 1, borderColor: '#ccd6e5', borderRadius: 9, fontSize: 15 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: { minHeight: 44, padding: 10, justifyContent: 'center', borderRadius: 8 }, selected: { backgroundColor: '#e8eeff' }, link: { color: '#345cf2', fontWeight: '600' }, error: { color: '#b3261e', fontSize: 14, lineHeight: 22 },
  primary: { minHeight: 48, padding: 12, backgroundColor: '#345cf2', borderRadius: 9, justifyContent: 'center', alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
