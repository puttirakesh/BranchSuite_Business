import { KeyboardAwareScrollView as ScrollView } from '../../ui/KeyboardAwareScrollView';
import { formSpacing } from '../../shared/theme/formSpacing';
import { canManageEmployees } from '../../core/admin/role-capabilities';
import { toast } from '../../ui/toast-store';
import { useToastState } from '../../ui/useToastState';
import { FloatingTextInput as TextInput } from "../../ui/FloatingTextInput";
import { AdminPageHeading } from '../../ui/AdminPageHeading';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../core/admin/useWorkspaceFocusEffect';
import { employeesApi, type EmployeeProfileDto, type UserDto } from '../../core/admin/api';
import { reportingManagerOptions } from '../../core/admin/reporting-managers';
import { usersApi } from '../../core/admin/api';
import { isBusinessAdminRole } from '../../core/admin/access';
import { employeeDocumentsApi, type EmployeeDocumentDto } from '../../core/admin/workspace-records.api';
import { getAdminScope, useAdminScope } from '../../core/admin/scope';
import { getAvailableBranches } from '../../core/admin/available-branches';
import { AdminBottomNavigation } from '../../ui/AdminBottomNavigation';
import { AppIcon } from '../../ui/AppIcon';
import { DatePickerField } from '../../ui/DatePickerField';
import { SelectField } from '../../ui/SelectField';
import { useAdminLayout } from '../../ui/useAdminLayout';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const emptyForm = { bankName: '', bankEnding: '', bankIfsc: '', pan: '', uan: '', department: '', designation: '', workEmail: '', joiningDate: '', notes: '', branchId: '' };
const fieldLabels: Partial<Record<keyof typeof emptyForm, string>> = { department: 'Department', designation: 'Job title', notes: 'Notes', bankName: 'Bank name', bankEnding: 'Account number', bankIfsc: 'IFSC', pan: 'PAN', uan: 'UAN', joiningDate: 'Joining date', workEmail: 'Work email' };
const documentMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'text/plain'];
const documentMimeByExtension: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' };
const managerPrefix = 'Reporting manager: ';
const maxDocumentSize = 5 * 1024 * 1024;

async function readPickedDocument(): Promise<{ name: string; mimeType: string; base64: string } | null> {
  if (Platform.OS === 'web') {
    const result = await DocumentPicker.getDocumentAsync({ type: documentMimeTypes });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (asset.size && asset.size > maxDocumentSize) throw new Error('Choose a file no larger than 5 MB.');
    if (!asset.file) throw new Error('Could not read that file. Try choosing it again.');
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read that file. Try choosing it again.'));
      reader.readAsDataURL(asset.file!);
    });
    const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = asset.mimeType && asset.mimeType !== 'application/octet-stream' ? asset.mimeType : documentMimeByExtension[extension];
    if (!mimeType) throw new Error('Choose a PDF, DOCX, PNG, JPEG or text file.');
    return { name: asset.name, mimeType, base64 };
  }

  const selection = await File.pickFileAsync({ mimeTypes: documentMimeTypes });
  if (selection.canceled) return null;
  const file = selection.result;
  if (file.size && file.size > maxDocumentSize) throw new Error('Choose a file no larger than 5 MB.');
  let base64: string;
  try {
    base64 = await file.base64();
  } catch {
    // The legacy reader can handle providers that do not support the newer File read method.
    base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 }).catch(() => {
      throw new Error('Could not read that file. Save it to your device and try again.');
    });
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type && file.type !== 'application/octet-stream' ? file.type : documentMimeByExtension[extension];
  if (!mimeType) throw new Error('Choose a PDF, DOCX, PNG, JPEG or text file.');
  return { name: file.name, mimeType, base64 };
}

export function EmployeeProfilePage({ edit = false }: { edit?: boolean }) {
  const { styles, contentWidth, fontScale } = useAdminLayout(baseStyles, edit ? 'form' : 'page');
  // Profile view: 2 columns on phones, 3 from tablet width up. The edit form stays single-column on all phone sizes.
  const columns = contentWidth / fontScale >= 640 ? 3 : edit || contentWidth / fontScale < 300 ? 1 : 2;
  const cardInnerWidth = contentWidth - 42;
  const cellWidth = Math.floor((cardInnerWidth - formSpacing.field * (columns - 1)) / columns);
  const cellStyle = (full: boolean) => columns > 1 && !full ? { width: cellWidth } : styles.fullField;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scope = useAdminScope();
  const [employee, setEmployee] = useState<EmployeeProfileDto | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [managerLabel, setManagerLabel] = useState('');
  const [managerUsers, setManagerUsers] = useState<UserDto[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<EmployeeProfileDto[]>([]);
  const [managersError, setManagersError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const accessBusy = useRef(false);
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
      setEmployee(found); setBranches(choices); setTeamProfiles(team);
      const noteLines = (found.notes ?? '').split('\n');
      const managerLine = noteLines.find(line => line.startsWith(managerPrefix));
      setManagerLabel(managerLine ? managerLine.slice(managerPrefix.length).trim() : '');
      setManagersError('');
      if (edit) employeesApi.reportingManagers(current.companyId).then(users => { if (active) setManagerUsers(users); }).catch(() => { if (active) setManagersError('Could not load reporting managers.'); });
      setForm({ bankName: found.bankName ?? '', bankEnding: '', bankIfsc: found.bankIfsc ?? '', pan: found.pan ?? '', uan: found.uan ?? '', department: found.department ?? '', designation: found.designation ?? '', workEmail: found.workEmail ?? '', joiningDate: found.joiningDate.slice(0, 10), notes: noteLines.filter(line => line !== managerLine).join('\n').trim(), branchId: found.branchId });
      if (['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(current.role)) {
        employeeDocumentsApi.list(current.companyId, found.userId).then(items => { if (active) setDocuments(items); }).catch(cause => { if (active) setDocumentsError(cause instanceof Error ? cause.message : 'Could not load employee documents.'); });
      }
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load employee.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt, scope?.companyId, edit]));
  const managerOptions = useMemo(() => employee ? reportingManagerOptions(managerUsers, teamProfiles, employee.companyId, form.branchId, employee.user.email) : [], [managerUsers, teamProfiles, employee, form.branchId]);
  const managerValue = managerOptions.find(option => option.label === managerLabel)?.value ?? '';
  const hint = managersError || (managerLabel && !managerValue ? 'Current: ' + managerLabel + ' (not in this branch list). Choose another to change it.' : managerOptions.length ? '' : 'No reporting managers available for this branch.');
  const save = async () => {
    if (!employee || busy.current) return;
    const date = new Date(`${form.joiningDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== form.joiningDate || !branches.some(branch => branch.id === form.branchId) || (form.workEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail.trim()))) { setError('Select an available branch, enter a valid joining date, and provide a valid email if supplied.'); return; }
    const accountNumber = form.bankEnding.trim();
    if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) { setError('Enter the full account number (9 to 18 digits).'); return; }
    if (employee.workEmail && !form.workEmail.trim()) { setError('Enter a replacement work email.'); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      await employeesApi.update(employee.id, { ...form, bankEnding: accountNumber ? accountNumber.slice(-4) : employee.bankEnding ?? '', department: form.department.trim(), designation: form.designation.trim(), notes: [managerLabel.trim() && managerPrefix + managerLabel.trim(), form.notes.trim()].filter(Boolean).join('\n'), ...(form.workEmail.trim() ? { workEmail: form.workEmail.trim() } : { workEmail: undefined }) });
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
  const changeAccess = async (action: 'status' | 'login') => {
    if (!employee || accessBusy.current || !isBusinessAdminRole(scope?.role)) return;
    accessBusy.current = true;
    setAccessSaving(true);
    try {
      if (action === 'status') {
        if (employee.status === 'EXITED') throw new Error('Rehiring an exited employee is not supported yet.');
        const updated = await employeesApi.setStatus(employee.id, employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
        setEmployee(updated);
      } else {
        if (employee.user.status === 'ACTIVE') await usersApi.deactivate(employee.userId);
        else await usersApi.activate(employee.userId);
        setEmployee(await employeesApi.get(employee.id));
      }
      toast.success(action === 'status' ? 'Employment status updated.' : 'Employee login updated.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update employee access.'); }
    finally { accessBusy.current = false; setAccessSaving(false); }
  };
  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <View  style={styles.keyboardPage} >
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AdminPageHeading title={edit ? 'Edit employee' : 'Employee profile'} onBack={() => router.canGoBack() ? router.back() : router.replace('/admin/employees')} backDisabled={saving || accessSaving || documentSaving} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading employee" /> : employee ? <View style={styles.card}>
        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{employee.user.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'U'}</Text></View>
          <View style={styles.profileIdentity}><Text accessibilityRole="header" style={styles.cardTitle}>{employee.user.name}</Text><Text style={styles.subtitle}>{employee.designation || 'Employee'} · {employee.branch.name}</Text><Text style={styles.label}>{employee.employeeCode} · {employee.status}</Text></View>
        </View>
        {edit ? <>
          <View style={[styles.detailGrid, columns > 1 && styles.detailGridWide]}>
          {(['department', 'designation', 'workEmail', 'joiningDate', 'notes', 'bankName', 'bankEnding', 'bankIfsc', 'pan', 'uan'] as const).map(field => <React.Fragment key={field}>
            {field === 'workEmail' && <View style={[styles.field, cellStyle(false)]}>
              <SelectField label="Branch" labelInside searchable={false} hideScrollbar value={form.branchId} disabled={saving} options={branches.map(branch => ({ value: branch.id, label: branch.name }))} onChange={branchId => setForm(current => ({ ...current, branchId }))} />
            </View>}
            {field === 'notes' && <View style={[styles.field, cellStyle(false)]}>
              <SelectField label="Reporting manager" searchable={false} hideScrollbar value={managerValue} disabled={saving || (!managerOptions.length && !managersError)} options={managerOptions} onChange={id => setManagerLabel(managerOptions.find(option => option.value === id)?.label ?? managerLabel)} />
              {!!hint && <Text style={styles.documentHint}>{hint}</Text>}
            </View>}
            {field === 'bankName' && <Text style={[styles.cardTitle, styles.fullField, styles.sectionDivider]}>Payroll details</Text>}
            <View style={[styles.field, cellStyle(field === 'notes')]}>
            {field === 'joiningDate' ? <DatePickerField label="Joining date" value={form.joiningDate} onChange={value => setForm(current => ({ ...current, joiningDate: value }))} disabled={saving} style={styles.input} /> : <TextInput clearOnSubmit={false} validation={field === 'bankName' ? { kind: 'name' } : field === 'bankIfsc' ? { kind: 'code', startsWith: 'letter', pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/, patternMessage: 'Enter a valid 11-character IFSC.' } : field === 'pan' ? { kind: 'code', startsWith: 'letter', pattern: /^[A-Z]{5}\d{4}[A-Z]$/, patternMessage: 'Enter a valid PAN.' } : field === 'bankEnding' ? { kind: 'integer', minLength: 9, maxLength: 18 } : field === 'uan' ? { kind: 'integer', minLength: 12, maxLength: 12 } : undefined} label={fieldLabels[field]} accessibilityLabel={fieldLabels[field] ?? field} editable={!saving} style={styles.input} value={form[field]} maxLength={field === 'notes' ? 1000 : field === 'workEmail' ? 254 : field === 'bankEnding' ? 18 : field === 'bankIfsc' ? 11 : field === 'pan' ? 10 : field === 'uan' ? 12 : 100} multiline={field === 'notes'} autoCapitalize={field === 'workEmail' ? 'none' : field === 'bankIfsc' || field === 'pan' ? 'characters' : 'sentences'} keyboardType={field === 'workEmail' ? 'email-address' : field === 'bankEnding' || field === 'uan' ? 'number-pad' : 'default'} onChangeText={value => setForm(current => ({ ...current, [field]: field === 'bankIfsc' || field === 'pan' ? value.toUpperCase() : value }))} />}
          {field === 'bankEnding' && !!employee.bankEnding && <Text style={styles.documentHint}>Saved: XXXX{employee.bankEnding}. Enter the full number only to change it.</Text>}
          </View></React.Fragment>)}
          </View>
          <Pressable disabled={saving} onPress={() => void save()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save employee'}</Text></Pressable>
        </> : <>
          <Text style={styles.sectionTitle}>Contact and employment</Text>
          <View style={[styles.detailGrid, columns > 1 && styles.detailGridWide]}>
          {[['Email', employee.workEmail ?? employee.user.email], ['Phone', employee.user.phone], ['Department', employee.department], ['Job title', employee.designation], ['Branch', employee.branch.name], ['Reporting manager', employee.notes?.match(/^Reporting manager: (.*)$/m)?.[1]], ['Joining date', employee.joiningDate.slice(0, 10)], ['Login access', employee.user.status === 'ACTIVE' ? 'Enabled' : 'Disabled'], ['Notes', employee.notes?.replace(/^Reporting manager: .*\r?\n?/m, '').trim()], ['Bank name', employee.bankName], ['Account ending', employee.bankEnding ? 'XXXX' + employee.bankEnding : ''], ['IFSC', employee.bankIfsc], ['PAN', employee.pan], ['UAN', employee.uan]].map(([label, value]) => <React.Fragment key={label}>
            {label === 'Bank name' && <Text style={[styles.sectionTitle, styles.fullField, styles.sectionDivider]}>Payroll details</Text>}
            <View style={[styles.field, cellStyle(label === 'Notes')]}><Text style={styles.label}>{label}</Text><Text selectable style={styles.detailValue}>{value || 'Not set'}</Text></View>
          </React.Fragment>)}
          </View>
          {canManageEmployees(scope?.roles ?? [scope?.role ?? '']) && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/admin/employees/[id]/edit', params: { id: employee.id } })} style={styles.primary}><Text style={styles.primaryText}>Edit employee</Text></Pressable>}
        </>}
      </View> : <Pressable onPress={() => setAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable>}
      {!edit && employee && isBusinessAdminRole(scope?.role) && <View style={styles.card}>
        <Text style={styles.sectionTitle}>Business role and payroll</Text>
        <Text style={styles.subtitle}>This employee profile and starting salary are linked to the account. Assigning a business role keeps the profile and salary history attached.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Assign business role to ${employee.user.name}`} onPress={() => router.push({ pathname: '/admin/roles-permissions', params: { userId: employee.userId } })} style={styles.primary}><Text style={styles.primaryText}>Assign business role</Text></Pressable>
      </View>}
      {!edit && employee && isBusinessAdminRole(scope?.role) && <View style={styles.card}>
        <Text style={styles.sectionTitle}>Employment and login access</Text>
        <Text style={styles.subtitle}>Employment: {employee.status.toLowerCase()} · Login: {employee.user.status === 'ACTIVE' ? 'enabled' : 'disabled'}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={accessSaving || employee.status === 'EXITED'} accessibilityState={{ disabled: accessSaving || employee.status === 'EXITED', busy: accessSaving }} onPress={() => void changeAccess('status')} style={[styles.kindOption, accessSaving && styles.disabled]}><Text style={styles.kindText}>{employee.status === 'ACTIVE' ? 'Mark inactive' : 'Mark active'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={accessSaving} accessibilityState={{ disabled: accessSaving, busy: accessSaving }} onPress={() => void changeAccess('login')} style={[styles.kindOption, accessSaving && styles.disabled]}><Text style={styles.kindText}>{employee.user.status === 'ACTIVE' ? 'Disable login' : 'Enable login'}</Text></Pressable>
        </View>
        <Text style={styles.documentHint}>Disabling login also excludes the employee from attendance marking and payroll.</Text>
      </View>}
      {!edit && employee && ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(scope?.role ?? '') && <View style={styles.card}>
        <Text style={styles.cardTitle}>Employment documents</Text>
        {documentsError !== '' && <Text accessibilityRole="alert" style={styles.error}>{documentsError}</Text>}
        {documents.map(document => <View key={document.id} style={styles.documentRow}><Text style={styles.label}>{document.title} · {document.kind.toLowerCase()}</Text>{document.content ? <Text selectable style={styles.detailValue}>{document.content}</Text> : null}{document.fileName ? <Pressable accessibilityRole="button" onPress={async () => { try { const file = await employeeDocumentsApi.file(document.id); if (Platform.OS === 'web') { const link = window.document.createElement('a'); link.href = `data:${file.mimeType};base64,${file.fileDataBase64}`; link.download = file.fileName; link.click(); } else { const uri = `${FileSystem.cacheDirectory}${file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`; await FileSystem.writeAsStringAsync(uri, file.fileDataBase64, { encoding: FileSystem.EncodingType.Base64 }); const Sharing = await import('expo-sharing'); await Sharing.shareAsync(uri, { mimeType: file.mimeType, dialogTitle: file.fileName }); } } catch (cause) { setDocumentsError(cause instanceof Error ? cause.message : 'Could not open document file.'); } }}><Text style={styles.link}>{document.fileName} · Download</Text></Pressable> : null}</View>)}

        <Text style={styles.sectionTitle}>Issue a new document</Text>
        <TextInput validation={{ required: true, minLength: 2 }} label="Document title" accessibilityLabel="Document title" value={documentTitle} onChangeText={setDocumentTitle} editable={!documentSaving} style={styles.input} maxLength={180} />
        <SelectField label="Document type" value={documentKind} disabled={documentSaving} onChange={value => setDocumentKind(value as EmployeeDocumentDto['kind'])} options={[{ value: 'LETTER', label: 'Letter' }, { value: 'VERIFICATION', label: 'Verification' }, { value: 'OTHER', label: 'Other' }]} />
        <TextInput accessibilityLabel="Document content" value={documentContent} onChangeText={setDocumentContent} editable={!documentSaving} multiline maxLength={20000} style={[styles.input, styles.documentInput]} />
        <Text style={styles.documentHint}>Enter the document text or attach a file to continue.</Text>
        <Text style={styles.label}>Attach a file (optional)</Text>
        <View style={styles.fileInput}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose file to attach" disabled={documentSaving} onPress={async () => { try { const attachment = await readPickedDocument(); if (attachment) { setDocumentFile(attachment); setDocumentsError(''); } } catch (cause) { setDocumentsError(cause instanceof Error ? cause.message : 'Could not read that file. Try again.'); } }} style={[styles.fileButton, documentSaving && styles.disabled]}><AppIcon name="upload" size={16} color="#345cf2" /><Text style={styles.fileButtonText}>{documentFile ? 'Change file' : 'Choose file'}</Text></Pressable>
          <Text numberOfLines={1} style={[styles.fileName, !documentFile && styles.fileNameEmpty]}>{documentFile ? documentFile.name : 'No file chosen'}</Text>
          {documentFile && <Pressable accessibilityRole="button" accessibilityLabel="Remove attached file" disabled={documentSaving} hitSlop={8} onPress={() => setDocumentFile(null)}><AppIcon name="x" size={18} color="#607591" /></Pressable>}
        </View>
        <Text style={styles.documentHint}>PDF, DOCX, PNG, JPEG or TXT, up to 5 MB.</Text>
        <Pressable accessibilityRole="button" disabled={documentSaving || !documentTitle.trim() || (!documentContent.trim() && !documentFile)} onPress={() => void issueDocument()} style={[styles.primary, (documentSaving || !documentTitle.trim() || (!documentContent.trim() && !documentFile)) && styles.disabled]}><Text style={styles.primaryText}>{documentSaving ? 'Issuing…' : 'Issue verified document'}</Text></Pressable>
      </View>}
    </ScrollView><AdminBottomNavigation disabled={saving || documentSaving || accessSaving} />
    </View>
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e4eaf5' },
  profileAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' },
  profileInitials: { fontSize: 20, fontWeight: '700', color: '#345cf2' }, profileIdentity: { flex: 1, minWidth: 0, gap: 4 },
  detailGrid: { width: '100%', gap: formSpacing.field }, detailGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  fullField: { width: '100%', minWidth: 0 }, sectionDivider: { borderTopWidth: 1, borderTopColor: '#e4eaf5', paddingTop: 16, marginTop: 8 },
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 16 }, title: { fontSize: 25, fontWeight: '700', color: '#20334f' },
  card: { padding: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16, gap: formSpacing.field }, cardTitle: { fontSize: 20, fontWeight: '700', color: '#20334f' }, sectionTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: '#20334f', marginTop: 4 }, documentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e8edf5', gap: 6 }, documentInput: { minHeight: 120, textAlignVertical: 'top' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#607591' }, field: { gap: 6 }, label: { fontSize: 14, fontWeight: '800', color: '#20334f' }, detailValue: { fontSize: 15, lineHeight: 23, fontWeight: '400', color: '#20334f', flexShrink: 1, minWidth: 0 },
  input: { minHeight: 48, minWidth: 0, padding: 12, borderWidth: 1, borderColor: '#ccd6e5', borderRadius: 9, fontSize: 15 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: { minHeight: 44, padding: 10, justifyContent: 'center', borderRadius: 8 },
  keyboardPage: { flex: 1, minHeight: 0 },
  fileInput: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderWidth: 1, borderColor: '#ccd6e5', borderRadius: 9, borderStyle: 'dashed', backgroundColor: '#fafbff' },
  fileButton: { minHeight: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 7, backgroundColor: '#e8eeff' }, fileButtonText: { fontSize: 14, fontWeight: '600', color: '#345cf2' },
  fileName: { flex: 1, minWidth: 0, fontSize: 14, color: '#20334f' }, fileNameEmpty: { color: '#8a99ad' },
  kindOption: { minHeight: 44, minWidth: 72, flexGrow: 1, flexBasis: 72, maxWidth: 160, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fff' }, kindText: { fontSize: 13, color: '#52647b', fontWeight: '600' }, kindTextSelected: { color: '#345cf2' },
  selected: { backgroundColor: '#e8eeff', borderColor: '#aebff5' }, documentHint: { fontSize: 12, lineHeight: 18, color: '#718096', marginTop: -8 }, disabled: { opacity: 0.48 },
  link: { color: '#345cf2', fontWeight: '600' }, error: { color: '#b3261e', fontSize: 14, lineHeight: 22 },
  primary: { minHeight: 48, padding: 12, backgroundColor: '#345cf2', borderRadius: 9, justifyContent: 'center', alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
