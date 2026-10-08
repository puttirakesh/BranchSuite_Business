import { api, scopeHeaders } from './api';
import { dashboardSchema, pageSchema, recordSchema, type EntityKind, type RecordInput, type Scope } from '../types';
import { crmConfig, initialDraft, validateDraft } from '../utils/crm';
import { identifierError, InputValidationError, validateSearch } from '../utils/validation';
import { demoDashboard, demoDelete, demoEnabled, demoList, demoRecord, demoSave } from './demo';

function checkId(id: string) {
  const error = identifierError(id, 'record', true);
  if (error) throw new InputValidationError({ id: error });
}

export async function getDashboard(scope: Scope, signal?: AbortSignal) {
  if (demoEnabled()) return demoDashboard(scope);
  return dashboardSchema.parse((await api.get('/dashboard', { headers: scopeHeaders(scope), signal })).data);
}
export async function getRecords(scope: Scope, kind: EntityKind, search = '', status = '', cursor?: string, signal?: AbortSignal) {
  const query = validateSearch(search);
  if (query.error) throw new InputValidationError({ search: query.error });
  if (status && !(crmConfig[kind].statuses as readonly string[]).includes(status)) throw new InputValidationError({ status: 'Choose a valid status.' });
  if (demoEnabled()) return demoList(scope, kind, query.value, status, cursor);
  return pageSchema.parse((await api.get(`/crm/${kind}`, {
    headers: scopeHeaders(scope), params: { search: query.value, status, cursor, limit: 25 }, signal,
  })).data);
}
export async function getRecord(scope: Scope, kind: EntityKind, id: string, signal?: AbortSignal) {
  checkId(id);
  if (demoEnabled()) return demoRecord(scope, kind, id);
  return recordSchema.parse((await api.get(`/crm/${kind}/${encodeURIComponent(id)}`, { headers: scopeHeaders(scope), signal })).data);
}
export async function saveRecord(scope: Scope, kind: EntityKind, input: RecordInput, id?: string) {
  if (id !== undefined) checkId(id);
  const draft = { ...initialDraft(kind), ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'items')
    .map(([key, value]) => [key, value == null ? '' : String(value)])), name: input.name ?? '', status: input.status ?? '' };
  const validation = validateDraft(kind, draft, (input.items ?? []).map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })));
  if (!validation.input) throw new InputValidationError(validation.errors);
  if (demoEnabled()) return demoSave(scope, kind, validation.input, id);
  const config = { headers: scopeHeaders(scope) };
  // Preserve omitted optional fields for PATCH callers, while normalizing supplied values.
  const normalized = Object.fromEntries(Object.entries(validation.input).filter(([key]) => Object.prototype.hasOwnProperty.call(input, key)));
  const response = id ? await api.patch(`/crm/${kind}/${encodeURIComponent(id)}`, normalized, config) : await api.post(`/crm/${kind}`, normalized, config);
  return recordSchema.parse(response.data);
}
export async function deleteRecord(scope: Scope, kind: EntityKind, id: string) {
  checkId(id);
  if (demoEnabled()) { demoDelete(scope, kind, id); return; }
  await api.delete(`/crm/${kind}/${encodeURIComponent(id)}`, { headers: scopeHeaders(scope) });
}
