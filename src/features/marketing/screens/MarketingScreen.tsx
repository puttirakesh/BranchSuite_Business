import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { demoDatabase } from '../../../mocks/customers.mock';
import { colors } from '../../../ui/theme';

export default function MarketingScreen() {
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const prospects = demoDatabase.saasLeads;
  const compact = width < 760;
  const statuses = ['All', ...Array.from(new Set(prospects.map(prospect => prospect.status)))];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prospects.filter(prospect => {
      const matchesStatus = status === 'All' || prospect.status === status;
      const matchesSearch = !query || [prospect.id, prospect.business, prospect.contact, prospect.industry, prospect.source, prospect.email]
        .join(' ').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [prospects, search, status]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SALES</Text>
          <Text style={styles.title}>Sales prospects</Text>
          <Text style={styles.subtitle}>Enquiries and follow-ups from your product.</Text>
        </View>
        <View style={styles.totalBadge}><Text style={styles.totalValue}>{prospects.length}</Text><Text style={styles.totalLabel}>prospects</Text></View>
      </View>

      <View style={[styles.summaryGrid, compact && styles.summaryGridCompact]}>
        {statuses.filter(item => item !== 'All').map(item => (
          <View key={item} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{item}</Text>
            <Text style={styles.summaryValue}>{prospects.filter(prospect => prospect.status === item).length}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.toolbar, compact && styles.toolbarCompact]}>
        <TextInput accessibilityRole="search" value={search} onChangeText={setSearch} placeholder="Search prospect, industry or stage" placeholderTextColor={colors.muted} style={[styles.searchInput, compact && styles.fullWidth]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {statuses.map(filter => (
            <Pressable key={filter} accessibilityRole="button" accessibilityState={{ selected: status === filter }} onPress={() => setStatus(filter)} style={[styles.filterChip, status === filter && styles.filterChipActive]}>
              <Text style={[styles.filterText, status === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.list}>
        {filtered.map(prospect => (
          <Pressable key={prospect.id} accessibilityRole="button" accessibilityLabel={`Open prospect ${prospect.business}`} onPress={() => router.push(`/(admin)/marketing/${encodeURIComponent(prospect.id)}` as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.cardTop}>
              <View style={styles.businessMark}><Text style={styles.businessMarkText}>{prospect.business.slice(0, 2).toUpperCase()}</Text></View>
              <View style={styles.cardIdentity}>
                <Text style={styles.business}>{prospect.business}</Text>
                <Text style={styles.meta}>{prospect.contact} · {prospect.industry}</Text>
              </View>
              <View style={styles.statusBadge}><Text style={styles.statusText}>{prospect.status}</Text></View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.detailText}>{prospect.source} lead · {prospect.employees} employees</Text>
              <Text style={styles.followup}>Follow-up {prospect.followup}</Text>
            </View>
          </Pressable>
        ))}
        {filtered.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>No prospects found</Text><Text style={styles.emptyText}>Try a different search or stage.</Text></View>}
      </View>
      <Text style={styles.note}>Follow-ups are recorded locally in this demo. No email, message or call is sent.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 24, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }, title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 14, marginTop: 5 },
  totalBadge: { width: 76, height: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender }, totalValue: { color: colors.primary, fontSize: 22, fontWeight: '800' }, totalLabel: { color: colors.muted, fontSize: 11 },
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 18 }, summaryGridCompact: { flexWrap: 'wrap' }, summaryCard: { flexGrow: 1, minWidth: 150, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14 }, summaryLabel: { color: colors.muted, fontSize: 12 }, summaryValue: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }, toolbarCompact: { flexDirection: 'column', alignItems: 'stretch' }, searchInput: { flex: 1, maxWidth: 460, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.surface, color: colors.text }, fullWidth: { width: '100%', maxWidth: '100%' }, filters: { gap: 8 }, filterChip: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 13, justifyContent: 'center' }, filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary }, filterText: { color: colors.muted, fontSize: 13, fontWeight: '700' }, filterTextActive: { color: '#FFFFFF' },
  list: { gap: 10 }, card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 }, pressed: { opacity: 0.82 }, cardTop: { flexDirection: 'row', alignItems: 'center' }, businessMark: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender }, businessMarkText: { color: colors.primary, fontWeight: '800' }, cardIdentity: { flex: 1, marginLeft: 12 }, business: { color: colors.text, fontSize: 16, fontWeight: '800' }, meta: { color: colors.muted, marginTop: 4, fontSize: 13 }, statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EBF1FF' }, statusText: { color: colors.primary, fontSize: 12, fontWeight: '800' }, cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }, detailText: { color: colors.muted, fontSize: 13 }, followup: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' }, emptyText: { color: colors.muted, marginTop: 6 }, note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 }
});
