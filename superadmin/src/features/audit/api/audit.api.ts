import { endpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { dateOnly, shortId } from '../../../core/api/mappers';
import { matches, pageOf, type ListQuery, type Page } from '../../../core/api/types';
import { run } from '../../../core/data/source';
import { previewDb } from '../../../core/data/previewStore';
import type { AuditEvent } from '../types';

export interface AuditQuery extends ListQuery {
  from?: string;
  to?: string;
}

interface BackendAudit {
  id: string;
  actorId: string | null;
  action: string;
  module: string | null;
  detail: string | null;
  createdAt: string;
}

export const auditApi = {
  list: (query: AuditQuery) =>
    run<Page<AuditEvent>>({
      preview: () =>
        pageOf(
          previewDb().audit.filter(
            (e) =>
              matches(query.search, e.action, e.detail, e.actor) &&
              (!query.from || e.time >= query.from) &&
              (!query.to || e.time <= query.to),
          ),
          query,
        ),
      api: async () => {
        const res = await http.get<Page<BackendAudit>>(endpoints.audit.events, {
          action: query.search || undefined,
          from: query.from,
          to: query.to,
          page: query.page ?? 1,
          limit: Math.min(query.limit ?? 50, 100),
        });
        return {
          ...res,
          items: res.items.map((e) => ({
            id: e.id,
            action: e.action,
            detail: e.detail ?? '',
            actor: 'User ' + shortId(e.actorId),
            time: dateOnly(e.createdAt) ?? '',
            module: e.module,
          })),
        };
      },
    }),
};
