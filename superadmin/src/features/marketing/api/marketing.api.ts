import { pendingEndpoints } from '../../../core/api/endpoints';
import { AppError } from '../../../core/api/api-error';
import { matches, pageOf, type ListQuery, type Page } from '../../../core/api/types';
import { run } from '../../../core/data/source';
import { previewAudit, previewDb } from '../../../core/data/previewStore';
import type { Prospect } from '../types';
import type { FollowUpForm } from '../schemas/follow-up.schema';

const find = (id: string) => {
  const p = previewDb().prospects.find((x) => x.id === id);
  if (!p) throw new AppError('not_found', 'This prospect no longer exists.');
  return p;
};

/** Sales prospects have no backend module yet (backend crm/leads is tenant-scoped, not platform). */
export const marketingApi = {
  list: (query: ListQuery) =>
    run<Page<Prospect>>({
      requiredEndpoint: pendingEndpoints.listProspects,
      preview: () =>
        pageOf(previewDb().prospects.filter((l) => (!query.stage || l.status === query.stage) && (!query.from || l.followup >= query.from) && (!query.to || l.followup <= query.to) && matches(query.search, l.business, l.contact, l.industry, l.status)), query),
    }),
  get: (id: string) =>
    run<Prospect>({ requiredEndpoint: pendingEndpoints.getProspect, preview: () => structuredClone(find(id)) }),
  updateFollowUp: (id: string, input: FollowUpForm) =>
    run<Prospect>({
      requiredEndpoint: pendingEndpoints.updateProspect,
      preview: () => {
        const p = find(id);
        Object.assign(p, { status: input.status, followup: input.followup, notes: input.notes });
        previewAudit('Prospect follow-up updated', p.business);
        return structuredClone(p);
      },
    }),
};
