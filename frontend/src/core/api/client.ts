
import axios from "axios";

// =====================================================
// API CONFIGURATION
// =====================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

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

export type SignupPlanId =
  | "starter"
  | "growth"
  | "scale";

export type SignupBillingCycle =
  | "monthly"
  | "annual";

export interface SignupRequest {
  businessName: string;
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
  message: string;
}

// =====================================================
// RESET PASSWORD TYPES
// =====================================================

export interface ResetPasswordRequest {
  token: string;
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
    api.defaults.headers.common.Authorization =
      `Bearer ${token}`;
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

export async function signupApi(
  data: SignupRequest
): Promise<SignupResponse> {
  const payload: SignupRequest = {
    businessName: data.businessName.trim(),
    ownerName: data.ownerName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    password: data.password,
    planId: data.planId,
    billingCycle: data.billingCycle,
  };

  const response = await api.post<SignupResponse>(
    "/auth/signup",
    payload
  );

  return response.data;
}

// =====================================================
// LOGIN API
// POST /api/v1/auth/login
// =====================================================

export async function loginApi(
  email: string,
  password: string,
  portal: LoginPortal
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    "/auth/login",
    {
      email: email.trim().toLowerCase(),
      password,
      portal,
    }
  );

  return response.data;
}

// =====================================================
// FORGOT PASSWORD API
// POST /api/v1/auth/forgot-password
// =====================================================

export async function forgotPasswordApi(
  email: string
): Promise<ForgotPasswordResponse> {
  const payload: ForgotPasswordRequest = {
    email: email.trim().toLowerCase(),
  };

  const response = await api.post<ForgotPasswordResponse>(
    "/auth/forgot-password",
    payload
  );

  return response.data;
}

// =====================================================
// RESET PASSWORD API
// POST /api/v1/auth/reset-password
// =====================================================

export async function resetPasswordApi(
  data: ResetPasswordRequest
): Promise<ResetPasswordResponse> {
  const payload: ResetPasswordRequest = {
    token: data.token.trim(),
    newPassword: data.newPassword,
    confirmPassword: data.confirmPassword,
  };

  const response = await api.post<ResetPasswordResponse>(
    "/auth/reset-password",
    payload
  );

  return response.data;
}

// =====================================================
// CURRENT SESSION API
// GET /api/v1/auth/me
// =====================================================

export async function getSessionApi(): Promise<AuthSession> {
  const response = await api.get<AuthSession>(
    "/auth/me"
  );

  return response.data;
}

// =====================================================
// LOGOUT API
// POST /api/v1/auth/logout
// =====================================================

export async function logoutApi(): Promise<void> {
  await api.post("/auth/logout");
}
