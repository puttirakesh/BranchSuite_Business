import { createElement } from 'react';
import { Platform, TextInput } from 'react-native';
import { employeePhoneStyles as s } from './EmployeeOnboarding';

export default function WorkforceDateInput({ label, value, onChange, time = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; time?: boolean; disabled?: boolean }) {
  if (Platform.OS === 'web') return createElement('input', {
    type: time ? 'time' : 'date', 'aria-label': label, value, disabled,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    style: { boxSizing: 'border-box', width: '100%', minHeight: 52, padding: '12px 13px', border: '1px solid #DDE5F3', borderRadius: 13, background: '#FCFDFF', color: '#354B69', fontFamily: 'inherit', fontSize: 16 },
  });
  return <TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChange} editable={!disabled} placeholder={time ? 'HH:mm' : 'YYYY-MM-DD'} autoCorrect={false} />;
}
