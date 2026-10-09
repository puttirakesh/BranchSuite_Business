import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const tones = {
  blue: { color: '#748acb', background: '#edf1ff', card: '#f0f3ff' },
  green: { color: '#64a894', background: '#e6f4ee', card: '#edf7f3' },
  purple: { color: '#a38ac0', background: '#f1eafa', card: '#f5f0fb' },
  gold: { color: '#c6a063', background: '#fff1d9', card: '#fff8eb' },
};
type Tone = keyof typeof tones;
type IconName = 'people' | 'clock' | 'list' | 'file' | 'chart' | 'building' | 'home' | 'more';

function Icon({ name, tone = 'blue', plain = false }: { name: IconName; tone?: Tone; plain?: boolean }) {
  const color = tones[tone].color;
  return (
    <View style={[styles.icon, !plain && { backgroundColor: tones[tone].background }]}>
      {name === 'people' ? (
        <View style={styles.person}>
          <View style={[styles.personHead, { borderColor: color }]} />
          <View style={[styles.personBody, { borderColor: color }]} />
        </View>
      ) : name === 'file' || name === 'building' ? (
        <View style={[styles.document, { borderColor: color }]}>
          {[0, 1, 2].map(line => <View key={line} style={[styles.documentLine, { backgroundColor: color }]} />)}
        </View>
      ) : (
        <Text style={[styles.iconGlyph, { color }]}>
          {{ clock: '◷', list: '☷', chart: '↗', home: '⌂', more: '···' }[name]}
        </Text>
      )}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ActionRow({ title, subtitle, icon, tone, onPress }: { title: string; subtitle: string; icon: IconName; tone: Tone; onPress?: () => void }) {
  return (
    <Pressable style={styles.actionRow} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress}>
      <Icon name={icon} tone={tone} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.caption}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// Layout only. Empty slots are reserved for your own data and navigation.
export default function AdminDashboard() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.between}>
            <View style={styles.flex}>
              <Text style={styles.companyName}>{/* Company name */}</Text>
              <Text style={styles.caption}>Business workspace</Text>
            </View>
            <View style={styles.searchIcon}><Text style={styles.searchGlyph}>⌕</Text></View>
            <View style={styles.avatar}>{/* Profile initial */}</View>
          </View>
          <View style={styles.filters}>
            <View style={styles.filter}>
              <Text style={styles.filterLabel}>Company</Text>
              {/* Selected company */}
              <Text style={styles.chevron}>⌄</Text>
            </View>
            <View style={[styles.filter, styles.branchFilter]}>
              <Text style={styles.filterLabel}>Branch</Text>
              {/* Selected branch */}
              <Text style={styles.chevron}>⌄</Text>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.between}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>BUSINESS OVERVIEW</Text>
              <Text style={styles.greeting}>Hello.{/* User name */}</Text>
              <Text style={styles.subtitle}>Your people, customers and priorities.</Text>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateGlyph}>◷</Text>
              <View>
                <Text style={styles.dateValue}>{/* Date */}</Text>
                <Text style={styles.dateLabel}>Today</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActions}>
            {([
              { label: 'Add employee', icon: 'people', tone: 'blue' },
              { label: 'Add lead', icon: 'people', tone: 'green' },
              { label: 'Assign task', icon: 'list', tone: 'purple' },
              { label: 'Attendance', icon: 'clock', tone: 'gold' },
            ] as const).map(action => (
              <Pressable
                key={action.label}
                style={styles.quickAction}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={action.label === 'Add employee'
                  ? () => router.push('/admin/employees/create')
                  : action.label === 'Add lead'
                    ? () => router.push('/admin/teamlead')
                  : action.label === 'Assign task'
                    ? () => router.push('/admin/tasks')
                    : action.label === 'Attendance'
                      ? () => router.push('/admin/attendance')
                      : undefined}
              >
                <Icon name={action.icon} tone={action.tone} />
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle>At a glance</SectionTitle>
          <View style={styles.grid}>
            {([
              { label: 'Active employees', caption: 'Present today', icon: 'people', tone: 'blue' },
              { label: 'Pending requests', caption: 'Review and approve', icon: 'clock', tone: 'gold' },
              { label: 'Net payroll', caption: 'Employees', icon: 'file', tone: 'green' },
              { label: 'Open pipeline', caption: 'Active leads', icon: 'chart', tone: 'purple' },
            ] as const).map(metric => (
              <Pressable
                key={metric.label}
                style={[styles.metric, { backgroundColor: tones[metric.tone].card }]}
                accessibilityRole={metric.label === 'Active employees' || metric.label === 'Pending requests' ? 'button' : undefined}
                accessibilityLabel={metric.label === 'Active employees' || metric.label === 'Pending requests' ? metric.label : undefined}
                onPress={metric.label === 'Active employees'
                  ? () => router.push('/admin/employees/active-employees')
                  : metric.label === 'Pending requests'
                    ? () => router.push('/admin/approvals')
                    : undefined}
              >
                <View style={styles.between}><Icon name={metric.icon} tone={metric.tone} /><Text style={styles.chevron}>›</Text></View>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{/* Metric value */}</Text>
                <Text style={styles.caption}>{metric.caption}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle>Your workspaces</SectionTitle>
          <View style={styles.grid}>
            {([
              { title: 'CRM', description: 'Leads, deals & customers', icon: 'chart', tone: 'blue' },
              { title: 'People', description: 'Team, attendance & leave', icon: 'people', tone: 'green' },
              { title: 'Payroll', description: 'Payroll, taxes & payslips', icon: 'file', tone: 'purple' },
              { title: 'Reports', description: 'Insights & PDF exports', icon: 'building', tone: 'gold' },
            ] as const).map(workspace => (
              <Pressable key={workspace.title} style={styles.workspace} accessibilityRole={workspace.title === 'People' ? 'button' : undefined} onPress={workspace.title === 'People' ? () => router.push('/admin/employees') : undefined}>
                <View style={styles.between}><Icon name={workspace.icon} tone={workspace.tone} /><Text style={styles.caption}>{/* Workspace summary */}</Text></View>
                <Text style={styles.workspaceTitle}>{workspace.title}</Text>
                <Text style={styles.caption}>{workspace.description}</Text>
                <View style={styles.workspaceFooter}>
                  <Text style={[styles.workspaceLink, { color: tones[workspace.tone].color }]}>Open workspace</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <SectionTitle>Needs attention</SectionTitle>
          <View style={styles.list}>
            <ActionRow title="Requests to review" subtitle="Leave & attendance approvals" icon="clock" tone="gold" onPress={() => router.push('/admin/approvals')} />
            <ActionRow title="Payroll checks" subtitle="Resolve before the next pay run" icon="file" tone="purple" />
            <ActionRow title="Customer follow-ups" subtitle="Open your team's task list" icon="list" tone="blue" />
          </View>

          <SectionTitle>Your personal space</SectionTitle>
          <View style={styles.list}>
            <ActionRow title="My attendance" subtitle="Check in, leave & exceptions" icon="clock" tone="green" onPress={() => router.push('/admin/attendance')} />
            <ActionRow title="My payslip" subtitle="View your published payslip" icon="file" tone="blue" />
          </View>

          <SectionTitle>Branch overview</SectionTitle>
          {/* Empty branch card template. Populate and repeat with your own records. */}
          <View style={styles.branchCard}>
            <View style={styles.between}>
              <View style={styles.branchHeading}><Icon name="building" /><Text style={styles.rowTitle}>{/* Branch name */}</Text></View>
              <Text style={styles.chevron}>›</Text>
            </View>
            <View style={styles.branchStats}>
              {['Employees', 'Present today', 'Requests'].map(label => (
                <View key={label}><Text style={styles.branchValue}>{/* Statistic */}</Text><Text style={styles.caption}>{label}</Text></View>
              ))}
            </View>
            <View style={styles.progressTrack}>{/* Attendance progress */}</View>
            <Text style={styles.branchSummary}>{/* Attendance and payroll summary */}</Text>
          </View>
        </ScrollView>

        <View style={styles.navigation}>
          {([
            { label: 'Home', icon: 'home' }, { label: 'CRM', icon: 'chart' },
            { label: 'People', icon: 'people' }, { label: 'Payroll', icon: 'file' },
            { label: 'More', icon: 'more' },
          ] as const).map(tab => (
            <Pressable key={tab.label} style={styles.navItem} accessibilityRole={tab.label === 'People' ? 'button' : undefined} onPress={tab.label === 'People' ? () => router.push('/admin/employees') : undefined}>
              <View style={[styles.navIcon, tab.label === 'Home' && styles.navSelected]}><Icon name={tab.icon} plain /></View>
              <Text style={[styles.navLabel, tab.label === 'Home' && styles.navLabelSelected]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  flex: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#eef0f6' },
  companyName: { minHeight: 20, fontSize: 16, fontWeight: '800', color: '#263246' },
  caption: { fontSize: 10, lineHeight: 16, color: '#8e97a8', marginTop: 4 },
  searchIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  searchGlyph: { fontSize: 27, color: '#536079' },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 10, marginTop: 18 },
  filter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  branchFilter: { backgroundColor: '#e9edfc' },
  filterLabel: { fontSize: 10, color: '#8e97a8' },
  chevron: { color: '#a6aebb', fontSize: 20 },
  content: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 30 },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: '#9099ac' },
  greeting: { fontSize: 29, fontWeight: '800', letterSpacing: -1, color: '#263246', marginTop: 7 },
  subtitle: { fontSize: 11, lineHeight: 18, color: '#8e97a8', marginTop: 5 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 12, backgroundColor: '#fff' },
  dateGlyph: { color: '#8e97a8', fontSize: 18 },
  dateValue: { minHeight: 12, minWidth: 32, fontSize: 9, fontWeight: '700', color: '#263246' },
  dateLabel: { fontSize: 8, color: '#8e97a8', marginTop: 3 },
  quickActions: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 15, marginTop: 24 },
  quickAction: { flex: 1, alignItems: 'center', gap: 8 },
  quickLabel: { fontSize: 10, fontWeight: '700', color: '#263246' },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 23, lineHeight: 28 },
  person: { width: 20, height: 21, alignItems: 'center' },
  personHead: { width: 7, height: 7, borderWidth: 1.5, borderRadius: 5 },
  personBody: { width: 15, height: 9, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8, marginTop: 4 },
  document: { width: 14, height: 18, borderWidth: 1.5, borderRadius: 2, paddingTop: 3, alignItems: 'center', gap: 3 },
  documentLine: { width: 7, height: 1.5, borderRadius: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: '#263246', marginTop: 26, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexBasis: '45%', flexGrow: 1, minHeight: 145, borderRadius: 16, padding: 15 },
  metricLabel: { fontSize: 11, fontWeight: '600', color: '#737f91', marginTop: 10 },
  metricValue: { minHeight: 30, fontSize: 25, fontWeight: '800', letterSpacing: -0.8, color: '#263246', marginTop: 4 },
  workspace: { flexBasis: '45%', flexGrow: 1, minHeight: 173, borderRadius: 16, backgroundColor: '#fff', padding: 15 },
  workspaceTitle: { fontSize: 17, fontWeight: '800', color: '#263246', marginTop: 12 },
  workspaceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 20 },
  workspaceLink: { fontSize: 9, fontWeight: '700' },
  list: { gap: 11 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 17 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#263246' },
  branchCard: { borderRadius: 16, backgroundColor: '#fff', padding: 17 },
  branchHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  branchStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 15 },
  branchValue: { minHeight: 28, fontSize: 23, fontWeight: '700', color: '#263246' },
  progressTrack: { height: 4, borderRadius: 4, backgroundColor: '#f0f2f5', overflow: 'hidden' },
  branchSummary: { minHeight: 16, marginTop: 11, fontSize: 9, color: '#8e97a8' },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: 9, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#edf0f6' },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navIcon: { width: 43, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navSelected: { backgroundColor: '#edf1ff' },
  navLabel: { fontSize: 9, fontWeight: '600', color: '#8b95a8' },
  navLabelSelected: { color: '#748acb' },
});
