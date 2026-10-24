import React from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { type EmployeePayslip } from './payslips';
import { createPayslipDocument, pdfMoney, payslipPalette as colors, type Identity } from './payslip-pdf-content';

export function PayslipPreview({ payslip, identity }: { payslip: EmployeePayslip; identity: Identity }) {
  const document = createPayslipDocument(payslip, identity);
  const { width } = useWindowDimensions();
  const money = (amount: number) => pdfMoney(amount, payslip.currency);
  const table = (title: string, rows: { id: string; name: string; amount: number }[], totalLabel: string, total: number) => (
    <View style={[styles.table, width >= 640 && styles.wideTable]}>
      <View style={styles.tableHeader}>
        <Text accessibilityRole="header" style={styles.tableHeading}>{title}</Text>
        <Text style={styles.tableHeading}>Amount</Text>
      </View>
      {rows.length ? rows.map((item, index) => (
        <View key={item.id} style={[styles.row, index % 2 === 1 && styles.alternate]}>
          <Text style={styles.component}>{item.name}</Text>
          <Text selectable style={styles.amount}>{money(item.amount)}</Text>
        </View>
      )) : <View style={styles.row}><Text style={styles.component}>No deductions</Text><Text style={styles.amount}>{money(0)}</Text></View>}
      <View style={[styles.row, styles.total]}>
        <Text style={[styles.component, styles.bold]}>{totalLabel}</Text>
        <Text selectable style={[styles.amount, styles.bold]}>{money(total)}</Text>
      </View>
    </View>
  );

  return <View testID="employee-payslip-preview" style={styles.document}>
    <View style={[styles.header, { borderTopColor: document.palette.accent }]}>
      <View style={styles.company}>
        {!!document.logo && <Image accessibilityLabel="Company logo" source={{ uri: document.logo }} style={{ width: 60, height: 42 }} resizeMode="contain" />}
        <Text accessibilityRole="header" style={styles.companyName}>{document.company}</Text>
        <Text style={styles.muted}>Employee salary statement</Text>
        {!!document.address && <Text style={styles.muted}>{document.address}</Text>}
      </View>
      <View style={styles.period}>
        <Text style={[styles.eyebrow, { color: document.palette.accent }]}>PAYSLIP</Text>
        <Text style={styles.periodText}>{document.period}</Text>
      </View>
    </View>
    <View style={styles.metadata}>
      {document.metadata.map(([label, value]) => <View key={label} style={styles.field}>
        <Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text>
      </View>)}
    </View>
    <View style={[styles.tables, width >= 640 && styles.sideBySide]}>
      {table('Earnings', document.earnings, 'Gross earnings', payslip.grossAmount)}
      {table('Deductions', document.deductions, 'Total deductions', payslip.deductionsAmount)}
    </View>
    <View style={[styles.net, { borderLeftColor: document.palette.accent }]}>
      <Text style={styles.eyebrow}>NET TAKE-HOME PAY</Text>
      <Text selectable style={[styles.netAmount, { color: document.palette.accent }]}>{money(payslip.netAmount)}</Text>
      <Text style={styles.words}>{document.words}</Text>
    </View>
    <View style={styles.payment}>
      <Text accessibilityRole="header" style={styles.sectionHeading}>Payment details</Text>
      {document.payment.map(([label, value]) => <View key={label} style={styles.paymentRow}>
        <Text style={styles.paymentLabel}>{label}</Text><Text selectable style={styles.paymentValue}>{value}</Text>
      </View>)}
    </View>
    {!!document.legacyNote && <Text style={styles.muted}>{document.legacyNote}</Text>}
    {!!document.footer && <Text style={styles.muted}>{document.footer}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  document: { padding: 16, gap: 20, backgroundColor: '#FFFFFF' },
  header: { borderTopWidth: 4, borderTopColor: colors.accent, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  company: { flexGrow: 1, flexBasis: 210, gap: 6 },
  companyName: { color: colors.ink, fontSize: 21, lineHeight: 28, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  period: { gap: 6 },
  eyebrow: { color: colors.accent, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  periodText: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  field: { width: '50%', paddingRight: 12, gap: 5 },
  label: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  value: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  tables: { gap: 16 },
  sideBySide: { flexDirection: 'row', alignItems: 'flex-start' },
  table: { minWidth: 0, borderWidth: 1, borderColor: colors.border },
  wideTable: { flex: 1 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 10, backgroundColor: colors.ink },
  tableHeading: { color: '#FFFFFF', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  alternate: { backgroundColor: colors.light },
  component: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 12, lineHeight: 18 },
  amount: { maxWidth: '52%', flexShrink: 1, color: colors.ink, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  total: { backgroundColor: colors.light, borderBottomWidth: 0 },
  bold: { fontWeight: '700' },
  net: { backgroundColor: colors.pale, borderLeftWidth: 4, borderLeftColor: colors.accent, padding: 16, gap: 8 },
  netAmount: { color: colors.accent, fontSize: 26, lineHeight: 34, fontWeight: '700' },
  words: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  payment: { gap: 10 },
  sectionHeading: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  paymentLabel: { width: 120, color: colors.muted, fontSize: 12, lineHeight: 18 },
  paymentValue: { flexBasis: 140, flexGrow: 1, color: colors.ink, fontSize: 12, lineHeight: 18 },
});
