
export const endpoints = {
  auth: {
    login: '/platform/auth/login',
    profile: '/platform/auth/me',
    logout: '/platform/auth/logout',
  },

  customers: '/platform/customers',
} as const;
