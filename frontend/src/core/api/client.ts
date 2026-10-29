import axios, { AxiosError } from "axios";
import { validateManualRequest } from "../../shared/validation/request";

// =====================================================
// API CONFIGURATION
// =====================================================

// Expo injects this variable during bundling / EAS build.
// Configure it in frontend/.env and the EAS preview environment.
const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!API_URL) {
  console.error(
    "[API CONFIG] EXPO_PUBLIC_API_URL is missing. " +
      "Check your local .env or EAS environment.",
  );
} else if (typeof __DEV__ !== "undefined" && __DEV__) {
  console.log("[API CONFIG] Backend URL:", API_URL);
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// =====================================================
// REQUEST VALIDATION
// =====================================================

api.interceptors.request.use((config) => {
  validateManualRequest(config.url ?? "", config.method ?? "get", config.data);

  return config;
});

// =====================================================
// SESSION EXPIRY LISTENERS
// =====================================================

const expiredSessionListeners = new Set<() => void>();

export function subscribeSessionExpiry(listener: () => void) {
  expiredSessionListeners.add(listener);

  return () => {
    expiredSessionListeners.delete(listener);
  };
}

// =====================================================
// RESPONSE ERROR HANDLING
// =====================================================

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const unauthorized = error.response?.status === 401;
<<<<<<< Updated upstream
    const publicAuthRequest = /\/auth\/(?:login|signup|forgot-password|reset-password)(?:[/?#]|$)/.test(error.config?.url ?? "");
    const authorization = error.config?.headers?.Authorization;
    const activeAuthorization = api.defaults.headers.common.Authorization;
    const staleSessionResponse =
      error.response?.status === 401 &&
      !!authorization &&
      authorization !== activeAuthorization;

    // A revoked token can still have requests in flight after local logout.
    // Reject those promises without reporting an expected stale response as an app error.
    // Log diagnostic information only during development.
    // Do not log request bodies, JWTs or authorization headers.
    // Rejected sessions and credentials are handled by the auth UI, not Expo's error overlay.
    if (
      !axios.isCancel(error) &&
      !staleSessionResponse &&
      !unauthorized &&
      typeof __DEV__ !== "undefined" &&
      __DEV__
    ) {
=======
    const publicAuthRequest = /\/auth\/(?:login|signup|verify-otp|forgot-password|reset-password)(?:[/?#]|$)/.test(error.config?.url ?? '');
    const authorization = error.config?.headers?.Authorization;
    const activeAuthorization = api.defaults.headers.common.Authorization;
    // Ignore cancellation and rejected credentials; keep other development diagnostics free of secrets.
    if (!axios.isCancel(error) && typeof __DEV__ !== 'undefined' && __DEV__ && !unauthorized) {
>>>>>>> Stashed changes
      console.error("[API REQUEST FAILED]", {
        baseURL: error.config?.baseURL,
        url: error.config?.url,
        method: error.config?.method,
        code: error.code,
        message: error.message,
        status: error.response?.status,
      });
    }

    // A delayed request from an older session
    // must not clear the current session.
    if (
      unauthorized &&
      !publicAuthRequest &&
      authorization &&
      authorization === activeAuthorization
    ) {
      // Clear synchronously so parallel failures cannot expire the same session
      // repeatedly or send more requests with its rejected token.
      setAccessToken(null);
      expiredSessionListeners.forEach((listener) => {
        listener();
      });
    }

    return Promise.reject(error);
  },
);

// =====================================================
// AUTH TYPES
// =====================================================

export type LoginPortal = "staff" | "employee";
export interface Branch {
  id: string;
  name: string;
}

export interface Membership {
  id: string;
  tenantId: string;
  companyId: string;
  companyName: string;
  role: string;
  roles?: string[];
  permissions: string[];
  branches: Branch[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  memberships: Membership[];
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  session: AuthSession;
}

// =====================================================
// BUSINESS SIGNUP TYPES
// =====================================================

export type SignupPlanId = "starter" | "growth" | "scale";

export type SignupBillingCycle = "monthly" | "annual";

export interface SignupRequest {
  emailChallengeId: string;
  emailOtp: string;
  businessName: string;
  branchName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  planId: SignupPlanId;
  billingCycle: SignupBillingCycle;
}

export interface SignupResponse {
  message: string;

  user: {
    id: string;
    name: string;
    email: string;
  };

  business: {
    tenantId: string;
    companyId: string;
    branchId: string;
    name: string;
  };

  subscription: {
    planId: SignupPlanId;
    billingCycle: SignupBillingCycle;
    status: "PENDING_ACTIVATION";
  };

  nextStep: "LOGIN";
}

// =====================================================
// FORGOT PASSWORD TYPES
// =====================================================

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  challengeId: string;
  message: string;
}

// =====================================================
// RESET PASSWORD TYPES
// =====================================================

export interface ResetPasswordRequest {
  challengeId: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

// =====================================================
// BUSINESS SCOPE TYPES
// =====================================================

export interface BusinessScope {
  tenantId: string;
  companyId: string;
  branchId: string;
}

// =====================================================
// ACCESS TOKEN HANDLING
// =====================================================

export function setAccessToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// =====================================================
// BUSINESS SCOPE HEADERS
// =====================================================

export function getScopeHeaders(scope: BusinessScope) {
  return {
    "X-Tenant-Id": scope.tenantId,
    "X-Company-Id": scope.companyId,
    "X-Branch-Id": scope.branchId,
  };
}

// =====================================================
// BUSINESS SIGNUP API
// POST /api/v1/auth/signup
// =====================================================

export async function signupApi(data: SignupRequest): Promise<SignupResponse> {
  const payload: SignupRequest = {
    emailChallengeId: data.emailChallengeId,
    emailOtp: data.emailOtp,
    businessName: data.businessName.trim(),
    branchName: data.branchName.trim(),
    ownerName: data.ownerName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    password: data.password,
    planId: data.planId,
    billingCycle: data.billingCycle,
  };

  const response = await api.post<SignupResponse>("/auth/signup", payload);

  return response.data;
}

// =====================================================
// LOGIN API
// POST /api/v1/auth/login
// =====================================================

export async function loginApi(
  email: string,
  password: string,
  portal: LoginPortal,
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/auth/login", {
    email: email.trim().toLowerCase(),
    password,
    portal,
  });

  return response.data;
}

// =====================================================
// FORGOT PASSWORD API
// POST /api/v1/auth/forgot-password
// =====================================================

export async function forgotPasswordApi(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  return (await api.post<ForgotPasswordResponse>('/auth/forgot-password', data)).data;
}

export async function requestSignupOtpApi(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  return (await api.post<ForgotPasswordResponse>('/auth/signup/otp', data)).data;
}

export async function verifyOtpApi(challengeId: string, otp: string): Promise<void> {
  await api.post('/auth/verify-otp', { challengeId, otp });
}

// =====================================================
// RESET PASSWORD API
// POST /api/v1/auth/reset-password
// =====================================================

export async function resetPasswordApi(
  data: ResetPasswordRequest,
): Promise<ResetPasswordResponse> {
  const payload: ResetPasswordRequest = {
    challengeId: data.challengeId,
    otp: data.otp.trim(),
    newPassword: data.newPassword,
    confirmPassword: data.confirmPassword,
  };

  const response = await api.post<ResetPasswordResponse>(
    "/auth/reset-password",
    payload,
  );

  return response.data;
}

// =====================================================
// CURRENT SESSION API
// GET /api/v1/auth/me
// =====================================================

export async function getSessionApi(signal?: AbortSignal): Promise<AuthSession> {
  const response = await api.get<AuthSession>("/auth/me", { signal });

  return response.data;
}

// =====================================================
// LOGOUT API
// POST /api/v1/auth/logout
// =====================================================

export async function logoutApi(authorization: string): Promise<void> {
  // Local auth is already cleared; revoke the captured session explicitly.
  await api.post("/auth/logout", undefined, { headers: { Authorization: authorization } });
}
