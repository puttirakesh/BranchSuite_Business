import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/tokens';
import { AppText, Button, useToast, Card, EmptyState, Grid, LoadingList, Note, PageHeader, Pill, QueryState, Screen } from '../../../shared/components';
import { useCampaigns, useOffers } from '../../../shared/hooks/queries';
import { money } from '../../../shared/utils/format';
import { useQuickAction } from '../../../shared/components/QuickActions';
import { OfferEditor } from '../components/OfferEditor';
import { CampaignEditor } from '../components/CampaignEditor';
import type { Campaign, Offer } from '../types';

/** APK `platform-offers`: offer codes and the campaign registry. */
export function OffersScreen({ openOffer }: { openOffer?: string } = {}) {
  const offers = useOffers();
  const toast = useToast();
  const [creating, setCreating] = useState(openOffer === 'new');
  const campaigns = useCampaigns();
  const quick = useQuickAction();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // Deep links: /offers/create opens a blank editor, /offers/<id> opens that offer.
  useEffect(() => {
    if (!openOffer || openOffer === 'new' || !offers.data) return;
    const found = offers.data.find((o) => o.id === openOffer);
    if (found) setOffer(found);
    else toast('That offer no longer exists.');
  }, [openOffer, offers.data, toast]);

  const closeOffer = () => {
    setOffer(null);
    setCreating(false);
    if (openOffer) router.replace('/offers');
  };
  return (
    <Screen onRefresh={() => Promise.all([offers.refetch(), campaigns.refetch()])}>
      <PageHeader title="Offers & campaigns" subtitle="Subscription promotions." action={<Button label="+ Offer" small onPress={() => quick('offer')} />} />
      <QueryState query={offers} loading={<LoadingList rows={1} height={200} />} isEmpty={(d) => !d.length} empty={<EmptyState title="No offer codes yet" text="Create an offer to give new subscribers a discount." />}>
        {(data) => (
          <Grid columns={{ base: 1, medium: 2 }} gap={14} style={{ marginBottom: 8 }}>
            {data.map((o) => (
              <Card key={o.id}>
                <View style={styles.between}>
                  <AppText variant="h2">{o.code}</AppText>
                  <Pill label={o.status ?? (o.enabled ? 'Active' : 'Paused')} />
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{o.discountType === 'FIXED' ? money(o.discount) : o.discount + '%'}</Text>
                  <Text style={styles.per}> discount</Text>
                </View>
                <AppText variant="small">{o.used ?? '—'} / {o.maxUses ?? '∞'} used · expires {o.expiresOn || '—'}</AppText>
                <Button label="Edit offer" variant="secondary" full style={{ marginTop: 16 }} onPress={() => setOffer(o)} />
              </Card>
            ))}
          </Grid>
        )}
      </QueryState>

      <PageHeader level={2} title="Marketing campaigns" subtitle="Campaign registry for subscription acquisition." action={<Button label="+ Campaign" variant="secondary" small onPress={() => quick('campaign')} />} />
      <QueryState query={campaigns} loading={<LoadingList rows={1} height={160} />} isEmpty={(d) => !d.length} empty={<EmptyState title="No campaigns yet" text="Record a campaign to track which offer it promotes." />}>
        {(data) => (
          <View>
            {data.map((c) => (
              <Card key={c.id} style={{ marginBottom: 14 }}>
                <View style={styles.between}>
                  <AppText variant="h2" style={{ flex: 1 }}>{c.name}</AppText>
                  <Pill label={c.status} />
                </View>
                <AppText variant="small" style={{ marginTop: 12 }}>{c.channel} · offer {c.offerCode || 'none'}{c.notes ? '\n' + c.notes : ''}</AppText>
                <Button label="Edit campaign" variant="secondary" full style={{ marginTop: 16 }} onPress={() => setCampaign(c)} />
              </Card>
            ))}
          </View>
        )}
      </QueryState>
      <Note>Offer definitions do not apply discounts or redeem codes automatically. Payment integration is pending.</Note>
      <OfferEditor visible={!!offer || creating} offer={offer} onClose={closeOffer} />
      <CampaignEditor visible={!!campaign} campaign={campaign} onClose={() => setCampaign(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 22, marginBottom: 6 },
  price: { fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: -1.2 },
  per: { fontSize: 12, color: '#4F6A93' },
});
