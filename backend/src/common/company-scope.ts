import { ForbiddenException } from '@nestjs/common';

export function assertCompanyScope(actor: object, companyId: string) {
  const selected = (actor as { companyId?: string }).companyId;
  if (selected && selected !== companyId) {
    throw new ForbiddenException('The record belongs to a different company. Switch company and retry.');
  }
}

export function requestCompany(request: { headers?: Record<string, unknown>; body?: { companyId?: unknown }; query?: { companyId?: unknown } }): string | undefined {
  const scopes = [request.headers?.['x-company-id'], request.body?.companyId, request.query?.companyId]
    .filter((value): value is string => typeof value === 'string');
  if (new Set(scopes).size > 1) throw new ForbiddenException('Conflicting company scopes');
  return scopes[0];
}
