import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { SectionBranchSelect } from '../../../src/ui/SectionBranchSelect';
import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { SelectField } from '../../../src/ui/SelectField';
import { SearchField } from '../../../src/ui/SearchField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { AdminPageHeading, useWebSectionHeader } from '../../../src/ui/AdminPageHeading';
import { customersApi, type CustomerDto } from '../../../src/core/admin/api';
import { getAdminScope, selectAdminBranch, useAdminScope } from '../../../src/core/admin/scope';
import { getAvailableBranches } from '../../../src/core/admin/available-branches';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

const emptyForm = { name: '', email: '', phone: '', address: '', notes: '', branchId: '' };
const validPhone = (value: string) => {
  const clean = value.trim();
  return clean === '' || /^\d{10}$/.test(clean);
};

export default function CustomersPage() {
  const webHeader = useWebSectionHeader();
  const { styles, contentWidth, fontScale } = useAdminLayout(baseStyles);
  const twoColumns = contentWidth / fontScale >= 640;
  const router = useRouter();
  const selection = useAdminScope();
  const params = useLocalSearchParams<{ id?: string; branch?: string; create?: string }>();
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CustomerDto | null>(null);
  const [formOpen, setFormOpen] = useState(params.create === '1');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useToastState('', 'error');
  const [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    setCompanyId(''); setCustomers([]); setBranches([]);
    Promise.all([getAdminScope(), getAvailableBranches()]).then(async ([scope, choices]) => {
      const records = await customersApi.list(scope.companyId);
      if (!active) return;
      const chosen = scope.branchId ?? '';
      setCompanyId(scope.companyId); setBranches(choices); setCustomers(records); setFilterBranch(chosen);
      setForm(current => ({ ...current, branchId: chosen || choices[0]?.id || '' }));
      setEditing(null);
    }).catch(cause => { if (active) { setCustomers([]); setError(cause instanceof Error ? cause.message : 'Could not load customers.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selection?.companyId, selection?.branchId, params.branch, reload]));
  const begin = (customer?: CustomerDto) => {
    if (busyRef.current) return;
    setEditing(customer ?? null); setFormOpen(true); setError('');
    setForm(customer ? { name: customer.name, email: customer.email ?? '', phone: customer.phone ?? '', address: customer.address ?? '', notes: customer.notes ?? '', branchId: customer.branchId ?? '' }
      : { ...emptyForm, branchId: filterBranch || branches[0]?.id || '' });
  };
  const save = async () => {
    if (busyRef.current || loading) return;
    if (!companyId || !form.name.trim() || form.name.trim().length > 150 || (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) || !validPhone(form.phone) || (form.branchId && !branches.some(branch => branch.id === form.branchId))) {
      setError('Enter a customer name, a valid email and phone if supplied, and an available branch.'); return;
    }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const body = { name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null, branchId: form.branchId || null };
      if (editing) await customersApi.update(editing.id, body);
      else await customersApi.create({ companyId, ...body });
      toast.success(editing ? 'Customer updated successfully.' : 'Customer created successfully.');
      setFormOpen(false); setEditing(null); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save customer.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const toggleStatus = async (customer: CustomerDto) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await customersApi.setStatus(customer.id, customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'); toast.success('Customer status updated.'); setReload(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update customer.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const visible = customers.filter(customer => (!filterBranch || customer.branchId === filterBranch) && `${customer.name} ${customer.email ?? ''} ${customer.phone ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()) && (!params.id || params.id === customer.id));
  const changeFilterBranch = (branchId: string) => {
    setFilterBranch(branchId);
    void selectAdminBranch(branchId || null);
  };
  return <ScrollView style={styles.page} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <AdminPageHeading title="Customers" onBack={() => router.replace('/admin/crm')} branchControl={<SectionBranchSelect label="Filter customer branch" value={filterBranch} onChange={changeFilterBranch} options={[{ value: "", label: "All branches" }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} disabled={busy || loading} />} onRefresh={() => setReload(value => value + 1)} refreshing={loading} refreshDisabled={busy}><Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => begin()}><Text style={styles.buttonText}>Add customer</Text></Pressable></AdminPageHeading>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {loading ? <ActivityIndicator accessibilityLabel="Loading customers" /> : <>
      {!webHeader && <View style={styles.wrap}>
        <Pressable disabled={busy} style={styles.chip} onPress={() => setReload(value => value + 1)}><Text>Refresh</Text></Pressable>
      </View>}
      {formOpen && <View style={[styles.card, styles.formPanel]}>
        <Text style={styles.section}>{editing ? 'Edit customer' : 'New customer'}</Text>
        <View style={styles.formGrid}>
        {(['name', 'email', 'phone', 'address', 'notes'] as const).map(field => <View key={field} style={[styles.field, { width: twoColumns && field !== 'name' ? '48%' : '100%', flexGrow: 1 }]}>

          <TextInput validation={{ kind: field === 'name' ? 'name' : undefined, required: field === 'name', maxLength: field === 'phone' ? 10 : field === 'email' ? 254 : field === 'name' ? 150 : field === 'address' ? 500 : 2000 }} label={field === 'name' ? 'Customer name *' : field.charAt(0).toUpperCase() + field.slice(1)} accessibilityLabel={`Customer ${field}`} editable={!busy} style={styles.input} value={form[field]} maxLength={field === 'name' ? 150 : field === 'email' ? 255 : field === 'phone' ? 20 : field === 'address' ? 500 : 2000} multiline={field === 'notes' || field === 'address'} keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'} autoCapitalize={field === 'email' ? 'none' : 'sentences'} onChangeText={value => setForm(current => ({ ...current, [field]: value }))} />
        </View>)}
        </View>
        <SelectField label="Customer branch" labelInside value={form.branchId} disabled={busy} onChange={branchId => setForm(current => ({ ...current, branchId }))} options={[...(selection && ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(selection.role) ? [{ value: '', label: 'Company-wide' }] : []), ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} />
        <View style={styles.formActions}><Pressable accessibilityRole="button" disabled={busy} onPress={() => setFormOpen(false)} style={styles.chip}><Text>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save customer'}</Text></Pressable></View>
      </View>}
      <SearchField accessibilityLabel="Search customers" value={query} onChangeText={setQuery} />
      {!webHeader && <SelectField label="Filter customer branch" labelInside value={filterBranch} onChange={changeFilterBranch} options={[{ value: '', label: 'All branches' }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} />}
      <Text style={styles.note}>{visible.length} customer(s)</Text>
      {!visible.length && <Text>No matching customers.</Text>}
      {visible.map(customer => <View key={customer.id} style={styles.card}>
        <Text style={styles.section}>{customer.name}</Text><Text>{customer.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Text>
        <Text style={styles.note}>{branches.find(branch => branch.id === customer.branchId)?.name ?? (customer.branchId ? 'Unavailable branch' : 'Company-wide')}</Text>
        {!!customer.email && <Text selectable>{customer.email}</Text>}{!!customer.phone && <Text selectable>{customer.phone}</Text>}
        {!!customer.address && <Text selectable>{customer.address}</Text>}{!!customer.notes && <Text selectable>{customer.notes}</Text>}
        <View style={styles.wrap}><Pressable disabled={busy} style={styles.chip} onPress={() => begin(customer)}><Text>Edit customer</Text></Pressable><Pressable disabled={busy} style={styles.chip} onPress={() => void toggleStatus(customer)}><Text>{customer.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</Text></Pressable></View>
      </View>)}
    </>}
  </ScrollView>;
}

const baseStyles = StyleSheet.create({
  formPanel: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: formSpacing.field },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 },
  page: { flex: 1, backgroundColor: '#f6f8fc' }, body: { padding: 20, paddingBottom: 60, gap: 14 }, heading: { fontSize: 24, fontWeight: '700', color: '#20334f' },
  section: { fontSize: 18, fontWeight: '700', color: '#20334f' }, note: { color: '#607591', lineHeight: 20 }, error: { color: '#b3261e' }, link: { color: '#345cf2', fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 14, padding: 18, gap: formSpacing.field },
  field: { gap: 6 }, label: { color: '#405573', fontWeight: '600' }, input: { minWidth: 0, borderWidth: 1, borderColor: '#cfd7e6', borderRadius: 8, backgroundColor: '#fff', padding: 12 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#ccd6ed', borderRadius: 8 }, selected: { backgroundColor: '#e8eeff' },
  button: { minHeight: 44, justifyContent: 'center', padding: 12, borderRadius: 8, backgroundColor: '#345cf2' }, buttonText: { color: '#fff', fontWeight: '700' },
});
