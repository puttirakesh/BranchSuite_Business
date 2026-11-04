import { endpoints, pendingEndpoints } from "../api/endpoints";
import { http } from "../api/client";
import { AppError, notConfigured, pendingIntegration } from "../api/api-error";
import { env } from "../config/env";
import { isRole } from "../permissions/roles";
import { previewDb } from "../data/previewStore";
import { PREVIEW_PASSWORD } from "../../fixtures/previewData";
import type { SessionUser } from "./auth.types";

interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  user: { id: string; name: string; email: string; role: string };
}

function toUser(raw: {
  id: string;
  name: string;
  email: string;
  role: string;
}): SessionUser {
  if (!isRole(raw.role))
    throw new AppError(
      "forbidden",
      "This account is not a platform administrator.",
    );
  return { id: raw.id, name: raw.name, email: raw.email, role: raw.role };
}

/** Real endpoints: backend/src/modules/platform/auth/platform-auth.controller.ts */
export const authService = {
  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: SessionUser }> {
    if (env.dataMode === "api") {
      const res = await http.post<LoginResponse>(endpoints.auth.login, {
        email,
        password,
      });
      return { token: res.accessToken, user: toUser(res.user) };
    }
    if (env.dataMode === "preview") {
      const account = previewDb().accounts.find(
        (a) => a.email === email.toLowerCase(),
      );
      if (!account || password !== PREVIEW_PASSWORD)
        throw new AppError("unauthorized", "Email or password is incorrect.");
      return { token: "preview-session", user: { ...account } };
    }
    throw notConfigured();
  },

  async me(): Promise<SessionUser> {
    return toUser(await http.get<SessionUser>(endpoints.auth.me));
  },

  async logout(): Promise<void> {
    if (env.dataMode === "api") await http.post(endpoints.auth.logout);
  },

  /** No password-recovery endpoint exists in the backend yet. */
  async requestPasswordReset(_email: string): Promise<void> {
    throw pendingIntegration(pendingEndpoints.forgotPassword);
  },

  async resetPassword(_code: string, _password: string): Promise<void> {
    throw pendingIntegration(pendingEndpoints.resetPassword);
  },
};
