import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SalaryComponentInput, SalaryComponentKind } from '../core/payroll-structure';
import { FloatingTextInput as TextInput } from './FloatingTextInput';

type Props = {
  basicAmount: string;
  onBasicAmountChange: (value: string) => void;
  components: SalaryComponentInput[];
  onComponentsChange: (components: SalaryComponentInput[]) => void;
  disabled?: boolean;
  currencyLabel?: string;
};

export function SalaryStructureEditor({
  basicAmount,
  onBasicAmountChange,
  components,
  onComponentsChange,
  disabled = false,
  currencyLabel = 'INR',
}: Props) {
  const update = (index: number, patch: Partial<SalaryComponentInput>) => {
    onComponentsChange(components.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  const add = (kind: SalaryComponentKind) => {
    onComponentsChange([...components, { name: '', kind, amount: '' }]);
  };
  const remove = (index: number) => onComponentsChange(components.filter((_, itemIndex) => itemIndex !== index));
  const section = (kind: SalaryComponentKind) => components
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === kind);

  const renderComponent = ({ item, index }: { item: SalaryComponentInput; index: number }) => (
    <View key={`${item.kind}-${index}`} style={styles.row}>
      <TextInput
        label={`${item.kind === 'EARNING' ? 'Earning' : 'Deduction'} name`}
        accessibilityLabel={`${item.kind === 'EARNING' ? 'Earning' : 'Deduction'} name ${index + 1}`}
        value={item.name}
        onChangeText={name => update(index, { name })}
        editable={!disabled}
        maxLength={100}
        validation={{ kind: 'name', maxLength: 100 }}
        style={[styles.input, styles.nameInput]}
      />
      <TextInput
        label={`${item.name || (item.kind === 'EARNING' ? 'Earning' : 'Deduction')} amount`}
        accessibilityLabel={`${item.name || (item.kind === 'EARNING' ? 'Earning' : 'Deduction')} amount`}
        value={item.amount}
        onChangeText={amount => update(index, { amount })}
        editable={!disabled}
        keyboardType="decimal-pad"
        validation={{ kind: 'decimal', fractionDigits: 2, maxLength: 15 }}
        style={[styles.input, styles.amountInput]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name || (item.kind === 'EARNING' ? 'earning' : 'deduction')}`}
        disabled={disabled}
        onPress={() => remove(index)}
        style={styles.remove}
      >
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Monthly salary structure</Text>
      <Text style={styles.caption}>Enter fixed monthly amounts. Gross earnings and take-home pay update from these line items.</Text>
      <Text style={styles.label}>Basic salary ({currencyLabel})</Text>
      <TextInput
        label={`Basic salary (${currencyLabel})`}
        accessibilityLabel="Basic salary amount"
        value={basicAmount}
        onChangeText={onBasicAmountChange}
        editable={!disabled}
        keyboardType="decimal-pad"
        validation={{ kind: 'decimal', fractionDigits: 2, maxLength: 15 }}
        style={styles.input}
      />

      <Text style={styles.label}>Earnings</Text>
      {section('EARNING').map(renderComponent)}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => add('EARNING')} style={styles.addButton}>
        <Text style={styles.addText}>+ Add earning</Text>
      </Pressable>

      <Text style={styles.label}>Deductions</Text>
      {section('DEDUCTION').map(renderComponent)}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => add('DEDUCTION')} style={styles.addButton}>
        <Text style={styles.addText}>+ Add deduction</Text>
      </Pressable>
      <Text style={styles.note}>PF, ESI, professional tax, TDS, and other deductions are entered as fixed amounts; automatic statutory calculations are not enabled.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 8 },
  sectionTitle: { color: '#20334f', fontSize: 16, fontWeight: '700' },
  caption: { color: '#71819a', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  label: { color: '#405573', fontSize: 12, fontWeight: '600', marginTop: 8 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  input: { minHeight: 44, borderColor: '#dce5f3', borderRadius: 10, borderWidth: 1, backgroundColor: '#fff', color: '#20334f', fontSize: 14, paddingHorizontal: 11 },
  nameInput: { flex: 1, minWidth: 0 },
  amountInput: { width: 110, textAlign: 'right' },
  remove: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 3 },
  removeText: { color: '#a43e45', fontSize: 11, fontWeight: '600' },
  addButton: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  addText: { color: '#345cf2', fontSize: 12, fontWeight: '700' },
  note: { color: '#8a6a32', fontSize: 11, lineHeight: 17, marginTop: 6 },
});
