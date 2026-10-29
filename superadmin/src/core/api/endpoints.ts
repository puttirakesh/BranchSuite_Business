
export const endpoints = {
  auth: {
    login: '/platform/auth/login',
    profile: '/platform/auth/me',
    logout: '/platform/auth/logout',
  },

  dashboard: {
    summary: '/platform/dashboard/summary',
  },
} as const;
