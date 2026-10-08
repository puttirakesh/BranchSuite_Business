import axios from "axios";
import { api } from "./api";
import { loginSchema, sessionSchema } from "../types";
import type { LoginPortal } from "./demo";

export type TenantOption = { id: string; name: string };
export async function listTenants(): Promise<TenantOption[]> {
  const { data } = await api.get<TenantOption[]>("/auth/tenants");
  return data;
}
export async function signIn(
  tenantId: string,
  email: string,
  password: string,
  portal: LoginPortal,
) {
  const { data } = await api.post("/auth/login", {
    tenantId,
    email,
    password,
    loginType: portal === "employee" ? "EMPLOYEE" : "BUSINESS",
  });
  const result = loginSchema
    .extend({ refreshToken: loginSchema.shape.accessToken })
    .parse(data);
  return result;
}
export async function renew(refreshToken: string) {
  const { data } = await axios.post(
    `${process.env.EXPO_PUBLIC_API_URL}/auth/refresh`,
    { refreshToken },
  );
  return loginSchema
    .extend({ refreshToken: loginSchema.shape.accessToken })
    .parse(data);
}
export async function currentSession() {
  return sessionSchema.parse((await api.get("/auth/me")).data);
}
export async function forgotPassword(tenantId: string, email: string) {
  await api.post("/auth/forgot-password", { tenantId, email });
}
export async function resetPassword(token: string, newPassword: string) {
  await api.post("/auth/reset-password", { token, newPassword });
}
