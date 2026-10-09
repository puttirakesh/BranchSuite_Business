import { useAdminViewport } from '../../../src/ui/useAdminViewport';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const { styles: responsiveStyles } = useAdminLayout(styles);
  return <Text style={responsiveStyles.sectionTitle}>{children}</Text>;
}

function QuickActionIcon({ name, tone }: { name: 'employee' | 'lead' | 'task' | 'attendance'; tone: Tone }) {
  const colors = {
    blue: { stroke: '#345cf2', background: '#edf1ff' },
    green: { stroke: '#138f80', background: '#e1f5ee' },
    purple: { stroke: '#8b5cf6', background: '#f0e8ff' },
    gold: { stroke: '#aa690e', background: '#fff1d9' },
  }[tone];
  return (
    <View accessible={false} style={[styles.quickIcon, { backgroundColor: colors.background }]}>
      {name === 'employee' || name === 'lead' ? (
        <View style={styles.quickPeople}>
          <View style={[styles.quickPersonHead, { borderColor: colors.stroke }]} />
          <View style={[styles.quickPersonBody, { borderColor: colors.stroke }]} />
          {name === 'employee' ? (
            <View style={styles.quickPlus}>
              <View style={[styles.quickPlusHorizontal, { backgroundColor: colors.stroke }]} />
              <View style={[styles.quickPlusVertical, { backgroundColor: colors.stroke }]} />
            </View>
          ) : (
            <>
              <View style={[styles.quickSecondHead, { borderColor: colors.stroke }]} />
              <View style={[styles.quickSecondBody, { borderColor: colors.stroke }]} />
            </>
          )}
        </View>
      ) : name === 'task' ? (
        <View style={styles.quickChecklist}>
          {[0, 1, 2].map(line => (
            <View key={line} style={styles.quickChecklistRow}>
              <View style={[styles.quickCheck, { borderColor: colors.stroke }]} />
              <View style={[styles.quickListLine, { backgroundColor: colors.stroke }]} />
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.quickClock, { borderColor: colors.stroke }]}>
          <View style={[styles.quickClockHour, { backgroundColor: colors.stroke }]} />
          <View style={[styles.quickClockMinute, { backgroundColor: colors.stroke }]} />
        </View>
      )}
    </View>
  );
}

function ActionRow({ title, subtitle, icon, tone, onPress }: { title: string; subtitle: string; icon: IconName; tone: Tone; onPress?: () => void }) {
  const { styles: responsiveStyles } = useAdminLayout(styles);
  return (
    <Pressable style={responsiveStyles.actionRow} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress}>
      <Icon name={icon} tone={tone} />
      <View style={responsiveStyles.flex}>
        <Text style={responsiveStyles.rowTitle}>{title}</Text>
        <Text style={responsiveStyles.caption}>{subtitle}</Text>
      </View>
      <Text style={responsiveStyles.chevron}>›</Text>
    </Pressable>
  );
}

// Layout only. Empty slots are reserved for your own data and navigation.
export default function AdminDashboard() {
  const { styles: adminStyles } = useAdminLayout(styles);
  const router = useRouter();
  const { width, fontScale, desktop } = useAdminViewport();
  const pageWidth = Math.min(width, 1280);
  const isDesktop = pageWidth >= 1000;
  const isTablet = pageWidth >= 600;
  const horizontalPadding = isDesktop ? 32 : isTablet ? 24 : 16;
  const contentWidth = Math.max(0, pageWidth - horizontalPadding * 2);
  const columns = contentWidth / fontScale >= 900 ? 4 : contentWidth / fontScale >= 340 ? 2 : 1;
  const cardWidth = Math.max(0, (contentWidth - (columns - 1) * 12) / columns);
  const compactActions = contentWidth / fontScale < 280;
  const stackOverview = contentWidth / fontScale < 340;
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    AsyncStorage.getItem('branchsuite:my-attendance-requests:v1').then(stored => {
      const requests: unknown = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(requests)) throw new Error('Requests could not be read.');
      if (active) setPendingCount(requests.filter(request => request && (request.type === 'leave' || request.type === 'correction') && request.status === 'pending').length);
    }).catch(() => { if (active) setPendingCount(null); });
    return () => { active = false; };
  }, []));
  return (
    <SafeAreaView style={adminStyles.safe}>
      <View style={adminStyles.page}>
        <View style={[adminStyles.header, { paddingHorizontal: horizontalPadding }, desktop && { display: 'none' }]}>
          <View style={adminStyles.between}>
            <View style={adminStyles.flex}>
              <Text style={adminStyles.companyName}>{/* Company name */}</Text>
              <Text style={adminStyles.caption}>Business workspace</Text>
            </View>
            <View style={adminStyles.searchIcon}><Text style={adminStyles.searchGlyph}>⌕</Text></View>
            <View style={adminStyles.avatar}>{/* Profile initial */}</View>
          </View>
          <View style={[adminStyles.filters, isTablet && adminStyles.filtersWide, stackOverview && adminStyles.filtersStacked]}>
            <View style={adminStyles.filter}>
              <Text style={adminStyles.filterLabel}>Company</Text>
              {/* Selected company */}
              <Text style={adminStyles.chevron}>⌄</Text>
            </View>
            <View style={[adminStyles.filter, adminStyles.branchFilter]}>
              <Text style={adminStyles.filterLabel}>Branch</Text>
              {/* Selected branch */}
              <Text style={adminStyles.chevron}>⌄</Text>
            </View>
          </View>
        </View>

        <ScrollView style={adminStyles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[adminStyles.content, { paddingHorizontal: horizontalPadding }]}>
          <View style={[adminStyles.between, stackOverview && adminStyles.overviewStacked]}>
            <View style={adminStyles.flex}>
              <Text style={adminStyles.eyebrow}>BUSINESS OVERVIEW</Text>
              <Text style={adminStyles.greeting}>Hello.{/* User name */}</Text>
              <Text style={adminStyles.subtitle}>Your people, customers and priorities.</Text>
            </View>
            <View style={adminStyles.dateBadge}>
              <Text style={adminStyles.dateGlyph}>◷</Text>
              <View>
                <Text style={adminStyles.dateValue}>{/* Date */}</Text>
                <Text style={adminStyles.dateLabel}>Today</Text>
              </View>
            </View>
          </View>

          <View style={adminStyles.quickActions}>
            {([
              { label: 'Add employee', icon: 'employee', tone: 'blue' },
              { label: 'Add lead', icon: 'lead', tone: 'green' },
              { label: 'Assign task', icon: 'task', tone: 'purple' },
              { label: 'Attendance', icon: 'attendance', tone: 'gold' },
            ] as const).map(action => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [adminStyles.quickAction, { width: compactActions ? '50%' : '25%' }, pressed && adminStyles.quickActionPressed]}
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
                <QuickActionIcon name={action.icon} tone={action.tone} />
                <Text style={adminStyles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle>At a glance</SectionTitle>
          <View style={adminStyles.grid}>
            {([
              { label: 'Active employees', caption: 'Present today', icon: 'people', tone: 'blue' },
              { label: 'Pending requests', caption: 'Review and approve', icon: 'clock', tone: 'gold' },
              { label: 'Net payroll', caption: 'Employees', icon: 'file', tone: 'green' },
              { label: 'Open pipeline', caption: 'Active leads', icon: 'chart', tone: 'purple' },
            ] as const).map(metric => (
              <Pressable
                key={metric.label}
                style={[adminStyles.metric, { width: cardWidth, backgroundColor: tones[metric.tone].card }]}
                accessibilityRole={metric.label === 'Active employees' || metric.label === 'Pending requests' || metric.label === 'Net payroll' ? 'button' : undefined}
                accessibilityLabel={metric.label === 'Active employees' || metric.label === 'Pending requests' || metric.label === 'Net payroll' ? metric.label : undefined}
                onPress={metric.label === 'Active employees'
                  ? () => router.push('/admin/employees/active-employees')
                  : metric.label === 'Pending requests'
                    ? () => router.push('/admin/approvals')
                    : metric.label === 'Net payroll'
                      ? () => router.push('/admin/payroll')
                      : undefined}
              >
                <View style={adminStyles.between}><Icon name={metric.icon} tone={metric.tone} /><Text style={adminStyles.chevron}>›</Text></View>
                <Text style={adminStyles.metricLabel}>{metric.label}</Text>
                <Text style={adminStyles.metricValue}>{metric.label === 'Pending requests' ? pendingCount ?? '—' : null}</Text>
                <Text style={adminStyles.caption}>{metric.caption}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle>Your workspaces</SectionTitle>
          <View style={adminStyles.grid}>
            {([
              { title: 'CRM', description: 'Leads, deals & customers', icon: 'chart', tone: 'blue' },
              { title: 'People', description: 'Team, attendance & leave', icon: 'people', tone: 'green' },
              { title: 'Payroll', description: 'Payroll, taxes & payslips', icon: 'file', tone: 'purple' },
              { title: 'Reports', description: 'Insights & PDF exports', icon: 'building', tone: 'gold' },
            ] as const).map(workspace => (
              <Pressable key={workspace.title} style={[adminStyles.workspace, { width: cardWidth }]} accessibilityRole={'button'} accessibilityLabel={workspace.title} onPress={workspace.title === 'People' ? () => router.push('/admin/employees/people') : workspace.title === 'Reports' ? () => router.push('/admin/reports') : workspace.title === 'Payroll' ? () => router.push('/admin/payroll') : workspace.title === 'CRM' ? () => router.push('/admin/crm') : undefined}>
                <View style={adminStyles.between}><Icon name={workspace.icon} tone={workspace.tone} /><Text style={adminStyles.caption}>{/* Workspace summary */}</Text></View>
                <Text style={adminStyles.workspaceTitle}>{workspace.title}</Text>
                <Text style={adminStyles.caption}>{workspace.description}</Text>
                <View style={adminStyles.workspaceFooter}>
                  <Text style={[adminStyles.workspaceLink, { color: tones[workspace.tone].color }]}>Open workspace</Text>
                  <Text style={adminStyles.chevron}>›</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={[adminStyles.detailSections, isDesktop && adminStyles.detailSectionsWide]}>
            <View style={adminStyles.detailSection}>
              <SectionTitle>Needs attention</SectionTitle>
              <View style={adminStyles.list}>
                <ActionRow title="Requests to review" subtitle="Leave & attendance approvals" icon="clock" tone="gold" onPress={() => router.push('/admin/approvals')} />
                <ActionRow title="Payroll checks" subtitle="Resolve before the next pay run" icon="file" tone="purple" onPress={() => router.push('/admin/payroll')} />
                <ActionRow title="Customer follow-ups" subtitle="Open your team's task list" icon="list" tone="blue" />
              </View>
            </View>

            <View style={adminStyles.detailSection}>
              <SectionTitle>Your personal space</SectionTitle>
              <View style={adminStyles.list}>
                <ActionRow title="My attendance" subtitle="Check in, leave & exceptions" icon="clock" tone="green" onPress={() => router.push('/admin/attendance')} />
                <ActionRow title="My payslip" subtitle="View your published payslip" icon="file" tone="blue" />
              </View>
            </View>
          </View>

        </ScrollView>

        <View style={[adminStyles.navigation, { paddingHorizontal: horizontalPadding }]}>
          {([
            { label: 'Home', icon: 'home' }, { label: 'CRM', icon: 'chart' },
            { label: 'People', icon: 'people' }, { label: 'Payroll', icon: 'file' },
            { label: 'More', icon: 'more' },
          ] as const).map(tab => (
            <Pressable key={tab.label} style={adminStyles.navItem} accessibilityRole={tab.label === 'People' || tab.label === 'Payroll' ? 'button' : undefined} onPress={tab.label === 'People' ? () => router.push('/admin/employees/people') : tab.label === 'Payroll' ? () => router.push('/admin/payroll') : undefined}>
              <View style={[adminStyles.navIcon, tab.label === 'Home' && adminStyles.navSelected]}><Icon name={tab.icon} plain /></View>
              <Text style={[adminStyles.navLabel, tab.label === 'Home' && adminStyles.navLabelSelected]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center', minHeight: 0 },
  flex: { flex: 1, minWidth: 0 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#eef0f6' },
  companyName: { minHeight: 20, fontSize: 16, fontWeight: '800', color: '#263246' },
  caption: { fontSize: 12, lineHeight: 18, color: '#8e97a8', marginTop: 4 },
  searchIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  searchGlyph: { fontSize: 27, color: '#536079' },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 10, marginTop: 18 },
  filtersWide: { maxWidth: 520 },
  filtersStacked: { flexDirection: 'column' },
  filter: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  branchFilter: { backgroundColor: '#e9edfc' },
  filterLabel: { fontSize: 12, color: '#8e97a8' },
  chevron: { color: '#a6aebb', fontSize: 20 },
  content: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 30 },
  scroll: { flex: 1, minHeight: 0 },
  overviewStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: '#9099ac' },
  greeting: { fontSize: 29, fontWeight: '800', letterSpacing: -1, color: '#263246', marginTop: 7 },
  subtitle: { fontSize: 13, lineHeight: 20, color: '#8e97a8', marginTop: 5 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 12, backgroundColor: '#fff' },
  dateGlyph: { color: '#8e97a8', fontSize: 18 },
  dateValue: { minHeight: 12, minWidth: 32, fontSize: 9, fontWeight: '700', color: '#263246' },
  dateLabel: { fontSize: 8, color: '#8e97a8', marginTop: 3 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 4, marginTop: 20 },
  quickAction: { alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 64, paddingHorizontal: 2, paddingVertical: 4, borderRadius: 12 },
  quickActionPressed: { backgroundColor: '#f6f8fd', opacity: 0.75 },
  quickLabel: { fontSize: 10, lineHeight: 14, textAlign: 'center', fontWeight: '600', color: '#20334f' },
  quickIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickPeople: { width: 18, height: 18 },
  quickPersonHead: { position: 'absolute', left: 3, top: 2, width: 6, height: 6, borderWidth: 1, borderRadius: 3 },
  quickPersonBody: { position: 'absolute', left: 0, top: 10, width: 12, height: 6, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  quickPlus: { position: 'absolute', right: 0, top: 8, width: 6, height: 6 },
  quickPlusHorizontal: { position: 'absolute', top: 2.5, width: 6, height: 1 },
  quickPlusVertical: { position: 'absolute', left: 2.5, width: 1, height: 6 },
  quickSecondHead: { position: 'absolute', right: 1, top: 2, width: 5, height: 6, borderWidth: 1, borderLeftWidth: 0, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  quickSecondBody: { position: 'absolute', right: 0, top: 10, width: 4, height: 6, borderTopWidth: 1, borderRightWidth: 1, borderTopRightRadius: 4 },
  quickChecklist: { gap: 3 },
  quickChecklistRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickCheck: { width: 4, height: 3, borderLeftWidth: 1, borderBottomWidth: 1, transform: [{ rotate: '-45deg' }] },
  quickListLine: { width: 8, height: 1, borderRadius: 1 },
  quickClock: { width: 14, height: 14, borderWidth: 1, borderRadius: 7 },
  quickClockHour: { position: 'absolute', left: 5.5, top: 2, width: 1, height: 4 },
  quickClockMinute: { position: 'absolute', left: 5.5, top: 5, width: 4, height: 1, transform: [{ rotate: '25deg' }] },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 23, lineHeight: 28 },
  person: { width: 20, height: 21, alignItems: 'center' },
  personHead: { width: 7, height: 7, borderWidth: 1.5, borderRadius: 5 },
  personBody: { width: 15, height: 9, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8, marginTop: 4 },
  document: { width: 14, height: 18, borderWidth: 1.5, borderRadius: 2, paddingTop: 3, alignItems: 'center', gap: 3 },
  documentLine: { width: 7, height: 1.5, borderRadius: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: '#263246', marginTop: 26, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { minHeight: 145, minWidth: 0, borderRadius: 16, padding: 15 },
  metricLabel: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: '#737f91', marginTop: 10 },
  metricValue: { minHeight: 30, fontSize: 25, fontWeight: '800', letterSpacing: -0.8, color: '#263246', marginTop: 4 },
  workspace: { minHeight: 173, borderRadius: 16, backgroundColor: '#fff', padding: 15 },
  workspaceTitle: { fontSize: 17, fontWeight: '800', color: '#263246', marginTop: 12 },
  workspaceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 20 },
  workspaceLink: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  detailSections: { gap: 0 },
  detailSectionsWide: { flexDirection: 'row', gap: 24 },
  detailSection: { flex: 1, minWidth: 0 },
  list: { gap: 11 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 17 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#263246' },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: 9, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#edf0f6' },
  navItem: { flex: 1, minWidth: 0, minHeight: 48, alignItems: 'center', gap: 4 },
  navIcon: { width: 43, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navSelected: { backgroundColor: '#edf1ff' },
  navLabel: { fontSize: 11, textAlign: 'center', fontWeight: '600', color: '#8b95a8' },
  navLabelSelected: { color: '#748acb' },
});
