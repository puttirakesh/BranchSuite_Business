export interface PlatformSettings {
  brand: string;
  supportEmail: string;
  supportPhone?: string;
  announcement?: string;
  supportPortalUrl?: string;
  displayAnnouncement?: boolean;
  /** APK-only setting. The backend settings DTO has no trial toggle yet. */
  trialEnabled: boolean | null;
}
