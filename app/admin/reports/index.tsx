import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEmployees, type Employee } from '../../../src/core/employees';

const reportNames = ['Payroll summary', 'Employee directory', 'Attendance summary', 'Leave requests'] as const;
type ReportName = typeof reportNames[number];
type Payroll = { employeeId: string; period: string; gross: number; deductions: number; branch?: string; employeeName?: string };
type Shift = { employeeId: string; date: string; checkIn: string; checkOut: string; branch?: string; needsReview?: boolean };
type Request = { employeeId?: string; employeeName?: string; branch?: string; type: string; startDate: string; endDate: string; status: string; reason: string };
const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).slice(0, 7);
const periodLabel = (value: string) => value ? new Date(`${value}-01T12:00:00+05:30`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }) : 'All periods';
const joiningDate = (employee: Employee) => {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(employee.joiningDate);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : employee.joiningDate;
};
const htmlEscape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const csvCell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;

export default function BranchReportsPage() {
  const { styles, contentWidth } = useAdminLayout(baseStyles, 'page');
  const router = useRouter();
  const params = useLocalSearchParams<{ branch?: string }>();
  const [branch, setBranch] = useState(typeof params.branch === 'string' ? params.branch : '');
  const [report, setReport] = useState<ReportName>('Payroll summary');
  const [period, setPeriod] = useState(currentMonth);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [picker, setPicker] = useState<'report' | 'branch' | 'period' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const exportRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([getEmployees(), ...['branchsuite:payroll:v1', 'branchsuite:team-attendance:v1', 'branchsuite:my-attendance-requests:v1'].map(key => AsyncStorage.getItem(key))]).then(([team, ...stored]) => {
      const [pay, attendance, leave] = stored.map(value => value === null ? [] : JSON.parse(value as string));
      if (!Array.isArray(pay) || !pay.every(item => item && typeof item.employeeId === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(item.period) && Number.isFinite(item.gross) && Number.isFinite(item.deductions))) throw new Error('Payroll records could not be read.');
      if (!Array.isArray(attendance) || !attendance.every(item => item && ['employeeId', 'date', 'checkIn', 'checkOut'].every(key => typeof item[key] === 'string'))) throw new Error('Attendance records could not be read.');
      if (!Array.isArray(leave) || !leave.every(item => item && ['type', 'startDate', 'endDate', 'status', 'reason'].every(key => typeof item[key] === 'string'))) throw new Error('Requests could not be read.');
      if (active) { setEmployees(team as Employee[]); setPayroll(pay); setShifts(attendance); setRequests(leave); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));

  const employeeFor = (id?: string) => employees.find(employee => employee.id === id);
  const branchFor = (record: { branch?: string; employeeId?: string }) => record.branch || employeeFor(record.employeeId)?.branch || '';
  const nameFor = (record: { employeeId?: string; employeeName?: string }) => record.employeeName || employeeFor(record.employeeId)?.fullName || (record.employeeId ? 'Unknown employee' : 'Personal request');
  const branches = [...new Set([...employees.map(employee => employee.branch), ...payroll.map(branchFor), ...shifts.map(branchFor), ...requests.map(branchFor)].filter(Boolean))].sort();
  const months = new Set([currentMonth(), ...payroll.map(item => item.period), ...shifts.map(item => item.date.slice(0, 7)), ...requests.map(item => item.startDate.slice(0, 7)), ...employees.map(item => joiningDate(item).slice(0, 7))]);
  const base = new Date(`${currentMonth()}-01T12:00:00+05:30`);
  for (let index = 0; index < 12; index++) { const month = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - index, 1)); months.add(`${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`); }
  const periods = [...months].filter(value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)).sort().reverse();
  const matchesBranch = (record: { branch?: string; employeeId?: string }) => !branch || branchFor(record) === branch;
  let headers: string[];
  let rows: string[][];
  if (report === 'Payroll summary') {
    headers = ['Employee ID', 'Name', 'Branch', 'Gross INR', 'Deductions INR', 'Net INR', 'Period'];
    rows = payroll.filter(item => matchesBranch(item) && (!period || item.period === period)).map(item => [item.employeeId, nameFor(item), branchFor(item), item.gross.toFixed(2), item.deductions.toFixed(2), (item.gross - item.deductions).toFixed(2), periodLabel(item.period)]);
  } else if (report === 'Employee directory') {
    headers = ['Employee ID', 'Name', 'Branch', 'Department', 'Work email', 'Joining date', 'Status'];
    rows = employees.filter(item => (!branch || item.branch === branch) && (!period || joiningDate(item).slice(0, 7) === period)).map(item => [item.id, item.fullName, item.branch, item.department, item.email, item.joiningDate, item.status === 'inactive' ? 'Inactive' : 'Active']);
  } else if (report === 'Attendance summary') {
    headers = ['Employee ID', 'Name', 'Branch', 'Date', 'Check in', 'Check out', 'Status'];
    rows = shifts.filter(item => matchesBranch(item) && (!period || item.date.slice(0, 7) === period)).map(item => [item.employeeId, nameFor(item), branchFor(item), item.date, item.checkIn || '—', item.checkOut || '—', item.needsReview ? 'Needs review' : item.checkIn ? 'Present' : 'Not checked in']);
  } else {
    headers = ['Employee ID', 'Name', 'Branch', 'Start date', 'End date', 'Status', 'Reason'];
    const monthStart = period ? `${period}-01` : '';
    const monthEnd = period ? `${period}-${String(new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate())}` : '';
    rows = requests.filter(item => item.type === 'leave' && matchesBranch(item) && (!period || (item.startDate <= monthEnd && item.endDate >= monthStart))).map(item => [item.employeeId || '—', nameFor(item), branchFor(item), item.startDate, item.endDate, item.status, item.reason]);
  }
  const options = picker === 'report' ? reportNames.map(value => ({ value, label: value })) : picker === 'branch' ? ['', ...branches].map(value => ({ value, label: value || 'All branches' })) : ['', ...periods].map(value => ({ value, label: periodLabel(value) }));

  const exportReport = async (format: 'csv' | 'pdf') => {
    if (loading || error || !rows.length || exportRef.current) return;
    exportRef.current = true; setExporting(true); setExportError(''); setNotice('');
    const filename = `${report.toLowerCase().replaceAll(' ', '-')}-${period || 'all-periods'}-${Date.now()}`;
    try {
      const title = `${report} · ${branch || 'All branches'} · ${periodLabel(period)}`;
      const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(report)}</title><style>body{font:12px Arial;color:#20334f}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dce5f3;padding:8px;text-align:left;word-break:break-word}th{background:#f2f5fc}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:15mm}</style></head><body><h1>${htmlEscape(title)}</h1><p>${rows.length} records</p><table><thead><tr>${headers.map(value => `<th>${htmlEscape(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${htmlEscape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
      if (Platform.OS === 'web') {
        if (format === 'csv') {
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          const link = document.createElement('a'); link.href = url; link.download = `${filename}.csv`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          setNotice('CSV download started.');
        } else {
          const printWindow = window.open('', '_blank');
          if (!printWindow) throw new Error('Allow pop-ups to open the PDF print preview.');
          printWindow.document.write(html); printWindow.document.close(); printWindow.focus(); printWindow.print();
          setNotice('Choose Save as PDF in the print dialog.');
        }
      } else {
        const Sharing = await import('expo-sharing');
        if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
        let uri: string;
        if (format === 'csv') { const { File, Paths } = await import('expo-file-system'); const file = new File(Paths.cache, `${filename}.csv`); file.create(); file.write(csv); uri = file.uri; }
        else { const Print = await import('expo-print'); const file = await Print.printToFileAsync({ html }); uri = file.uri; }
        await Sharing.shareAsync(uri, { mimeType: format === 'csv' ? 'text/csv' : 'application/pdf', UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'com.adobe.pdf', dialogTitle: `Save ${report}` });
        setNotice('Export ready. Choose where to save or share it.');
      }
    } catch (reason) { setExportError(reason instanceof Error ? reason.message : 'Could not export the report. Please try again.'); }
    finally { exportRef.current = false; setExporting(false); }
  };

  const field = (label: string, value: string, kind: 'report' | 'branch' | 'period') => <View style={[styles.field, styles.filterField]}><Text style={styles.label}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`} onPress={() => setPicker(kind)} style={styles.select}><Text numberOfLines={1} style={styles.inputText}>{value}</Text><Text style={styles.chevron}>⌄</Text></Pressable></View>;
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    <View style={styles.header}><View style={[styles.row, styles.headerIdentity]}><View style={styles.flex}><Text style={styles.companyName}>{/* Your company name */}</Text><Text style={styles.small}>Business workspace</Text></View><View style={styles.headerIcon}><Text style={styles.chevron}>⌕</Text></View><View style={styles.avatar} /></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.small}>Company</Text><Text style={styles.chevron}>⌄</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Header branch" onPress={() => setPicker('branch')} style={[styles.headerFilter, styles.blue]}><Text numberOfLines={1} style={[styles.small, styles.flex]}>{branch || 'All branches'}</Text><Text style={styles.chevron}>⌄</Text></Pressable></View></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>Branch reports</Text><Text style={styles.subtitle}>Clear previews and scoped exports.</Text>
      <View style={styles.branchCard}><View style={styles.dot} /><View style={styles.flex}><Text style={styles.name}>{branch || 'All branches'}</Text><Text style={styles.small}>One branch, every module</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Change branch" onPress={() => setPicker('branch')} style={styles.change}><Text style={styles.link}>Change</Text></Pressable></View>
      <View style={styles.card}><View style={styles.filterGrid}>{field('Report', report, 'report')}{field('Branch', branch || 'All branches', 'branch')}{field('Period', periodLabel(period), 'period')}</View>{report === 'Employee directory' && <Text style={styles.small}>Period filters employees by joining date.</Text>}<View style={styles.exportButtons}>{(['csv', 'pdf'] as const).map(format => <Pressable key={format} accessibilityRole="button" accessibilityLabel={`Save ${format.toUpperCase()}`} accessibilityState={{ disabled: loading || !!error || !rows.length || exporting, busy: exporting }} disabled={loading || !!error || !rows.length || exporting} onPress={() => void exportReport(format)} style={[styles.exportButton, format === 'pdf' && styles.blue, (loading || !!error || !rows.length || exporting) && styles.dim]}><Text style={format === 'pdf' ? styles.link : styles.buttonText}>{exporting ? 'Preparing…' : `Save ${format.toUpperCase()}`}</Text></Pressable>)}</View>{notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}{exportError !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{exportError}</Text>}</View>
      <View style={styles.scope}><Text style={styles.scopeText}>ⓘ  {branch || 'All branches'} · {periodLabel(period)}. Preview and exports use the same filters.</Text></View>
      <View style={styles.card}><View style={styles.row}><Text style={styles.reportTitle}>{report}</Text><View style={styles.recordBadge}><Text style={styles.small}>{loading || error ? '—' : rows.length} records</Text></View></View>{loading ? <ActivityIndicator accessibilityLabel="Loading reports" style={styles.loading} color="#345cf2" /> : error ? <View><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.change}><Text style={styles.link}>Retry</Text></Pressable></View> : <><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.table}><View><View style={styles.tableHeader}>{headers.map(header => <Text key={header} style={[styles.cell, { width: Math.max(128, Math.floor((contentWidth - 42) / headers.length)) }, styles.columnTitle]}>{header}</Text>)}</View>{rows.map((row, index) => <View key={index} style={styles.tableRow}>{row.map((value, column) => <Text key={column} style={[styles.cell, { width: Math.max(128, Math.floor((contentWidth - 42) / headers.length)) }]}>{value || '—'}</Text>)}</View>)}</View></ScrollView>{rows.length === 0 && <View style={styles.empty}><Text style={styles.name}>No records for this selection</Text><Text style={styles.subtitle}>Your saved records will appear here. Try another report, branch or period.</Text></View>}</>}</View>
    </ScrollView>
    <View style={styles.navigation}>{[{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }].map(tab => <Pressable key={tab.label} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: tab.label === 'More' }} onPress={tab.label === 'Home' ? () => router.replace('/admin/dashboard') : tab.label === 'People' ? () => router.replace('/admin/employees/people') : tab.label === 'CRM' ? () => router.push('/admin/crm') : tab.label === 'Payroll' ? () => router.push('/admin/payroll') : undefined} style={styles.navItem}><View style={[styles.navIcon, tab.label === 'More' && styles.blue]}><Text style={[styles.navGlyph, tab.label === 'More' && styles.link]}>{tab.icon}</Text></View><Text style={[styles.navLabel, tab.label === 'More' && styles.link]}>{tab.label}</Text></Pressable>)}</View>
  </View><Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.row}><Text style={styles.reportTitle}>Choose {picker}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close picker" onPress={() => setPicker(null)} style={styles.close}><Text style={styles.chevron}>×</Text></Pressable></View><ScrollView>{options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} onPress={() => { if (picker === 'report') setReport(option.value as ReportName); else if (picker === 'branch') setBranch(option.value); else setPeriod(option.value); setNotice(''); setExportError(''); setPicker(null); }} style={styles.option}><Text style={styles.inputText}>{option.label}</Text><Text style={styles.link}>{option.value === (picker === 'report' ? report : picker === 'branch' ? branch : period) ? '✓' : ''}</Text></Pressable>)}</ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }, flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 }, header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, companyName: { minHeight: 18, fontSize: 14, fontWeight: '800', color: '#20334f' }, small: { fontSize: 9, lineHeight: 16, color: '#8192ad' }, headerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fc' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff' }, chevron: { fontSize: 23, color: '#607591' }, blue: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, content: { padding: 16, paddingTop: 24, paddingBottom: 28 }, eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 2, color: '#8192ad' }, title: { fontSize: 25, fontWeight: '800', color: '#20334f', marginTop: 10, letterSpacing: -0.7 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#7a8ba5', marginTop: 5 }, branchCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 17, backgroundColor: '#fff', marginTop: 22 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#39b8a7' }, name: { fontSize: 12, fontWeight: '700', color: '#20334f' }, change: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }, link: { fontSize: 10, fontWeight: '600', color: '#345cf2' }, card: { padding: 18, borderWidth: 1, borderColor: '#e0e8f5', borderRadius: 18, backgroundColor: '#fff', marginTop: 16 }, field: { marginBottom: 24 }, label: { fontSize: 12, fontWeight: '600', color: '#405573', marginBottom: 8 }, select: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 13, backgroundColor: '#fcfdff', paddingHorizontal: 13 }, inputText: { flexShrink: 1, fontSize: 13, color: '#20334f' }, exportButtons: { flexDirection: 'row', gap: 10 }, exportButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#e1e8f4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, buttonText: { fontSize: 11, fontWeight: '600', color: '#405573' }, dim: { opacity: 0.5 }, notice: { marginTop: 12, fontSize: 12, color: '#34856c' }, error: { marginTop: 12, fontSize: 12, color: '#b94d61' }, scope: { marginTop: 14, borderRadius: 13, backgroundColor: '#eaf0ff', padding: 14 }, scopeText: { fontSize: 11, lineHeight: 18, color: '#526eaa' }, reportTitle: { fontSize: 15, fontWeight: '700', color: '#20334f', flexShrink: 1 }, recordBadge: { borderRadius: 6, backgroundColor: '#edf0f6', paddingHorizontal: 8, paddingVertical: 4 }, table: { marginTop: 14 }, tableHeader: { flexDirection: 'row', backgroundColor: '#f5f7fc', borderTopLeftRadius: 10, borderTopRightRadius: 10 }, tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#edf1f8' }, cell: { width: 110, padding: 10, fontSize: 10, lineHeight: 17, color: '#405573' }, columnTitle: { fontWeight: '700', fontSize: 9 }, empty: { paddingVertical: 24 }, loading: { marginVertical: 24 }, navigation: { flexDirection: 'row', paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, alignItems: 'center', gap: 3 }, navIcon: { width: 46, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, navGlyph: { fontSize: 22, color: '#71829c' }, navLabel: { fontSize: 9, color: '#71829c' }, overlay: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { padding: 22, width: '100%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', borderRadius: 20, backgroundColor: '#fff' }, close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
});
