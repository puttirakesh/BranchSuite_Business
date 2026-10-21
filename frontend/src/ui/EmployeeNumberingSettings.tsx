import { useToastState } from './useToastState';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { companiesApi, type CompanyDto } from '../core/admin/api';
import { FloatingTextInput } from './FloatingTextInput';
import { AppIcon } from './AppIcon';
import { colors } from '../shared/theme/colors';

export function EmployeeNumberingSettings({ company, disabled, onSaved }: { company: CompanyDto; disabled: boolean; onSaved: (company: CompanyDto) => void }) {
  const [prefix, setPrefix] = useState(company.employeeIdPrefix);
  const [digits, setDigits] = useState(company.employeeIdDigits);
  const [next, setNext] = useState(String(company.employeeIdNext));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useToastState('', 'error');
  const [notice, setNotice] = useToastState('', 'success');
  useEffect(() => {
    setPrefix(company.employeeIdPrefix); setDigits(company.employeeIdDigits); setNext(String(company.employeeIdNext));
  }, [company.id, company.employeeIdPrefix, company.employeeIdDigits, company.employeeIdNext]);
  const validPrefix = /^[A-Z][A-Z0-9]{0,11}$/.test(prefix);
  const number = Number(next);
  const locked = disabled || saving;
  const save = async () => {
    if (locked) return;
    setError(''); setNotice('');
    if (!validPrefix) { setError('Prefix: 1–12 letters or numbers, starting with a letter.'); return; }
    if (!/^\d+$/.test(next) || !Number.isSafeInteger(number) || number < company.employeeIdNext || number >= 2000000000) {
      setError(`Next number must be at least ${company.employeeIdNext} and below 2000000000.`); return;
    }
    setSaving(true);
    try {
      const updated = await companiesApi.updateEmployeeNumbering(company.id, { prefix, digits, nextNumber: number });
      onSaved(updated); setNotice('Employee numbering saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save employee numbering.'); }
    finally { setSaving(false); }
  };
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.title}>Employee numbering</Text>
    <Text style={s.hint}>Applies to new employees in {company.name}. Existing IDs stay unchanged.</Text>
    <FloatingTextInput validation={{ required: true, pattern: /^[A-Z][A-Z0-9]{0,11}$/, patternMessage: 'Start with a letter; use up to 12 uppercase letters or digits.' }} label="Prefix" accessibilityLabel="Employee ID prefix" value={prefix} onChangeText={value => { setPrefix(value.toUpperCase()); setNotice(''); }} autoCapitalize="characters" autoCorrect={false} maxLength={12} editable={!locked} />
    <Pressable accessibilityRole="button" accessibilityLabel="Employee ID number length" accessibilityState={{ expanded: open, disabled: locked }} disabled={locked} onPress={() => setOpen(!open)} style={s.select}>
      <Text style={s.text}>Number length: {digits} {digits === 1 ? 'digit' : 'digits'}</Text><AppIcon name="chevron-down" size={16} color="#607591" />
    </Pressable>
    {open && <View style={s.options}>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} digits`} accessibilityState={{ selected: digits === value }} disabled={locked} onPress={() => { setDigits(value); setOpen(false); setNotice(''); }} style={s.select}><Text style={s.text}>{String(1).padStart(value, '0')}</Text>{digits === value && <AppIcon name="check" size={16} color={colors.primary} />}</Pressable>)}</View>}
    <FloatingTextInput validation={{ required: true, min: company.employeeIdNext, max: 1999999999 }} label="Next number" accessibilityLabel="Next employee number" value={next} onChangeText={value => { setNext(value.replace(/\D/g, '')); setNotice(''); }} keyboardType="number-pad" maxLength={10} editable={!locked} />
    <Text style={s.preview}>Preview: {validPrefix && Number.isSafeInteger(number) && number > 0 ? `${prefix}-${String(number).padStart(digits, '0')}` : '—'}</Text>
    <Text style={s.hint}>The sequence can move forward only. Used numbers are never reused; existing codes are skipped automatically.</Text>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.hint}>{notice}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Save employee numbering" accessibilityState={{ disabled: locked, busy: saving }} disabled={locked} onPress={() => void save()} style={[s.button, locked && s.dim]}>{saving && <ActivityIndicator size="small" color="#fff" />}<Text style={s.buttonText}>{saving ? 'Saving…' : 'Save employee numbering'}</Text></Pressable>
  </View>;
}

const s = StyleSheet.create({
  card: { padding: 18, gap: 14, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, backgroundColor: '#fff' },
  title: { fontSize: 15, fontWeight: '700', color: '#20334f' },
  hint: { fontSize: 12, lineHeight: 18, color: '#607591' },
  text: { fontSize: 13, color: '#20334f', flexShrink: 1 },
  select: { minHeight: 48, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10 },
  options: { gap: 4 }, preview: { fontSize: 14, fontWeight: '600', color: colors.primary },
  error: { fontSize: 12, lineHeight: 18, color: '#b94d61' },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, padding: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontSize: 13, fontWeight: '600', color: '#fff' }, dim: { opacity: 0.5 },
});
