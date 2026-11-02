import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { EmployeePageHeading } from '../../../src/features/employee/EmployeePageHeading';
import { Field } from '../../../src/features/employee/components';
import { AppIcon } from '../../../src/ui/AppIcon';
import { AttendanceAction } from '../../../src/features/employee/AttendanceUI';
import { pickDocument, type PickedDocument } from '../../../src/features/employee/pickDocument';
import { SelectField } from '../../../src/ui/SelectField';
import { leaveApi } from '../../../src/core/admin/api';
import { apiErrorMessage } from '../../../src/core/admin/http';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';
import { employeeDocumentsApi, type EmployeeDocumentDto } from '../../../src/core/admin/workspace-records.api';
import { useToastState } from '../../../src/ui/useToastState';

export default function DocumentsScreen() {
  // Measure the content area so the sidebar and shell padding are accounted for.
  const [contentWidth, setContentWidth] = useState(0);
  const phone = contentWidth < 480;
  const pairedFields = contentWidth >= 640;
  const columns = contentWidth >= 1000 ? 3 : contentWidth >= 640 ? 2 : 1;
  const cardWidth = contentWidth ? (contentWidth - (columns - 1) * 14) / columns : '100%';
  const { employeeCompanyId, employeeBranchId, employeeProfile, profileLoading, profileError } = useEmployeeWorkspace();
  const [items, setItems] = useState<EmployeeDocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState('', 'error');
  const [downloading, setDownloading] = useState('');
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    employeeDocumentsApi.mine()
      .then(rows => { if (active) setItems(rows.filter(row => !employeeCompanyId || row.companyId === employeeCompanyId)); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your documents.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employeeCompanyId, attempt]));

  const download = async (item: EmployeeDocumentDto) => {
    setDownloading(item.id); setError('');
    let cachedFile: File | undefined;
    try {
      const file = await employeeDocumentsApi.file(item.id);
      if (Platform.OS === 'web') {
        const link = window.document.createElement('a');
        link.href = `data:${file.mimeType};base64,${file.fileDataBase64}`;
        link.download = file.fileName;
        link.click();
      } else {
        const Sharing = await import('expo-sharing');
        if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
        const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        cachedFile = new File(Paths.cache, `${item.id}-${safeName}`);
        cachedFile.write(file.fileDataBase64, { encoding: 'base64' });
        await Sharing.shareAsync(cachedFile.uri, { mimeType: file.mimeType, dialogTitle: file.fileName });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download this file.');
    } finally {
      try { cachedFile?.delete(); } catch { /* Preserve the download result. */ }
      setDownloading('');
    }
  };

  const refresh = () => setAttempt(value => value + 1);

  // Upload form: documents are shared with the reporting manager.
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [managerId, setManagerId] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string; position: string; department: string }[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const assignedManagerId = employeeProfile?.reportingManagerId ?? '';

  useEffect(() => {
    let active = true;
    setPeople([]); setManagerId(assignedManagerId);
    if (!employeeCompanyId || !employeeBranchId) return;
    setPeopleLoading(true);
    leaveApi.reportingTo(employeeCompanyId, employeeBranchId)
      .then(rows => { if (active) setPeople(rows); })
      .catch(() => { if (active) setFormError('Unable to load reporting managers.'); })
      .finally(() => { if (active) setPeopleLoading(false); });
    return () => { active = false; };
  }, [employeeCompanyId, employeeBranchId, assignedManagerId]);
  const managerName = (id?: string | null) => people.find(person => person.id === id)?.name ?? (id && id === assignedManagerId ? employeeProfile?.reportingManager?.name : undefined);

  const chooseFile = async () => {
    setFormError('');
    try {
      const picked = await pickDocument();
      if (picked) { setFile(picked); if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, '').slice(0, 180)); }
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not read that file.'); }
  };
  const clearForm = () => { if (uploading) return; setFormError(''); setTitle(''); setNote(''); setFile(null); };
  const submit = async () => {
    if (uploading) return;
    if (!employeeCompanyId || !employeeBranchId) { setFormError('Your work assignment is not available yet.'); return; }
    if (title.trim().length < 2) { setFormError('Enter a document title.'); return; }
    if (!file) { setFormError('Choose a file to upload.'); return; }
    if (!managerId) { setFormError('Select the reporting manager to share this with.'); return; }
    setUploading(true); setFormError('');
    try {
      await employeeDocumentsApi.upload({
        companyId: employeeCompanyId, branchId: employeeBranchId, reportingToId: managerId, title: title.trim(),
        ...(note.trim() ? { content: note.trim() } : {}), fileName: file.name, mimeType: file.mimeType, fileDataBase64: file.base64,
      });
      setNotice(`Shared with ${managerName(managerId) ?? 'your reporting manager'}.`);
      setTitle(''); setNote(''); setFile(null);
      refresh();
    } catch (cause) { setFormError(apiErrorMessage(cause, 'Could not upload this document.')); }
    finally { setUploading(false); }
  };

  return <View testID="employee-documents" style={styles.page} onLayout={event => setContentWidth(event.nativeEvent.layout.width)}>
    <EmployeePageHeading title="My documents" backTo="profile">
      <Pressable accessibilityRole="button" accessibilityLabel={error ? 'Retry loading documents' : 'Refresh documents'}
        accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={refresh} style={[styles.refreshButton, phone && styles.refreshButtonPhone, loading && styles.disabled]}>
        {loading ? <ActivityIndicator size="small" color="#345cf2" /> : <AppIcon name="refresh-cw" size={17} color="#345cf2" />}
        {!phone && <Text style={styles.buttonText}>{error ? 'Retry' : 'Refresh'}</Text>}
      </Pressable>
    </EmployeePageHeading>
    {!!notice && <View style={styles.success}><Text accessibilityRole="alert" style={styles.successText}>{notice}</Text></View>}
    <View style={[styles.card, phone && styles.cardPhone]}>
      <Text accessibilityRole="header" style={styles.title}>Upload a document</Text>
      <Text style={styles.body}>Choose a file and your reporting manager. It will appear in their My documents page.</Text>
      <View testID="document-details-fields" style={[styles.formRow, !pairedFields && styles.formStack]}>
        <View style={[styles.formCell, !pairedFields && styles.formCellStack]}><Field label="Document title" value={title} onChange={value => { setTitle(value); setFormError(''); }} editable={!uploading} maxLength={180} validation={{ required: true }} /></View>
        <View style={[styles.formCell, !pairedFields && styles.formCellStack]}>
          <SelectField label="Reporting to" labelInside value={managerId} options={[
            { value: '', label: peopleLoading ? 'Loading managers…' : 'Select reporting manager' },
            ...people.map(person => ({ value: person.id, label: [person.name, person.position].filter(Boolean).join(' · ') })),
            ...(assignedManagerId && !people.some(person => person.id === assignedManagerId) ? [{ value: assignedManagerId, label: managerName(assignedManagerId) ?? 'Assigned manager' }] : []),
          ]} disabled={uploading || peopleLoading || !!assignedManagerId} onChange={value => { setManagerId(value); setFormError(''); }} />
          {!!assignedManagerId && <Text style={styles.meta}>Assigned by HR</Text>}
        </View>
      </View>
      <View style={styles.attachment}>
        <Text style={styles.fieldLabel}>File</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={file ? `Change file: ${file.name}` : 'Choose file'} accessibilityState={{ disabled: uploading }} disabled={uploading} onPress={() => void chooseFile()} style={[styles.fileButton, uploading && styles.disabled]}>
          <AppIcon name={file ? 'file-text' : 'upload'} size={20} color="#345cf2" />
          <View style={styles.fileCopy}>
            <Text numberOfLines={2} style={styles.fileName}>{file ? file.name : 'Choose a file to share'}</Text>
            <Text style={styles.meta}>{file ? 'Tap to choose a different file' : 'PDF, DOCX, PNG, JPEG or TXT · max 5 MB'}</Text>
          </View>
        </Pressable>
      </View>
      <Field label="Note (optional)" value={note} onChange={setNote} multiline editable={!uploading} maxLength={2000} />
      {!!formError && <Text accessibilityRole="alert" style={styles.error}>{formError}</Text>}
      <View style={[styles.formActions, phone && styles.formActionsPhone]}>
        <View style={[styles.actionCell, phone && styles.actionCellPhone]}><AttendanceAction label="Clear" secondary disabled={uploading} onPress={clearForm} /></View>
        <View style={[styles.actionCell, phone && styles.actionCellPhone]}><AttendanceAction label={uploading ? 'Uploading…' : 'Share document'} loading={uploading} disabled={uploading} onPress={() => void submit()} /></View>
      </View>
    </View>
    {!!profileError && <Text accessibilityRole="alert" style={styles.error}>{profileError}</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!loading && !profileLoading && items.length > 0 && <View style={styles.listHeader}>
      <Text accessibilityRole="header" style={styles.title}>Shared and received documents</Text>
      <Text style={styles.meta}>{items.length} {items.length === 1 ? 'document' : 'documents'}</Text>
    </View>}
    {loading || profileLoading ? <View style={[styles.card, styles.stateCard]}><ActivityIndicator accessibilityLabel="Loading documents" /><Text style={styles.body}>Loading your documents…</Text></View>
      : items.length ? <View testID="document-grid" style={styles.grid}>{items.map(item => <View key={item.id} testID="document-card" style={[styles.card, phone && styles.cardPhone, styles.docCard, { width: cardWidth }]}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.sharedBy ? `Shared by ${item.sharedBy}` : item.status === 'SUBMITTED' ? `Shared with ${managerName(item.reportingToId) ?? 'your reporting manager'}` : item.kind.toLowerCase()} · {new Date(item.createdAt).toLocaleDateString()}</Text>
        {item.content ? <Text selectable style={styles.body}>{item.content}</Text> : null}
        {item.fileName ? <View style={styles.downloadArea}>
          <Text numberOfLines={2} style={styles.attachmentName}>{item.fileName}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Download ${item.fileName}`} accessibilityState={{ disabled: !!downloading, busy: downloading === item.id }}
            disabled={!!downloading} onPress={() => void download(item)} style={[styles.button, !!downloading && styles.disabled]}>
            {downloading === item.id ? <ActivityIndicator size="small" color="#345cf2" /> : <AppIcon name="download" size={17} color="#345cf2" />}
            <Text style={styles.buttonText}>{downloading === item.id ? 'Preparing file…' : 'Download file'}</Text>
          </Pressable>
        </View> : null}
      </View>)}</View>
      : !error && <View style={[styles.card, styles.stateCard]}>
        <AppIcon name="file-text" size={28} color="#71829c" />
        <Text style={styles.title}>No documents yet</Text>
        <Text style={styles.body}>Documents issued by your HR team or shared with you will appear here.</Text>
      </View>}
  </View>;
}

const styles = StyleSheet.create({
  page: { width: '100%', minWidth: 0, maxWidth: 1240, alignSelf: 'center', gap: 16 },
  card: { minWidth: 0, padding: 20, gap: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16 },
  cardPhone: { padding: 14 },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: '#20334f', ...Platform.select({ web: { overflowWrap: 'anywhere' } }) },
  meta: { fontSize: 12, lineHeight: 18, color: '#71829c', ...Platform.select({ web: { overflowWrap: 'anywhere' } }) },
  body: { fontSize: 14, lineHeight: 21, color: '#405573', ...Platform.select({ web: { overflowWrap: 'anywhere' } }) },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#20334f' },
  refreshButton: { height: 44, minWidth: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, backgroundColor: '#eaf0ff' },
  refreshButtonPhone: { width: 44, paddingHorizontal: 0 },
  button: { width: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#eaf0ff' },
  attachment: { gap: 8 },
  fileButton: { width: '100%', minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, backgroundColor: '#f7f9ff', borderWidth: 1, borderColor: '#cdd9f7', borderStyle: 'dashed' },
  fileCopy: { flex: 1, minWidth: 0, gap: 4 },
  fileName: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#345cf2', ...Platform.select({ web: { overflowWrap: 'anywhere' } }) },
  attachmentName: { fontSize: 12, lineHeight: 18, color: '#405573', ...Platform.select({ web: { overflowWrap: 'anywhere' } }) },
  downloadArea: { marginTop: 'auto', paddingTop: 4, gap: 10 },
  buttonText: { flexShrink: 1, fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#345cf2', textAlign: 'center' },
  disabled: { opacity: 0.55 },
  error: { color: '#b3261e', fontSize: 13 },
  success: { padding: 12, borderRadius: 12, backgroundColor: '#E6F4EF', borderWidth: 1, borderColor: '#BFE3D7' },
  successText: { fontSize: 13, color: '#11786D' },
  formRow: { flexDirection: 'row', gap: 16 },
  formStack: { flexDirection: 'column' },
  formCell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
  formCellStack: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  formActionsPhone: { flexDirection: 'column-reverse' },
  actionCellPhone: { flexGrow: 0, flexBasis: 'auto', maxWidth: '100%', width: '100%' },
  actionCell: { flexShrink: 1, flexBasis: 170, minWidth: 0 },
  listHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', columnGap: 14, rowGap: 14 },
  docCard: { minWidth: 0 },
  stateCard: { alignItems: 'center', paddingVertical: 28 },
});
