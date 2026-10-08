import WorkspaceIcon from './WorkspaceIcon';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { employeeStepFields, employeeSteps } from './employeeFlow';
import { label, resources } from './resources';

interface Props {
  step: number; values: Record<string, string>; errors: Record<string, string>;
  onChange: (key: string, value: string) => void; onContinue: () => void; onSave: () => void;
  onCancel: () => void; onBack: () => void; onHome: () => void; onPeople: () => void;
  branchName?: string; companyName?: string; onAccount?: () => void; onPayroll?: () => void;
  editing?: boolean; saving?: boolean; error?: string;
}
const departments = ['Operations', 'Human Resources', 'Engineering', 'Sales', 'Finance', 'Marketing', 'Support'];

export default function EmployeeOnboarding(props: Props) {
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [props.step]);
  const fields = resources.employees.fields;
  const currentFields = employeeStepFields(fields, props.step);
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.phone}>
      <View style={s.header}><View style={s.headerTop}><View style={{ flex: 1, gap: 5 }}><Text style={s.company}>{props.companyName || 'BranchSuite'}</Text><Text style={s.headerCaption}>Business workspace</Text></View><View style={s.avatar}><Text style={s.initials}>BS</Text></View></View>
        {!!props.branchName && <View style={s.scopeRow}><Pressable disabled={!props.onAccount || props.saving} onPress={props.onAccount} accessibilityRole="button" accessibilityLabel="Account and selected company" style={s.scope}><Text style={s.scopeLabel}>Company</Text><Text style={s.scopeValue} numberOfLines={1}>{props.companyName || 'Your company'}</Text></Pressable><View style={[s.scope, s.branch]}><Text style={s.scopeLabel}>Branch</Text><Text style={s.scopeValue} numberOfLines={1}>{props.branchName}</Text></View></View>}
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Pressable accessibilityRole="button" disabled={props.saving} onPress={props.step > 0 ? props.onBack : props.onCancel} style={s.back}><Text style={s.backText}>‹  Back</Text></Pressable>
        <View style={{ gap: 8 }}><Text style={s.title}>{props.editing ? 'Edit employee' : 'Add employee'}</Text><Text style={s.subtitle}>Three short steps. One connected employee record.</Text></View>
        <View style={s.stepper} accessibilityLabel={`Step ${props.step + 1} of 3: ${employeeSteps[props.step].title}`}>
          {employeeSteps.map((step, index) => <View key={step.title} style={s.step}><View style={[s.stepNumber, index <= props.step && s.stepActive]}><Text style={[s.stepDigit, index <= props.step && { color: '#FFFFFF' }]}>{index < props.step ? '✓' : index + 1}</Text></View><Text style={[s.stepLabel, index === props.step && { color: '#315BF3' }]}>{step.title}</Text></View>)}
        </View>
        <View style={s.card}><Text style={s.cardTitle}>{employeeSteps[props.step].heading}</Text>
          {props.step < 2 ? currentFields.map(field => {
            const fieldLabel = field.key === 'email' ? 'Work email' : field.key === 'phone' ? 'Phone (optional)' : field.key === 'startDate' ? 'Joining date' : field.label;
            const value = props.values[field.key] ?? '';
            return <View key={field.key} style={s.field}>
              <Text style={s.fieldLabel}>{fieldLabel}{field.required ? ' *' : ''}</Text>
              {field.options ? <View style={s.choices}>{field.options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: value === option, disabled: props.saving }} disabled={props.saving} onPress={() => props.onChange(field.key, option)} style={[s.choice, value === option && s.choiceSelected]}><Text style={[s.choiceText, value === option && { color: '#315BF3' }]}>{label(option)}</Text></Pressable>)}</View>
                : field.key === 'department' ? <View style={s.departmentInput}><TextInput accessibilityLabel="Department" style={[s.input, { flex: 1, borderWidth: 0 }]} value={value} editable={!props.saving} maxLength={field.maxLength} onChangeText={next => props.onChange(field.key, next)} placeholder="Select or enter department" /><Pressable accessibilityRole="button" accessibilityLabel="Choose department" disabled={props.saving} onPress={() => setDepartmentOpen(true)} style={{ padding: 12 }}><Text style={s.backText}>⌄</Text></Pressable></View>
                : <TextInput accessibilityLabel={fieldLabel} style={s.input} value={value} editable={!props.saving} maxLength={field.maxLength}
                  onChangeText={next => props.onChange(field.key, next)} autoCorrect={field.kind !== 'email' && field.kind !== 'phone' && field.kind !== 'date'} autoCapitalize={field.kind === 'email' ? 'none' : 'sentences'}
                  keyboardType={field.kind === 'email' ? 'email-address' : field.kind === 'phone' ? 'phone-pad' : 'default'} placeholder={field.kind === 'date' ? 'YYYY-MM-DD' : undefined} />}
              {field.key === 'email' && <Text style={s.hint}>Used for employee contact.</Text>}
              {field.key === 'phone' && <Text style={s.hint}>Include the country code.</Text>}
              {!!props.errors[field.key] && <Text style={s.error} accessibilityLiveRegion="polite">{props.errors[field.key]}</Text>}
            </View>;
          }) : fields.map(field => <View style={s.review} key={field.key}><Text style={s.fieldLabel}>{field.key === 'startDate' ? 'Joining date' : field.label}</Text><Text style={s.reviewValue}>{props.values[field.key]?.trim() ? field.options ? label(props.values[field.key]) : props.values[field.key].trim() : '—'}</Text></View>)}
          {props.step > 0 && !!props.branchName && <View style={s.field}><Text style={s.fieldLabel}>Branch</Text><View style={[s.input, { justifyContent: 'center' }]}><Text style={s.reviewValue}>{props.branchName}</Text></View><Text style={s.hint}>This employee belongs to your selected branch.</Text></View>}
        </View>
        {!!props.error && <Text style={s.error} accessibilityLiveRegion="polite">{props.error}</Text>}
        <Text style={s.draftHint}>Your details stay here as you move between steps.</Text>
      </ScrollView>
      <View style={s.actions}><Pressable accessibilityRole="button" disabled={props.saving} onPress={props.onCancel} style={[s.cancel, props.saving && { opacity: 0.5 }]}><Text style={s.cancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: !!props.saving }} disabled={props.saving} onPress={props.step < 2 ? props.onContinue : props.onSave} style={[s.continue, props.saving && { opacity: 0.5 }]}><Text style={s.continueText}>{props.saving ? 'Saving…' : props.step < 2 ? 'Continue' : 'Save employee'}</Text></Pressable></View>
      <View style={s.bottom}>{[{ title: 'Home', onPress: props.onHome }, { title: 'CRM', onPress: undefined }, { title: 'People', onPress: props.onPeople }, { title: 'Payroll', onPress: props.onPayroll }, { title: 'More', onPress: props.onAccount }].map(item => <Pressable key={item.title} accessibilityRole="button" accessibilityState={{ selected: item.title === 'People', disabled: !!props.saving || !item.onPress }} disabled={props.saving || !item.onPress} onPress={item.onPress} style={[s.nav, item.title === 'People' && { backgroundColor: '#EDF2FF' }]}><WorkspaceIcon size={24} name={item.title} color={item.title === "People" ? "#315BF3" : !item.onPress ? "#B0BACA" : "#7A8CA6"} /><Text numberOfLines={1} style={[s.navText, item.title === 'People' && { color: '#315BF3' }, !item.onPress && { color: '#B0BACA' }]}>{item.title}</Text></Pressable>)}</View>
    </View>
    <Modal transparent visible={departmentOpen} animationType="fade" onRequestClose={() => setDepartmentOpen(false)}>
      <View style={s.modalOverlay}><View style={s.modalCard}><Text style={s.cardTitle}>Choose department</Text><ScrollView>{departments.map(department => <Pressable key={department} accessibilityRole="button" onPress={() => { props.onChange('department', department); setDepartmentOpen(false); }} style={s.departmentOption}><Text style={s.reviewValue}>{department}</Text></Pressable>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => setDepartmentOpen(false)} style={[s.cancel, { flex: 0 }]}><Text style={s.cancelText}>Close</Text></Pressable></View></View>
    </Modal>
  </KeyboardAvoidingView>;
}
export const employeePhoneStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EDF1F8', alignItems: 'center' }, phone: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#F6F8FC' },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5EBF5', padding: 16, gap: 14 }, headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 }, company: { color: '#243A55', fontSize: 16, fontWeight: '700' }, headerCaption: { color: '#8A9AAF', fontSize: 12 }, avatar: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#EDF2FF', alignItems: 'center', justifyContent: 'center' }, initials: { color: '#4C6EC3', fontSize: 14, fontWeight: '700' }, scopeRow: { flexDirection: 'row', gap: 8 }, scope: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5EBF6', backgroundColor: '#F8FAFF' }, branch: { backgroundColor: '#EBEFFF', borderColor: '#D9E2FF' }, scopeLabel: { color: '#8C9AAF', fontSize: 11 }, scopeValue: { flex: 1, color: '#354D6C', fontSize: 12, fontWeight: '600' },
  content: { padding: 16, paddingTop: 20, paddingBottom: 24, gap: 20 }, back: { alignSelf: 'flex-start', paddingVertical: 4 }, backText: { color: '#72849D', fontSize: 14 }, title: { color: '#223650', fontSize: 28, fontWeight: '700' }, subtitle: { color: '#73849D', fontSize: 14, lineHeight: 22 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5EBF5', borderRadius: 15, backgroundColor: '#FFFFFF', padding: 12, gap: 6 }, step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }, stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF0F8' }, stepActive: { backgroundColor: '#315BF3' }, stepDigit: { fontSize: 13, fontWeight: '700', color: '#6D819F' }, stepLabel: { fontSize: 11, fontWeight: '600', color: '#6D819F', flexShrink: 1 },
  card: { padding: 18, borderWidth: 1, borderColor: '#E5EBF5', borderRadius: 20, backgroundColor: '#FFFFFF', gap: 24 }, cardTitle: { color: '#253B57', fontSize: 19, fontWeight: '700', marginBottom: 4 }, field: { gap: 8 }, fieldLabel: { color: '#415572', fontSize: 14, fontWeight: '600' }, input: { minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#DDE5F3', backgroundColor: '#FCFDFF', color: '#354B69', fontSize: 16, paddingHorizontal: 13, paddingVertical: 12 }, hint: { color: '#8897AC', fontSize: 12, lineHeight: 19 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E9F5', backgroundColor: '#F9FBFE' }, choiceSelected: { borderColor: '#CCD9FF', backgroundColor: '#EDF2FF' }, choiceText: { color: '#70829C', fontSize: 14 }, departmentInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDE5F3', borderRadius: 13, backgroundColor: '#FCFDFF' }, review: { gap: 7, borderBottomWidth: 1, borderBottomColor: '#EFF3F8', paddingBottom: 12 }, reviewValue: { color: '#354B69', fontSize: 16, lineHeight: 24 }, error: { color: '#AC2929', fontSize: 14, lineHeight: 21 }, draftHint: { textAlign: 'center', color: '#8C9AAF', fontSize: 12, lineHeight: 20 },
  actions: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5EBF5', padding: 8, flexDirection: 'row', gap: 8 }, cancel: { flex: 0.7, backgroundColor: '#F3F6FB', borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#465D7B', fontWeight: '600', fontSize: 14 }, continue: { flex: 1, backgroundColor: '#315BF3', borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' }, continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }, bottom: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E8EDF6', flexDirection: 'row', gap: 4, padding: 6 }, nav: { flex: 1, gap: 4, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 15, alignItems: 'center' }, navText: { color: '#7A8CA6', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: '#162A4655', justifyContent: 'center', alignItems: 'center', padding: 20 }, modalCard: { width: '100%', maxWidth: 400, maxHeight: '80%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 15 }, departmentOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EDF1F7' },
});
const s = employeePhoneStyles;
