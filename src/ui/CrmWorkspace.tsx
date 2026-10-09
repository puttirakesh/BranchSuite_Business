import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FiUsers, FiTrendingUp, FiBriefcase, FiFileText, FiList, FiHeadphones, FiHome, FiUserPlus, FiCreditCard, FiMoreHorizontal, FiSearch } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { readLeads, type Lead } from '../core/leads';
import { useAdminLayout } from './useAdminLayout';
import { useAdminViewport } from './useAdminViewport';

const modules = {
  leads: { title: 'Leads', description: 'Capture and follow up', singular: 'lead', background: '#e8eeff', color: '#345cf2' },
  deals: { title: 'Sales pipeline', description: 'Move deals forward', singular: 'deal', background: '#eee7ff', color: '#7853c8' },
  customers: { title: 'Customers', description: 'A complete relationship', singular: 'customer', background: '#def6ef', color: '#138f80' },
  quotes: { title: 'Quotes', description: 'Price, preview and approve', singular: 'quote', background: '#e8eeff', color: '#345cf2' },
  activities: { title: 'Activities', description: 'Calls, meetings and tasks', singular: 'activity', background: '#def6ef', color: '#138f80' },
  support: { title: 'Support', description: 'Tickets and internal notes', singular: 'ticket', background: '#eee7ff', color: '#7853c8' },
} as const;
type Module = keyof typeof modules;
type Mode = 'hub' | 'list' | 'detail' | 'create';
type RecordCard = { id: string; leadId: string; title: string; contact: string; branch: string; status: string; value?: number; email: string; phone: string; notes: string };
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const shortMoney = (value: number) => value >= 10000000 ? `₹${(value / 10000000).toFixed(2)} Cr` : value >= 100000 ? `₹${(value / 100000).toFixed(2)} L` : money(value);
const webIcons = { leads: FiUsers, deals: FiTrendingUp, customers: FiBriefcase, quotes: FiFileText, activities: FiList, support: FiHeadphones, home: FiHome, crm: FiTrendingUp, people: FiUserPlus, payroll: FiCreditCard, more: FiMoreHorizontal, search: FiSearch };

function CrmIcon({ name, color = '#345cf2' }: { name: keyof typeof webIcons; color?: string }) {
  if (Platform.OS === 'web') { const Icon = webIcons[name]; return <Icon size={18} color={color} />; }
  const stroke = { borderColor: color };
  if (name === 'leads' || name === 'people') return <View style={baseStyles.peopleIcon}><View style={[baseStyles.personHead, stroke]} /><View style={[baseStyles.personBody, stroke]} /><View style={[baseStyles.secondHead, stroke]} /><View style={[baseStyles.secondBody, stroke]} /></View>;
  if (name === 'customers' || name === 'quotes' || name === 'payroll') return <View style={[baseStyles.documentIcon, stroke]}>{[0, 1, 2].map(line => <View key={line} style={[baseStyles.documentLine, { backgroundColor: color }]} />)}</View>;
  if (name === 'activities') return <View style={baseStyles.listIcon}>{[0, 1, 2].map(line => <View key={line} style={baseStyles.listRow}><View style={[baseStyles.listCheck, stroke]} /><View style={[baseStyles.documentLine, { backgroundColor: color }]} /></View>)}</View>;
  if (name === 'support') return <View style={[baseStyles.headphoneIcon, stroke]}><View style={[baseStyles.headphoneLeft, stroke]} /><View style={[baseStyles.headphoneRight, stroke]} /></View>;
  return <Text style={[baseStyles.nativeIcon, { color }]}>{name === 'home' ? '\u2302' : name === 'more' ? '···' : name === 'search' ? '\u2315' : '\u2197'}</Text>;
}

function recordsFor(leads: Lead[], module: Module): RecordCard[] {
  if (module === 'quotes' || module === 'support') return [];
  return leads.flatMap(lead => {
    const common = { leadId: lead.id, branch: lead.branch, notes: lead.notes };
    if (module === 'deals') return lead.opportunity ? [{ ...common, id: lead.opportunity.id, title: lead.opportunity.name, contact: lead.contactPerson, email: lead.email, phone: lead.phone, value: lead.opportunity.estimatedValue, status: lead.stage }] : [];
    if (module === 'customers') return lead.customer ? [{ ...common, id: lead.customer.id, title: lead.customer.organisation, contact: lead.customer.contactPerson, email: lead.customer.email, phone: lead.customer.phone, status: 'Customer' }] : [];
    if (module === 'activities') return (lead.history || []).filter(entry => entry.kind === 'call' || entry.kind === 'activity').map(entry => ({ ...common, id: entry.id, title: entry.kind === 'call' ? 'Call' : 'Activity', contact: lead.organisation, email: lead.email, phone: lead.phone, notes: entry.note, status: entry.kind === 'call' ? 'Logged call' : 'Logged activity' }));
    return [{ ...common, id: lead.id, title: lead.organisation, contact: lead.contactPerson, email: lead.email, phone: lead.phone, value: lead.estimatedValue, status: lead.stage }];
  });
}

export function CrmWorkspace({ mode = 'hub' }: { mode?: Mode }) {
  const { styles } = useAdminLayout(baseStyles);
  const { width, fontScale, desktop } = useAdminViewport();
  const router = useRouter();
  const params = useLocalSearchParams<{ module?: string; id?: string; branch?: string }>();
  const module: Module | null = params.module && Object.prototype.hasOwnProperty.call(modules, params.module) ? params.module as Module : null;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState(params.branch || '');
  const [branchPicker, setBranchPicker] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    readLeads().then(records => { if (active) setLeads(records); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load CRM records.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));
  const branches = useMemo(() => [...new Set(leads.map(lead => lead.branch).filter(Boolean))].sort(), [leads]);
  const scoped = leads.filter(lead => !branch || lead.branch === branch);
  const rows = module ? recordsFor(scoped, mode === 'create' ? 'leads' : module) : [];
  const visible = rows.filter(row => `${row.title} ${row.contact} ${row.email} ${row.branch} ${row.status}`.toLowerCase().includes(query.trim().toLowerCase()));
  const record = rows.find(row => row.id === params.id);
  const config = module ? modules[module] : null;
  const pageWidth = Math.min(width, 1280);
  const padding = pageWidth >= 1000 ? 32 : pageWidth >= 600 ? 24 : 16;
  const contentWidth = Math.max(0, pageWidth - padding * 2);
  const columns = contentWidth / fontScale >= 900 ? 3 : contentWidth / fontScale >= 600 ? 2 : 1;
  const cardWidth = Math.max(0, (contentWidth - (columns - 1) * 16) / columns);
  const hubColumns = contentWidth / fontScale >= 840 ? 3 : contentWidth / fontScale >= 260 ? 2 : 1;
  const hubCardWidth = Math.max(0, (contentWidth - (hubColumns - 1) * 12) / hubColumns);
  const openDeals = scoped.filter(lead => lead.opportunity && !['Active', 'Inactive', 'Won', 'Lost'].includes(lead.stage));
  const pipelineTotal = openDeals.reduce((sum, lead) => sum + lead.opportunity!.estimatedValue, 0);
  const pipelineStages = [...new Set(['New', 'Qualified', 'Proposal', 'Negotiation', ...openDeals.map(lead => lead.stage)])].map((stage, index) => {
    const deals = openDeals.filter(lead => lead.stage === stage);
    return { stage, count: deals.length, value: deals.reduce((sum, lead) => sum + lead.opportunity!.estimatedValue, 0), color: ['#345cf2', '#138f80', '#7853c8', '#e2a348'][index % 4] };
  });
  const heading = mode === 'hub' ? 'CRM' : !config ? 'CRM module unavailable' : mode === 'detail' ? config.singular[0].toUpperCase() + config.singular.slice(1) + ' details' : mode === 'create' ? `Choose a lead for this ${config.singular}` : config.title;
  const back = () => router.push(mode === 'detail' && module ? { pathname: '/admin/crm/[module]', params: { module } } : '/admin/crm');
  const openLead = (id: string) => router.push({ pathname: '/admin/teamlead/[id]', params: { id } });

  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}>
      <View style={styles.mobileHeaderRow}><View style={styles.flex}><Text style={styles.companyName}>BranchSuite</Text><Text style={styles.headerCaption}>Business workspace</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Search leads" onPress={() => router.push('/admin/crm/leads')} style={styles.headerSearch}><CrmIcon name="search" color="#405573" /></Pressable><View style={styles.headerAvatar}><Text style={styles.avatarText}>A</Text></View></View>
      <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>BranchSuite</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Header branch selector" onPress={() => setBranchPicker(true)} style={[styles.headerFilter, styles.selectedFilter]}><Text numberOfLines={1} style={styles.headerBranch}>{branch || 'All branches'}</Text><Text style={styles.headerCaption}>⌄</Text></Pressable></View>
    </View>}
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        {mode === 'hub' && <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={() => router.push('/admin/dashboard')} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text></Pressable>}
        <View style={styles.flex}><Text style={styles.eyebrow}>BUSINESS WORKSPACE</Text><Text style={styles.title}>{heading}</Text><Text style={[styles.subtitle, mode === 'hub' && styles.hubSubtitle]}>{mode === 'hub' ? 'Customers and sales, connected.' : mode === 'create' ? module === 'activities' ? 'Open a lead to log a call or add an activity.' : 'Open a lead and use its conversion action to create the record.' : config?.description || 'Choose a module from the CRM workspace.'}</Text></View>
        <View style={styles.actions}>
          {mode !== 'hub' && <Pressable accessibilityRole="button" onPress={back} style={styles.secondary}><Text style={styles.link}>Back to CRM</Text></Pressable>}
          {(mode === 'hub' || (mode === 'list' && config && module !== 'quotes' && module !== 'support')) && <Pressable accessibilityRole="button" onPress={() => mode === 'hub' || module === 'leads' ? router.push('/admin/teamlead') : router.push({ pathname: '/admin/crm/[module]/create', params: { module: module! } })} style={styles.primary}><Text style={styles.primaryText}>{mode === 'hub' || module === 'leads' ? 'Add lead' : `Add ${config?.singular}`}</Text></Pressable>}
        </View>
      </View>
      {mode === 'hub' && <View style={styles.branchCard}><View style={styles.branchDot} /><View style={styles.flex}><Text style={styles.branchTitle}>{branch || 'All branches'}</Text><Text style={styles.branchCaption}>One branch, every module</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Change CRM branch" onPress={() => setBranchPicker(true)} style={styles.changeBranch}><Text style={styles.link}>Change</Text></Pressable></View>}
      {mode !== 'detail' && mode !== 'hub' && <View style={styles.toolbar}>
        <TextInput accessibilityLabel="Search CRM records" placeholder="Search names, contacts or branches" value={query} onChangeText={setQuery} style={styles.searchInput} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchFilters}>{['', ...branches].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value || 'All branches'} accessibilityState={{ selected: branch === value }} onPress={() => setBranch(value)} style={[styles.branchFilter, branch === value && styles.selectedFilter]}><Text style={styles.filterText}>{value || 'All branches'}</Text></Pressable>)}</ScrollView>
      </View>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading CRM records" color="#007f75" style={styles.loading} /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable></View> : mode === 'hub' ? <>
        <View style={styles.hubGrid}>{(Object.keys(modules) as Module[]).map(key => {
          const count = recordsFor(scoped, key).length;
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Open ${modules[key].title}`} onPress={() => router.push({ pathname: '/admin/crm/[module]', params: { module: key, ...(branch ? { branch } : {}) } })} style={({ pressed }) => [styles.moduleCard, { width: hubCardWidth }, pressed && styles.pressed]}>
            <View style={styles.moduleBody}><View style={styles.moduleHeading}><View style={[styles.moduleIcon, { backgroundColor: modules[key].background }]}><CrmIcon name={key} color={modules[key].color} /></View><View style={styles.countBadge}><Text style={styles.countLabel}>{count}</Text></View></View><Text style={styles.moduleTitle}>{modules[key].title}</Text><Text style={styles.moduleDescription}>{modules[key].description}</Text></View>
            <View style={styles.moduleFooter}><Text style={styles.footerLink}>Open workspace</Text><Text style={styles.footerChevron}>›</Text></View>
          </Pressable>;
        })}</View>
        <View style={styles.pipelineCard}>
          <View style={styles.pipelineHeading}><Text style={styles.pipelineTitle}>Sales pipeline</Text><Text style={styles.pipelineTotal}>{shortMoney(pipelineTotal)}</Text></View>
          {pipelineStages.map(stage => <View key={stage.stage} style={styles.pipelineStage}><View style={styles.pipelineHeading}><Text style={styles.stageLabel}>{stage.stage} {stage.count} {stage.count === 1 ? 'deal' : 'deals'}</Text><Text style={styles.stageValue}>{shortMoney(stage.value)}</Text></View><View style={styles.pipelineTrack}><View style={[styles.pipelineProgress, { backgroundColor: stage.color, width: `${pipelineTotal > 0 ? Math.min(100, stage.value / pipelineTotal * 100) : 0}%` }]} /></View></View>)}
          <Pressable accessibilityRole="button" accessibilityLabel="View pipeline" onPress={() => router.push({ pathname: '/admin/crm/[module]', params: { module: 'deals', ...(branch ? { branch } : {}) } })} style={styles.pipelineLink}><Text style={styles.link}>View pipeline</Text><Text style={styles.footerChevron}>›</Text></Pressable>
        </View>
      </> : !module ? <View style={styles.empty}><Text style={styles.subtitle}>This CRM module does not exist.</Text></View> : mode === 'detail' ? record ? <View style={[styles.recordCard, styles.detailCard]}>
        <Text style={styles.cardTitle}>{record.title}</Text><Text style={styles.status}>{record.status}</Text>
        <View style={styles.detailGrid}>{[['Contact', record.contact], ['Branch', record.branch], ['Email', record.email], ['Phone', record.phone], ...(record.value === undefined ? [] : [['Estimated value', money(record.value)]])].map(([label, value]) => <View key={label} style={[styles.detail, { width: contentWidth / fontScale >= 600 ? '50%' : '100%' }]}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value || '—'}</Text></View>)}</View>
        {record.notes ? <Text selectable style={styles.subtitle}>{record.notes}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => openLead(record.leadId)} style={styles.primary}><Text style={styles.primaryText}>Open source lead</Text></Pressable>
      </View> : <View style={styles.empty}><Text style={styles.cardTitle}>Record not found</Text><Text style={styles.subtitle}>This record may have been removed.</Text></View> : <>
        <Text style={styles.resultCount}>{visible.length} {mode === 'create' ? 'leads' : config?.title.toLowerCase()}</Text>
        <View style={styles.grid}>{visible.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${mode === 'create' ? 'Select' : 'View'} ${row.title}`} onPress={() => mode === 'create' ? openLead(row.leadId) : router.push({ pathname: '/admin/crm/[module]/[id]', params: { module, id: row.id, ...(branch ? { branch } : {}) } })} style={[styles.recordCard, { width: cardWidth }]}><View style={styles.recordHeading}><Text style={styles.cardTitle}>{row.title}</Text><Text style={styles.chevron}>›</Text></View><Text style={styles.subtitle}>{row.contact}</Text><Text style={styles.subtitle}>{row.branch}</Text><Text style={styles.status}>{row.status}</Text>{row.value !== undefined && <Text style={styles.amount}>{money(row.value)}</Text>}<Text style={styles.moduleLink}>{mode === 'create' ? 'Open lead' : 'View details'}</Text></Pressable>)}</View>
        {!visible.length && <View style={styles.empty}><Text style={styles.cardTitle}>No matching records</Text><Text style={styles.subtitle}>{rows.length ? 'Try another search or branch.' : 'Saved records will appear here.'}</Text></View>}
      </>}
    </ScrollView>
    {!desktop && <View style={styles.navigation}>{([
      { label: 'Home', icon: 'home', route: '/admin/dashboard' }, { label: 'CRM', icon: 'crm', route: '/admin/crm' }, { label: 'People', icon: 'people', route: '/admin/employees/people' }, { label: 'Payroll', icon: 'payroll', route: '/admin/payroll' }, { label: 'More', icon: 'more', route: '/admin/reports' },
    ] as const).map(tab => <Pressable key={tab.label} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: tab.label === 'CRM' }} onPress={() => router.push(tab.route)} style={styles.navItem}><View style={[styles.navIcon, tab.label === 'CRM' && styles.navSelected]}><CrmIcon name={tab.icon} color={tab.label === 'CRM' ? '#345cf2' : '#71829c'} /></View><Text style={[styles.navLabel, tab.label === 'CRM' && styles.navSelectedText]}>{tab.label}</Text></Pressable>)}</View>}
  </View><Modal transparent visible={branchPicker} animationType="fade" onRequestClose={() => setBranchPicker(false)}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}><View style={styles.pipelineHeading}><Text style={styles.cardTitle}>Choose branch</Text><Pressable accessibilityRole="button" accessibilityLabel="Close CRM branch picker" onPress={() => setBranchPicker(false)} style={styles.backButton}><Text style={styles.backGlyph}>×</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">{['', ...branches].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Select ${value || 'All branches'}`} accessibilityState={{ selected: branch === value }} onPress={() => { setBranch(value); setBranchPicker(false); }} style={styles.branchOption}><Text style={styles.filterText}>{value || 'All branches'}</Text>{branch === value && <Text style={styles.link}>✓</Text>}</Pressable>)}</ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 },
  scroll: { flex: 1, minHeight: 0 }, content: { padding: 16, paddingTop: 22, paddingBottom: 32, gap: 14 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  eyebrow: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', color: '#71829c' }, title: { fontSize: 26, fontWeight: '800', color: '#20334f', marginTop: 8 },
  subtitle: { fontSize: 13, lineHeight: 20, color: '#71829c', marginTop: 6 },
  hubSubtitle: { fontSize: 11, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, primary: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#345cf2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 13 }, secondary: { minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', alignItems: 'center', justifyContent: 'center' }, link: { fontSize: 13, color: '#345cf2', fontWeight: '600' },
  toolbar: { gap: 12 }, searchInput: { width: '100%', minHeight: 46, borderWidth: 1, borderColor: '#dce5f3', padding: 12, borderRadius: 12, backgroundColor: '#fff', color: '#20334f', fontSize: 14 },
  branchFilters: { gap: 8 }, branchFilter: { minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fff', justifyContent: 'center' }, selectedFilter: { backgroundColor: '#eaf0ff' }, filterText: { fontSize: 12, color: '#405573' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, hubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moduleCard: { borderRadius: 18, minHeight: 158, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', overflow: 'hidden' },
  moduleBody: { flex: 1, padding: 14, minHeight: 122 }, moduleHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  moduleIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  countBadge: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: '#f3f6fd', alignItems: 'center' }, countLabel: { fontSize: 10, fontWeight: '700', color: '#607591' },
  moduleTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: '#20334f', marginTop: 14 }, moduleDescription: { fontSize: 10, lineHeight: 17, color: '#71829c', marginTop: 5 },
  moduleFooter: { minHeight: 36, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, backgroundColor: '#fcfdff', borderTopWidth: 1, borderTopColor: '#edf1f8' },
  footerLink: { flexShrink: 1, fontSize: 10, fontWeight: '600', color: '#345cf2' }, footerChevron: { fontSize: 20, color: '#345cf2' }, pressed: { opacity: 0.75 },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: '#20334f', flexShrink: 1 }, count: { fontSize: 32, fontWeight: '800', color: '#20334f', marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#20334f' }, recordCard: { minWidth: 0, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' },
  recordHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, chevron: { fontSize: 22, color: '#71829c' },
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#eaf0ff', fontSize: 12, color: '#405573', marginTop: 12 }, amount: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#20334f', marginTop: 12 },
  moduleLink: { fontSize: 12, fontWeight: '700', color: '#345cf2', marginTop: 18 }, resultCount: { fontSize: 12, color: '#71829c' },
  loading: { padding: 32 }, empty: { padding: 24, gap: 12, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5' }, error: { color: '#b94d61', fontSize: 13, lineHeight: 20 },
  detailCard: { width: '100%', gap: 18 }, detailGrid: { flexDirection: 'row', flexWrap: 'wrap' }, detail: { paddingRight: 16, marginBottom: 20, minWidth: 0 }, detailLabel: { fontSize: 12, color: '#71829c', marginBottom: 6 }, detailValue: { fontSize: 14, lineHeight: 22, color: '#20334f' },
  header: { padding: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, mobileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#8192ad' },
  headerSearch: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' }, headerAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700', color: '#345cf2' },
  headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff' }, headerBranch: { flex: 1, minWidth: 0, fontSize: 10, color: '#405573' },
  backButton: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, backGlyph: { fontSize: 23, color: '#405573' },
  branchCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', borderRadius: 17 }, branchDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#39b8a7' }, branchTitle: { fontSize: 12, fontWeight: '700', color: '#20334f' }, branchCaption: { fontSize: 9, lineHeight: 15, color: '#71829c', marginTop: 3 }, changeBranch: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  pipelineCard: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' }, pipelineHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, pipelineTitle: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: '#20334f' }, pipelineTotal: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#20334f' }, pipelineStage: { marginTop: 16 }, stageLabel: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 17, color: '#405573' }, stageValue: { flexShrink: 1, fontSize: 11, fontWeight: '600', color: '#20334f' }, pipelineTrack: { height: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: '#e9eef8', marginTop: 7 }, pipelineProgress: { height: '100%', borderRadius: 4 }, pipelineLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 14 },
  overlay: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', padding: 22, borderRadius: 20, backgroundColor: '#fff' }, branchOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
  navigation: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e4eaf5', backgroundColor: '#fff' }, navItem: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }, navIcon: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navSelected: { backgroundColor: '#edf1ff' }, navLabel: { fontSize: 9, color: '#71829c' }, navSelectedText: { color: '#345cf2', fontWeight: '700' },
  peopleIcon: { width: 18, height: 18 }, personHead: { position: 'absolute', left: 3, top: 1, width: 6, height: 6, borderWidth: 1, borderRadius: 3 }, personBody: { position: 'absolute', left: 0, top: 9, width: 12, height: 7, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5 }, secondHead: { position: 'absolute', right: 1, top: 1, width: 5, height: 6, borderWidth: 1, borderLeftWidth: 0, borderTopRightRadius: 3, borderBottomRightRadius: 3 }, secondBody: { position: 'absolute', right: 0, top: 9, width: 4, height: 7, borderTopWidth: 1, borderRightWidth: 1, borderTopRightRadius: 4 },
  documentIcon: { width: 14, height: 18, borderWidth: 1, borderRadius: 2, paddingTop: 4, alignItems: 'center', gap: 3 }, documentLine: { width: 8, height: 1, borderRadius: 1 }, listIcon: { gap: 4 }, listRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, listCheck: { width: 4, height: 3, borderLeftWidth: 1, borderBottomWidth: 1, transform: [{ rotate: '-45deg' }] }, headphoneIcon: { width: 16, height: 14, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9 }, headphoneLeft: { position: 'absolute', left: -1, top: 7, width: 4, height: 7, borderWidth: 1, borderRadius: 1 }, headphoneRight: { position: 'absolute', right: -1, top: 7, width: 4, height: 7, borderWidth: 1, borderRadius: 1 }, nativeIcon: { fontSize: 21, lineHeight: 25 },
});
