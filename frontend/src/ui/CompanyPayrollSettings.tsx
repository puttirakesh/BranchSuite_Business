import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { companiesApi, type CompanyDto } from '../core/admin/api';
import { api } from '../core/api/client';
import { apiErrorMessage } from '../core/admin/http';
import { type PayslipSettings } from '../core/payroll-settings';
import { FloatingTextInput } from './FloatingTextInput';
import { SelectField } from './SelectField';
import { useToastState } from './useToastState';

export function CompanyPayrollSettings({ company, onSaved }: { company: CompanyDto; onSaved: (value: CompanyDto) => void }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PayslipSettings>(company.payslipSettings ?? {});
  const [weekly, setWeekly] = useState(company.payrollCalendar?.weeklyOffDays ?? []);
  const [holidays, setHolidays] = useState(company.payrollCalendar?.holidays.join('\n') ?? '');
  const [mode, setMode] = useState('FIXED');
  const [effective, setEffective] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useToastState('', 'error');
  const [notice, setNotice] = useToastState('', 'success');
  useEffect(() => setSettings(company.payslipSettings ?? {}), [company.id, company.payslipSettingsVersion]);
  useEffect(() => { setWeekly(company.payrollCalendar?.weeklyOffDays ?? []); setHolidays(company.payrollCalendar?.holidays.join('\n') ?? ''); }, [company.id, company.payrollCalendar]);
  const update = <K extends keyof PayslipSettings>(key: K, value: PayslipSettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const perform = async (action: () => Promise<unknown>, message: string) => {
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try { if (await action() !== false) setNotice(message); } catch (cause) { setError(apiErrorMessage(cause, 'Could not save payroll settings.')); } finally { setSaving(false); }
  };
  const pickLogo = () => perform(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/png', 'image/jpeg'], copyToCacheDirectory: true });
    if (result.canceled) return false;
    const asset = result.assets[0];
    if (!asset.size || asset.size > 125000) throw new Error('Choose a PNG or JPEG logo smaller than 125 KB.');
    let data: string;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read logo.')); reader.readAsDataURL(blob); });
    } else {
      const { File } = await import('expo-file-system');
      data = `data:${asset.mimeType};base64,${await new File(asset.uri).base64()}`;
    }
    update('logoDataUrl', data);
  }, 'Logo selected. Save payslip settings to apply it.');
  const saveTemplate = () => perform(async () => {
    const updated = await companiesApi.savePayslipSettings(company.id, { ...settings, version: company.payslipSettingsVersion ?? 1 });
    onSaved(updated);
  }, 'Payslip settings saved. Existing calculated payslips keep their original format.');
  const saveCalendar = () => perform(async () => {
    const dates = [...new Set(holidays.split(/[\s,]+/).filter(Boolean))];
    if (dates.some(value => !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error('Enter holiday dates as YYYY-MM-DD, one per line.');
    onSaved(await companiesApi.savePayrollCalendar(company.id, { weeklyOffDays: weekly, holidays: dates }));
  }, 'Payroll calendar saved.');
  const createPolicy = () => perform(async () => {
    if (!/^\d{4}-\d{2}-01$/.test(effective)) throw new Error('Enter the first day of the effective month as YYYY-MM-01.');
    if (mode === 'ATTENDANCE_BASED' && !company.payrollCalendar) throw new Error('Save the payroll calendar before enabling attendance payroll.');
    await api.post('/payroll/policies', { companyId: company.id, mode, effectiveFrom: effective, halfDayDeduction: '0.50', deductUnpaidLeave: true, deductAbsentDays: true });
  }, 'Payroll policy created. It applies from the selected month.');
  const toggleFields: [keyof PayslipSettings, string, boolean][] = [['showDepartment', 'Show department', true], ['showDesignation', 'Show designation', true], ['showBranch', 'Show branch', true], ['showPaidDays', 'Show paid days', true], ['showBankDetails', 'Show masked bank details', false], ['showIdentifiers', 'Show PAN and UAN', false]];
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel="Company payslip and payroll settings" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.toggle}><Text style={styles.title}>Payslip & payroll settings</Text><Text>{open ? 'Close' : 'Configure'}</Text></Pressable>
    {open && <View style={styles.section}>
      <Text style={styles.caption}>Settings apply only to {company.name}. New calculations preserve a copy of the settings and employee details.</Text>
      <FloatingTextInput label="Company address on payslip" value={settings.address ?? ''} onChangeText={value => update('address', value)} multiline maxLength={500} editable={!saving} />
      {!!settings.logoDataUrl && <Image accessibilityLabel="Payslip logo preview" source={{ uri: settings.logoDataUrl }} style={{ width: 100, height: 56 }} resizeMode="contain" />}
      <View style={styles.row}><Pressable accessibilityRole="button" disabled={saving} onPress={pickLogo} style={styles.secondary}><Text>Choose PNG/JPEG logo</Text></Pressable><Pressable accessibilityRole="button" disabled={saving || !settings.logoDataUrl} onPress={() => update('logoDataUrl', '')} style={styles.secondary}><Text>Remove logo</Text></Pressable></View>
      <FloatingTextInput label="Payslip accent color (#11786D)" value={settings.accentColor ?? '#11786D'} onChangeText={value => update('accentColor', value)} maxLength={7} editable={!saving} />
      <FloatingTextInput label="Payslip footer (optional)" value={settings.footer ?? ''} onChangeText={value => update('footer', value)} multiline maxLength={250} editable={!saving} />
      {toggleFields.map(([key, label, fallback]) => <View key={key} style={styles.row}><Text style={styles.flex}>{label}</Text><Switch accessibilityLabel={label} disabled={saving} value={typeof settings[key] === 'boolean' ? settings[key] as boolean : fallback} onValueChange={value => update(key, value)} /></View>)}
      <Pressable accessibilityRole="button" disabled={saving} onPress={saveTemplate} style={styles.button}><Text style={styles.white}>Save payslip settings</Text></Pressable>
      <Text style={styles.title}>Company payroll calendar</Text>
      <Text style={styles.caption}>Choose weekly offs and list holidays. Other dates require resolved attendance or approved leave in attendance mode.</Text>
      <View style={styles.row}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => <Pressable key={label} accessibilityRole="checkbox" accessibilityLabel={`${label} weekly off`} accessibilityState={{ checked: weekly.includes(index) }} disabled={saving} onPress={() => setWeekly(current => current.includes(index) ? current.filter(day => day !== index) : [...current, index])} style={[styles.secondary, weekly.includes(index) && styles.selected]}><Text>{label}</Text></Pressable>)}</View>
      <FloatingTextInput label="Holiday dates (YYYY-MM-DD, one per line)" value={holidays} onChangeText={setHolidays} multiline maxLength={10000} editable={!saving} />
      <Pressable accessibilityRole="button" disabled={saving} onPress={saveCalendar} style={styles.button}><Text style={styles.white}>Save payroll calendar</Text></Pressable>
      <Text style={styles.title}>Payroll calculation policy</Text>
      <SelectField label="Calculation mode" value={mode} options={[{ value: 'FIXED', label: 'Fixed monthly salary' }, { value: 'ATTENDANCE_BASED', label: 'Attendance based' }]} onChange={setMode} disabled={saving} />
      <FloatingTextInput label="Policy effective from (YYYY-MM-01)" value={effective} onChangeText={setEffective} maxLength={10} editable={!saving} />
      <Text style={styles.caption}>Calendar-day proration applies to joining, exit, and salary revisions. Half days deduct 0.5 day; approved unpaid leave and absences deduct a day. Missing records block attendance payroll. Policies cannot rewrite calculated periods.</Text>
      <Pressable accessibilityRole="button" disabled={saving} onPress={createPolicy} style={styles.button}><Text style={styles.white}>Create payroll policy</Text></Pressable>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({ card: { padding: 18, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#DCE5E9', gap: 16 }, toggle: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center', gap: 12 }, section: { gap: 16 }, title: { fontSize: 16, color: '#17263F', fontWeight: '700', flexShrink: 1 }, caption: { color: '#607086', lineHeight: 20 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, flex: { flex: 1 }, button: { backgroundColor: '#11786D', padding: 13, borderRadius: 8, alignItems: 'center' }, white: { color: 'white', fontWeight: '700' }, secondary: { padding: 10, borderRadius: 8, backgroundColor: '#F1F5F9', minHeight: 44, justifyContent: 'center' }, selected: { backgroundColor: '#D7EEE8', borderWidth: 1, borderColor: '#11786D' }, error: { color: '#B42318' } });
