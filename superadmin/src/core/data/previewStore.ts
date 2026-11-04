/**
 * In-memory store used ONLY when EXPO_PUBLIC_PREVIEW_DATA=true and no API URL is set.
 * Data is created from src/fixtures/previewData.ts, lives for the app session and is
 * never persisted or sent anywhere. Every screen shows a "Preview data" banner in this mode.
 */
import { createPreviewData, type PreviewData } from '../../fixtures/previewData';
import { env } from '../config/env';
import { today } from '../domain/dates';

let data: PreviewData | null = null;
let actorName = 'Preview user';

export function previewDb(): PreviewData {
  if (env.dataMode !== 'preview') throw new Error('Preview fixtures are unavailable outside explicit preview mode.');
  if (!data) data = createPreviewData();
  return data;
}

export function setPreviewActor(name: string) {
  actorName = name;
}

let sequence = 0;
export function previewId(prefix: string) {
  sequence += 1;
  return prefix + '-' + Date.now().toString(36) + '-' + sequence;
}

/** Records a change in the preview audit log, mirroring the APK `audit()` helper. */
export function previewAudit(action: string, detail: string) {
  previewDb().audit.unshift({ id: previewId('AUD'), action, detail, actor: actorName, time: today(), module: null });
}

export function resetPreview() {
  data = null;
}
