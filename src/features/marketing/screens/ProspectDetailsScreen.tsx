import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { demoDatabase } from '../../../mocks/customers.mock';
import { colors } from '../../../ui/theme';

export default function ProspectDetailsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const prospect = demoDatabase.saasLeads.find(item => item.id === id);

  if (!prospect) {
    return <View style={styles.empty}><Text style={styles.emptyTitle}>Prospect not found</Text><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backButtonText}>Back to prospects</Text></Pressable></View>;
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backLink}><Text style={styles.backLinkText}>‹ Sales prospects</Text></Pressable>
      <View style={styles.header}>
        <View style={styles.businessMark}><Text style={styles.businessMarkText}>{prospect.business.slice(0, 2).toUpperCase()}</Text></View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{prospect.id}</Text>
          <Text style={styles.title}>{prospect.business}</Text>
          <Text style={styles.subtitle}>{prospect.industry} · {prospect.employees} employees</Text>
        </View>
        <View style={styles.statusBadge}><Text style={styles.statusText}>{prospect.status}</Text></View>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Info label="Contact person" value={prospect.contact} />
          <Info label="Email" value={prospect.email} />
          <Info label="Phone" value={prospect.phone} />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Follow-up</Text>
          <Info label="Source" value={prospect.source} />
          <Info label="Stage" value={prospect.status} />
          <Info label="Next follow-up" value={prospect.followup} />
        </View>
      </View>

      <View style={styles.notesCard}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Text style={styles.notes}>{prospect.notes || 'No notes have been added.'}</Text>
      </View>
      <Text style={styles.note}>This is a read-only native view of the supplied BranchSuite APK prospect record.</Text>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 24, paddingBottom: 48 }, backLink: { alignSelf: 'flex-start', marginBottom: 14 }, backLinkText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 }, businessMark: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender }, businessMarkText: { color: colors.primary, fontSize: 18, fontWeight: '800' }, headerCopy: { flex: 1, marginLeft: 14 }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 3 }, subtitle: { color: colors.muted, marginTop: 4 }, statusBadge: { borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#EBF1FF' }, statusText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { flexGrow: 1, flexBasis: 300, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18 }, sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 }, infoRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }, infoLabel: { color: colors.muted, fontSize: 12 }, infoValue: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  notesCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18 }, notes: { color: colors.text, fontSize: 15, lineHeight: 22 }, note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 }, backButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 }, backButtonText: { color: '#FFFFFF', fontWeight: '700' }
});
