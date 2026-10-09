import React, { useRef, useState } from 'react';
import { addEmployee, type EmployeeProfile } from '../../../src/core/employees';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
};

function Field({ label, value, onChangeText, hint, error, keyboardType = 'default' }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : undefined]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </View>
  );
}

export default function CreateEmployee() {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile>({
    fullName: '', email: '', phone: '', jobTitle: '', department: '',
    branch: '', reportingManager: '', joiningDate: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeProfile, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const update = (key: keyof EmployeeProfile) => (value: string) => {
    setProfile(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
    setSaveError('');
  };
  const back = () => {
    if (savingRef.current) return;
    if (router.canGoBack()) router.back();
    else router.replace('/admin/dashboard');
  };
  const continueProfile = async () => {
    if (savingRef.current) return;
    const nextErrors: Partial<Record<keyof EmployeeProfile, string>> = {};
    if (!profile.fullName.trim()) nextErrors.fullName = 'Enter the employee’s full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) nextErrors.email = 'Enter a valid work email.';
    if (!profile.reportingManager.trim()) nextErrors.reportingManager = 'Enter the reporting manager.';
    const match = /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(profile.joiningDate.trim());
    if (!match) {
      nextErrors.joiningDate = 'Enter a valid date as DD/MM/YYYY or DD-MM-YYYY.';
    } else {
      const day = Number(match[1]);
      const month = Number(match[3]);
      const year = Number(match[4]);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        nextErrors.joiningDate = 'Enter a valid joining date.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const employee = await addEmployee({
        ...profile,
        joiningDate: profile.joiningDate.trim().replace(/-/g, '/'),
      });
      router.replace({ pathname: '/admin/employees', params: { added: employee.id } });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the employee. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.between}>
              <View style={styles.flex}>
                <Text style={styles.companyName}>{/* Company name */}</Text>
                <Text style={styles.headerCaption}>Business workspace</Text>
              </View>
              <View style={styles.search}><Text style={styles.searchGlyph}>⌕</Text></View>
              <View style={styles.avatar}>{/* Profile initial */}</View>
            </View>
            <View style={styles.filters}>
              <View style={styles.filter}><Text style={styles.filterLabel}>Company</Text>{/* Selected company */}<Text style={styles.chevron}>⌄</Text></View>
              <View style={[styles.filter, styles.branchFilter]}><Text style={styles.filterLabel}>Branch</Text>{/* Selected branch */}<Text style={styles.chevron}>⌄</Text></View>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Pressable accessibilityRole="button" onPress={back} style={styles.backButton}>
              <Text style={styles.backChevron}>‹</Text><Text style={styles.backText}>Back</Text>
            </Pressable>
            <Text style={styles.title}>Add employee</Text>
            <Text style={styles.subtitle}>Enter employee details to add them to your team.</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Who is joining your team?</Text>
              <Field label="Full name *" value={profile.fullName} onChangeText={update('fullName')} error={errors.fullName} />
              <Field label="Work email *" value={profile.email} onChangeText={update('email')} keyboardType="email-address" hint="Used for employee sign-in." error={errors.email} />
              <Field label="Phone (optional)" value={profile.phone} onChangeText={update('phone')} keyboardType="phone-pad" />
              <Field label="Job title (optional)" value={profile.jobTitle} onChangeText={update('jobTitle')} />
              {/* No department, branch or manager records are preloaded. */}
              <Field label="Department" value={profile.department} onChangeText={update('department')} />
              <Field label="Branch" value={profile.branch} onChangeText={update('branch')} />
              <Field label="Reporting manager *" value={profile.reportingManager} onChangeText={update('reportingManager')} error={errors.reportingManager} />
              <Field label="Joining date *" value={profile.joiningDate} onChangeText={update('joiningDate')} hint="DD/MM/YYYY or DD-MM-YYYY" error={errors.joiningDate} />
            </View>
          </ScrollView>

          {saveError !== '' && <Text accessibilityLiveRegion="polite" style={styles.saveError}>{saveError}</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={back} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={continueProfile} style={({ pressed }) => [styles.continueButton, (pressed || saving) && styles.pressed]}><Text style={styles.continueText}>{saving ? 'Adding…' : 'Continue'}</Text></Pressable>
          </View>
          <View style={styles.navigation}>
            {([{ label: 'Home', icon: '⌂' }, { label: 'CRM', icon: '↗' }, { label: 'People', icon: '♧' }, { label: 'Payroll', icon: '▤' }, { label: 'More', icon: '···' }] as const).map(tab => (
              <Pressable
                key={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab.label === 'People' }}
                disabled={saving}
                onPress={tab.label === 'Home' ? () => router.replace('/admin/dashboard') : tab.label === 'People' ? () => router.replace('/admin/employees') : undefined}
                style={styles.navItem}
              >
                <View style={[styles.navIcon, tab.label === 'People' && styles.selectedNav]}><Text style={[styles.navGlyph, tab.label === 'People' && styles.selectedText]}>{tab.icon}</Text></View>
                <Text style={[styles.navLabel, tab.label === 'People' && styles.selectedText]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' },
  flex: { flex: 1 },
  page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e4eaf5', backgroundColor: '#fff' },
  companyName: { minHeight: 18, fontSize: 14, fontWeight: '800', color: '#20334f' },
  headerCaption: { fontSize: 9, color: '#8794aa', marginTop: 4 },
  search: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' },
  searchGlyph: { fontSize: 26, color: '#304560' },
  avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 14 },
  filter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#f7f9ff', borderWidth: 1, borderColor: '#e4eaf7' },
  branchFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  filterLabel: { fontSize: 9, color: '#8492a9' },
  chevron: { fontSize: 17, color: '#8d9bb2' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 38, marginBottom: 6 },
  backChevron: { fontSize: 23, color: '#657995' },
  backText: { fontSize: 12, color: '#657995' },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.7, color: '#20334f' },
  subtitle: { fontSize: 12, lineHeight: 19, color: '#7a8ba5', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', padding: 18, marginTop: 22 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#20334f', marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#405573', marginBottom: 8 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: '#fcfdff', fontSize: 14, color: '#20334f' },
  inputError: { borderColor: '#cc6574' },
  hint: { fontSize: 10, color: '#8192ad', marginTop: 6, lineHeight: 15 },
  error: { fontSize: 11, color: '#b94d61', marginTop: 6 },
  saveError: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 12, color: '#b94d61', backgroundColor: '#fff' },
  actions: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5' },
  cancelButton: { flex: 1, minHeight: 44, backgroundColor: '#f1f4fa', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 12, fontWeight: '700', color: '#405573' },
  continueButton: { flex: 1.15, minHeight: 44, backgroundColor: '#345cf2', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  pressed: { opacity: 0.85 },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5', paddingTop: 8, paddingBottom: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navIcon: { minWidth: 46, height: 32, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  selectedNav: { backgroundColor: '#eaf0ff' },
  navGlyph: { fontSize: 22, color: '#71829c' },
  navLabel: { fontSize: 9, color: '#71829c' },
  selectedText: { color: '#345cf2' },
});
