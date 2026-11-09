/**
 * Every backend path used by the app, in one place. Paths are relative to
 * EXPO_PUBLIC_API_URL + '/api/v1' and come from backend/src/modules/platform/*
 * on the dev/superadmin-backend branch.
 */
const seg = (value: string) => encodeURIComponent(value);

export const endpoints = {
  auth: {
    login: "/platform/auth/login",
    me: "/platform/auth/me",
    logout: "/platform/auth/logout",
  },
  dashboard: { summary: "/platform/dashboard/summary" },
  customers: {
    list: "/platform/customers",
    detail: (id: string) => "/platform/customers/" + seg(id),
    status: (id: string) => "/platform/customers/" + seg(id) + "/status",
  },
  billing: {
    invoices: "/platform/billing/invoices",
    invoice: (id: string) => "/platform/billing/invoices/" + seg(id),
    summary: "/platform/billing/summary",
  },
  support: {
    summary: "/platform/support/summary",
    tickets: "/platform/support/tickets",
    ticket: (id: string) => "/platform/support/tickets/" + seg(id),
  },
  offers: {
    list: "/platform/marketing/offers",
    detail: (id: string) => "/platform/marketing/offers/" + seg(id),
  },
  settings: { general: "/platform/settings/general" },
  audit: { events: "/platform/audit/events" },
} as const;

/**
 * Endpoints the frontend needs but the backend does not provide yet. Actions that
 * depend on them show "Waiting for backend support" with this text, and never fake success.
 */
export const pendingEndpoints = {
  forgotPassword: "POST /platform/auth/forgot-password",
  resetPassword: "POST /platform/auth/reset-password",
  updateSubscription: "PATCH /platform/customers/:id/subscription",
  listPlans: "GET /platform/plans",
  updatePlan: "PATCH /platform/plans/:id",
  createPlan: "POST /platform/plans",
  listProspects: "GET /platform/marketing/prospects",
  getProspect: "GET /platform/marketing/prospects/:id",
  updateProspect: "PATCH /platform/marketing/prospects/:id",
  listCampaigns: "GET /platform/marketing/campaigns",
  createCampaign: "POST /platform/marketing/campaigns",
  updateCampaign: "PATCH /platform/marketing/campaigns/:id",
  invoicePdf: "GET /platform/billing/invoices/:id/pdf",
} as const;
