export interface PlatformSettings {
  brand: string;
  supportEmail: string;
  /** APK-only setting. The backend settings DTO has no trial toggle yet. */
  trialEnabled: boolean | null;
}
