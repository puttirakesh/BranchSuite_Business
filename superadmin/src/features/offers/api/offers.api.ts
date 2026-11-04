import { endpoints, pendingEndpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { AppError } from '../../../core/api/api-error';
import { dateOnly, toNumber } from '../../../core/api/mappers';
import type { Page } from '../../../core/api/types';
import { run } from '../../../core/data/source';
import { previewAudit, previewDb, previewId } from '../../../core/data/previewStore';
import { today } from '../../../core/domain/dates';
import type { Campaign, Offer } from '../types';
import type { CampaignForm, OfferValues } from '../schemas/offer.schema';

/** backend/src/modules/platform/marketing (offers). */
interface BackendOffer {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: string | number;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  usageCount?: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
}

const mapOffer = (o: BackendOffer): Offer => ({
  id: o.id,
  code: o.code,
  discountType: o.discountType,
  discount: toNumber(o.discountValue),
  maxUses: o.usageLimit,
  used: o.usageCount ?? null,
  enabled: o.status === 'ACTIVE',
  startsOn: dateOnly(o.startsAt) ?? '',
  status: o.status,
  expiresOn: dateOnly(o.endsAt) ?? '',
});

const offerPath = (id: string) => endpoints.offers.detail(id);

export const offersApi = {
  list: () =>
    run<Offer[]>({
      preview: () => structuredClone(previewDb().offers),
      api: async () => (await http.get<Page<BackendOffer>>(endpoints.offers.list, { limit: 100 })).items.map(mapOffer),
    }),

  save: (id: string | null, v: OfferValues) =>
    run<void>({
      preview: () => {
        const db = previewDb();
        if (db.offers.some((o) => o.id !== id && o.code === v.code)) throw new AppError('validation', 'This offer code exists.');
        const existing = id ? db.offers.find((o) => o.id === id) : undefined;
        if (id && !existing) throw new AppError('not_found', 'This offer no longer exists.');
        const next: Offer = {
          id: existing?.id ?? previewId('OFFER'),
          code: v.code,
          discountType: existing?.discountType ?? 'PERCENT',
          discount: v.percent,
          maxUses: v.maxUses,
          used: existing?.used ?? 0,
          enabled: v.enabled,
          startsOn: v.startsOn ?? today(),
          status: v.enabled ? 'ACTIVE' : 'PAUSED',
          expiresOn: v.expiresOn,
        };
        if (existing) Object.assign(existing, next);
        else db.offers.push(next);
        previewAudit('Offer code saved', v.code);
      },
      api: async () => {
        // Field mapping documented in docs/API_INTEGRATION.md (APK form -> CreateMarketingOfferDto).
        const endsAt = v.expiresOn + 'T23:59:59.000Z';
        let offerId = id;
        if (!offerId) {
          const created = await http.post<{ id: string }>(endpoints.offers.list, {
            title: v.code,
            description: 'Subscription offer ' + v.code,
            code: v.code,
            discountType: 'PERCENT',
            discountValue: v.percent,
            startsAt: (v.startsOn ?? today()) + 'T00:00:00.000Z',
            endsAt,
            usageLimit: v.maxUses,
          });
          offerId = created.id;
        } else {
          const current = await http.get<BackendOffer>(offerPath(offerId));
          const changed = dateOnly(current.startsAt) !== v.startsOn || dateOnly(current.endsAt) !== v.expiresOn || current.usageLimit !== v.maxUses;
          if (changed) {
            if (current.status === 'ACTIVE' || current.status === 'ARCHIVED') throw new AppError('validation', 'Pause this offer and save its status before editing dates or limits.');
            await http.patch(offerPath(offerId), { startsAt: (v.startsOn ?? today()) + 'T00:00:00.000Z', endsAt, usageLimit: v.maxUses });
          }
        }
        const current = await http.get<BackendOffer>(offerPath(offerId));
        const desired = v.enabled ? 'ACTIVE' : current.status === 'DRAFT' ? 'DRAFT' : 'PAUSED';
        if (current.status !== desired) await http.patch(offerPath(offerId) + '/status', { status: desired });
      },
    }),

  campaigns: () =>
    run<Campaign[]>({ requiredEndpoint: pendingEndpoints.listCampaigns, preview: () => structuredClone(previewDb().campaigns) }),

  saveCampaign: (id: string | null, input: CampaignForm) =>
    run<void>({
      requiredEndpoint: id ? pendingEndpoints.updateCampaign : pendingEndpoints.createCampaign,
      preview: () => {
        const db = previewDb();
        if (input.offerCode && !db.offers.some((o) => o.code === input.offerCode))
          throw new AppError('validation', 'Choose an available offer code.');
        const existing = id ? db.campaigns.find((c) => c.id === id) : undefined;
        if (id && !existing) throw new AppError('not_found', 'This campaign no longer exists.');
        if (existing) Object.assign(existing, input);
        else db.campaigns.push({ id: previewId('CAM'), ...input });
        previewAudit('Marketing campaign saved', input.name);
      },
    }),
};
