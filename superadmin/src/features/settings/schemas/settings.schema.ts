import { z } from 'zod';

/** APK `saveSettings` + backend UpdatePlatformSettingsDto (platformName 2-100, supportEmail <= 254). */
export const settingsSchema = z.object({
  brand: z.string().trim().min(2, 'Use at least 2 characters').max(100),
  supportEmail: z.string().trim().email('Enter a valid email address').max(254),
  supportPhone: z.string().max(30).optional(),
  announcement: z.string().max(500).optional(),
  supportPortalUrl: z.string().refine(v => !v || /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(v), 'Use an HTTPS URL').optional(),
  displayAnnouncement: z.boolean().optional(),
  trialEnabled: z.boolean(),
});
export type SettingsForm = z.infer<typeof settingsSchema>;
