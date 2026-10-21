import { SearchField } from './SearchField';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import type { TextInput } from 'react-native';
import type { AccessRole, AccessUser } from '../core/admin/organisation';
import { FloatingTextInput } from './FloatingTextInput';
import { AppIcon } from './AppIcon';
import { BranchOptionsStatus } from './BranchOptionsStatus';
import { validateAccessUser, type AccessUserErrors } from './access-user-validation';

const roleDescriptions: Record<AccessRole, string> = {
  'Business Owner': 'Business ownership and full administration.',
  'Business Admin': 'Company administration and access management.',
  'Company Manager': 'CRM, people and reports for assigned branches.',
  'Sales Manager': 'CRM, sales pipeline and follow-ups for assigned branches.',
  'HR Manager': 'Employees, attendance and leave management.',
  'Payroll Officer': 'Salary inputs, payroll and payroll reports.',
  Employee: 'Personal attendance, leave, tasks and payslips.',
};

type Props = {
  draft: AccessUser;
  users: AccessUser[];
  roles: AccessRole[];
  branches: { id: string; name: string }[];
  branchesLoading: boolean;
  branchesError: string;
  refreshBranches: () => void;
  accessLocked: boolean;
  saving: boolean;
  error: string;
  onChange: (changes: Partial<AccessUser>) => void;
  onClose: () => void;
  onSave: (user: AccessUser) => Promise<void>;
  onManageBranches: () => void;
};

export function AccessUserDialog({ draft, users, roles, branches, branchesLoading, branchesError, refreshBranches, accessLocked, saving, error, onChange, onClose, onSave, onManageBranches }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 720 && fontScale <= 1.3;
  const editing = !!draft.id;
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof AccessUserErrors, boolean>>>({});
  const [branchQuery, setBranchQuery] = useState('');
  const [roleOpen, setRoleOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const nameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const branchY = useRef(0);
  const errors = validateAccessUser(draft, users, roles, branches.map(branch => branch.id));
  const fieldError = (field: keyof AccessUserErrors) => attempted || touched[field] ? errors[field] : undefined;
  const branchIds = [...new Set([...branches.map(branch => branch.id), ...draft.branches])];
  const shownBranches = branchIds.filter(id => (branches.find(branch => branch.id === id)?.name ?? 'Previously assigned branch').toLowerCase().includes(branchQuery.trim().toLowerCase()));
  const accessDisabled = saving || accessLocked || branchesLoading || !!branchesError;
  const blocked = saving || branchesLoading || !!branchesError || (!editing && !branches.length);
  const submit = () => {
    if (blocked) return;
    setAttempted(true);
    if (errors.name) { nameInput.current?.focus(); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    if (errors.email) { emailInput.current?.focus(); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    if (errors.role || errors.branches) { scroll.current?.scrollTo({ y: Math.max(0, branchY.current - 16), animated: true }); return; }
    Keyboard.dismiss();
    void onSave({ ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase(), branches: [...new Set(draft.branches)] });
  };
  const dismiss = () => { if (!saving) { Keyboard.dismiss(); onClose(); } };

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (!saving) { Keyboard.dismiss(); onClose(); } return true; });
    return () => listener.remove();
  }, [saving, onClose]);

  return <View style={s.safe}>
      <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={s.dialog}>
          <View style={[s.header, width < 480 && s.smallHeader]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to roles and access" disabled={saving} onPress={dismiss} style={({ pressed }) => [s.close, pressed && s.secondaryPressed, saving && s.dim]}><AppIcon name="arrow-left" size={20} color="#20334f" /></Pressable>
            <View style={s.flex}>
              <Text accessibilityRole="header" style={[s.title, width < 480 && s.smallTitle]}>{editing ? 'Edit user access' : 'Create user'}</Text>
            </View>
          </View>

          <ScrollView ref={scroll} style={s.scroll} contentContainerStyle={[s.body, width < 480 && s.smallBody]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.section}>
              <View style={[s.fields, wide && s.row]}>
                <View style={[s.field, wide && s.flex]}>
                  <FloatingTextInput validation={{ required: true }} ref={nameInput} label="Full name *" accessibilityLabel="Full name" value={draft.name} onChangeText={name => onChange({ name })} onBlur={() => setTouched(current => ({ ...current, name: true }))}
                    style={s.textInput} editable={!saving} invalid={!!fieldError('name')} aria-invalid={!!fieldError('name')} maxLength={150} autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailInput.current?.focus()} />
                  {!!fieldError('name') && <Text accessibilityRole="alert" style={s.fieldError}>{fieldError('name')}</Text>}
                </View>
                <View style={[s.field, wide && s.flex]}>
                  <FloatingTextInput validation={{ required: true }} ref={emailInput} label="Work email *" accessibilityLabel="Work email" value={draft.email} onChangeText={email => onChange({ email })} onBlur={() => { setTouched(current => ({ ...current, email: true })); onChange({ email: draft.email.trim().toLowerCase() }); }}
                    editable={!saving} invalid={!!fieldError('email')} aria-invalid={!!fieldError('email')} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
                  {!!fieldError('email') && <Text accessibilityRole="alert" style={s.fieldError}>{fieldError('email')}</Text>}
                </View>
              </View>
              {!editing && <View style={s.help}><AppIcon name="mail" size={16} color="#607591" /><Text style={[s.muted, s.flex]}>Set password using Forgot password after creation.</Text></View>}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Role *</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="User role" accessibilityState={{ expanded: roleOpen, disabled: saving }} disabled={saving} onPress={() => { setRoleOpen(!roleOpen); setBranchOpen(false); }} style={s.dropdown}><Text style={[s.optionTitle, s.flex]}>{draft.role}</Text><AppIcon name={roleOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#607591" /></Pressable>
              {roleOpen && <View style={s.options}>{roles.map(role => <Pressable key={role} accessibilityRole="button" accessibilityLabel={role} accessibilityState={{ selected: draft.role === role }} disabled={saving} onPress={() => { onChange({ role }); setRoleOpen(false); }} style={[s.dropdownOption, draft.role === role && s.selected]}><Text style={s.optionTitle}>{role}</Text><Text style={s.optionDescription}>{roleDescriptions[role]}</Text></Pressable>)}</View>}
              {!!fieldError('role') && <Text accessibilityRole="alert" style={s.fieldError}>{fieldError('role')}</Text>}
              {editing && users.find(user => user.id === draft.id)?.role !== draft.role && <Text style={s.muted}>Role changes apply across companies and require signing in again.</Text>}
            </View>

            <View style={s.section} onLayout={event => { branchY.current = event.nativeEvent.layout.y; }}>
              <View style={s.sectionHeading}><Text style={[s.sectionTitle, s.flex]}>Branch access{editing ? '' : ' *'}</Text><Text style={s.count}>{draft.branches.length} selected</Text></View>
              <BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={!branches.length} onRetry={refreshBranches} />
              {!branchesLoading && !branchesError && !branches.length && !editing && <Pressable accessibilityRole="button" onPress={onManageBranches} style={s.manageBranches}><Text style={s.link}>Manage branches</Text></Pressable>}
              <Pressable accessibilityRole="button" accessibilityLabel="Branch access" accessibilityState={{ expanded: branchOpen, disabled: accessDisabled }} disabled={accessDisabled} onPress={() => { setBranchOpen(!branchOpen); setRoleOpen(false); }} style={[s.dropdown, accessDisabled && s.dim]}><Text style={[s.optionTitle, s.flex]}>{draft.branches.length ? draft.branches.map(id => branches.find(branch => branch.id === id)?.name ?? 'Previously assigned branch').join(', ') : 'Select branches'}</Text><AppIcon name={branchOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#607591" /></Pressable>
              {branchOpen && <View style={s.options}>
              {branches.length > 5 && <SearchField accessibilityLabel="Find a branch" value={branchQuery} onChangeText={setBranchQuery} autoCorrect={false} editable={!saving} />}
              <View style={s.branchList}>{shownBranches.map(id => {
                const selected = draft.branches.includes(id);
                const branch = branches.find(branch => branch.id === id);
                const name = branch?.name ?? 'Previously assigned branch';
                return <Pressable key={id} accessibilityRole="checkbox" accessibilityLabel={`Branch access: ${name}`} accessibilityState={{ checked: selected, disabled: accessDisabled }} aria-checked={selected} disabled={accessDisabled}
                  onPress={() => { setTouched(current => ({ ...current, branches: true })); onChange({ branches: selected ? draft.branches.filter(value => value !== id) : [...draft.branches, id] }); setBranchOpen(false); }} style={[s.branch, selected && s.selected, accessDisabled && s.dim]}>
                  <Text style={[s.optionTitle, s.flex]}>{name}</Text>{selected && <AppIcon name="check" size={18} color="#345cf2" />}
                </Pressable>;
              })}</View>
              {!shownBranches.length && !!branchQuery && <Text style={s.muted}>No branches match your search.</Text>}
              </View>}
              {accessLocked && <Text style={s.muted}>Administrator branches and status are managed separately.</Text>}
              {!!fieldError('branches') && <Text accessibilityRole="alert" style={s.fieldError}>{fieldError('branches')}</Text>}
            </View>

            <View style={s.status}><View style={s.flex}><Text style={s.optionTitle}>Account active</Text></View><Switch accessibilityLabel="User active" disabled={saving || accessLocked} value={draft.active} onValueChange={active => onChange({ active })} trackColor={{ false: '#dce3ed', true: '#345cf2' }} thumbColor="#fff" /></View>
          </ScrollView>

          <View style={[s.footer, width < 480 && s.smallFooter]}>
            {!!error && <View style={s.errorBanner}><AppIcon name="alert-circle" size={17} color="#b94d61" /><Text accessibilityRole="alert" style={[s.fieldError, s.flex]}>{error}</Text></View>}
            <View style={s.footerButtons}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={dismiss} style={({ pressed }) => [s.cancel, wide && s.desktopCancel, pressed && !saving && s.secondaryPressed, saving && s.dim]}><Text style={s.cancelText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save user changes' : 'Create user account'} accessibilityState={{ disabled: blocked, busy: saving }} disabled={blocked} onPress={submit} style={({ pressed }) => [s.submit, wide && s.desktopSubmit, pressed && !blocked && s.primaryPressed, blocked && s.submitDisabled]}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <AppIcon name={editing ? 'check' : 'user-plus'} size={17} color="#fff" />}<Text style={s.submitText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
  </View>;
}

const s = StyleSheet.create({
  textInput: { fontSize: Platform.OS === 'web' ? 13 : 14 },
  smallHeader: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  smallTitle: { fontSize: 17, lineHeight: 23 },
  desktopCancel: { flex: 0, minWidth: 120 },
  desktopSubmit: { flex: 0, minWidth: 200 },
  primaryPressed: { backgroundColor: '#2948c5' },
  secondaryPressed: { backgroundColor: '#e4eaf3' },
  submitDisabled: { backgroundColor: '#83b5b0' },
  dropdown: { minHeight: 56, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  options: { borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10, padding: 8, gap: 6 },
  dropdownOption: { minHeight: 48, padding: 12, borderRadius: 8 },
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, overlay: { flex: 1, alignItems: 'center' },
  dialog: { width: '100%', maxWidth: 1000, flex: 1, borderRadius: 0, backgroundColor: '#fff', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e8edf5' },
  title: { fontSize: 18, lineHeight: 24, color: '#20334f', fontWeight: '700' }, muted: { color: '#607591', fontSize: 12, lineHeight: 19 }, close: { borderRadius: 12, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 }, scroll: { flex: 1, minHeight: 0 }, body: { padding: 24, gap: 20 }, smallBody: { padding: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap' },

  section: { gap: 10 }, sectionTitle: { color: '#20334f', fontSize: 13, lineHeight: 20, fontWeight: '700' }, fields: { gap: 16 }, field: { minWidth: 0 }, help: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
     selected: { backgroundColor: '#f3f6ff', borderColor: '#345cf2' },
  optionTitle: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#20334f' }, optionDescription: { fontSize: 12, lineHeight: 18, marginTop: 3, color: '#607591' },

  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, count: { fontSize: 12, color: '#345cf2', fontWeight: '600' },   link: { color: '#345cf2', fontSize: 12, fontWeight: '600' }, manageBranches: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  branchList: { gap: 8 }, branch: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 },
  status: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingTop: 18, borderTopWidth: 1, borderTopColor: '#e8edf5' }, fieldError: { fontSize: 12, lineHeight: 18, color: '#b94d61', marginTop: 5 }, errorBanner: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff2f4', borderRadius: 10 },
  footer: { borderTopWidth: 1, borderTopColor: '#e8edf5', padding: 20, gap: 12, backgroundColor: '#fff' }, smallFooter: { padding: 16 },  footerButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }, cancel: { flex: 1, minHeight: 48, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#e4eaf3', backgroundColor: '#f1f4f9', justifyContent: 'center', alignItems: 'center' }, cancelText: { fontSize: 13, fontWeight: '600', color: '#405573' }, submit: { flex: 1.5, minWidth: 0, minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#345cf2', flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }, submitText: { fontSize: 13, fontWeight: '600', color: '#fff' }, dim: { opacity: 0.5 },
});
