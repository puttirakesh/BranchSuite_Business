import { endpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { run } from '../../../core/data/source';
import { previewAudit, previewDb } from '../../../core/data/previewStore';
import type { PlatformSettings } from '../types';
import type { SettingsForm } from '../schemas/settings.schema';

/** backend/src/modules/platform/settings (GET/PATCH /platform/settings/general). */
interface BackendSettings {
  settings: { platformName?: string; supportEmail?: string };
  version: number;
}

export const settingsApi = {
  get: () =>
    run<PlatformSettings>({
      preview: () => structuredClone(previewDb().settings),
      api: async () => {
        const res = await http.get<BackendSettings>(endpoints.settings.general);
        return { brand: res.settings.platformName ?? '', supportEmail: res.settings.supportEmail ?? '', trialEnabled: null };
      },
    }),
  save: (input: SettingsForm) =>
    run<void>({
      preview: () => {
        Object.assign(previewDb().settings, input);
        previewAudit('Platform settings updated', input.brand);
      },
      api: async () => {
        await http.patch(endpoints.settings.general, { platformName: input.brand, supportEmail: input.supportEmail });
      },
    }),
};
