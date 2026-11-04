export type DataMode = 'api' | 'preview' | 'unconfigured';

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const previewRequested = process.env.EXPO_PUBLIC_PREVIEW_DATA === 'true';

export const env = Object.freeze({
  appName: 'BranchSuite Admin',
  apiUrl,
  apiPrefix: '',
  dataMode: (apiUrl ? 'api' : previewRequested ? 'preview' : 'unconfigured') as DataMode,
  requestTimeoutMs: 15000,
});

