import axios, { AxiosError, type AxiosInstance } from "axios";
import { env } from "../config/env";
import { AppError, notConfigured } from "./api-error";

type TokenGetter = () => string | null;
let getToken: TokenGetter = () => null;
let onUnauthorized: () => void = () => {};

/** Called once by AuthProvider so the client can attach tokens and report session expiry. */
export function configureHttp(options: {
  getToken: TokenGetter;
  onUnauthorized: () => void;
}) {
  getToken = options.getToken;
  onUnauthorized = options.onUnauthorized;
}

let instance: AxiosInstance | null = null;

function client(): AxiosInstance {
  if (!env.apiUrl) throw notConfigured();
  if (!instance) {
    instance = axios.create({
      baseURL: env.apiUrl + env.apiPrefix,
      timeout: env.requestTimeoutMs,
      headers: { "Content-Type": "application/json" },
    });
    instance.interceptors.request.use((config) => {
      const token = getToken();
      if (token) config.headers.set("Authorization", "Bearer " + token);
      return config;
    });
  }
  return instance;
}

/** Converts transport failures into AppError with a message a person can act on. */
export function normalizeError(error: unknown, endpoint: string): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const body = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const list = Array.isArray(body?.message) ? body.message : undefined;
    const serverMessage = list
      ? list[0]
      : (body?.message as string | undefined);
    if (!error.response)
      return new AppError(
        "network",
        "Could not reach the server. Check your connection and try again.",
        { endpoint },
      );
    if (status === 401) {
      onUnauthorized();
      return new AppError(
        "unauthorized",
        "Your session has ended. Sign in again.",
        { endpoint, status },
      );
    }
    if (status === 403)
      return new AppError(
        "forbidden",
        "Your role does not have access to this.",
        { endpoint, status },
      );
    if (status === 404)
      return new AppError(
        "not_found",
        serverMessage ?? "This record no longer exists.",
        { endpoint, status },
      );
    if (status === 400 || status === 422)
      return new AppError(
        "validation",
        serverMessage ?? "Some fields need attention.",
        { endpoint, status, fieldErrors: list },
      );
    if (status === 409)
      return new AppError(
        "conflict",
        serverMessage ?? "This record changed. Reload and try again.",
        { endpoint, status },
      );
    return new AppError(
      "server",
      "The server could not complete this request. Try again shortly.",
      { endpoint, status },
    );
  }
  return new AppError(
    "unknown",
    error instanceof Error ? error.message : "Unexpected error",
    { endpoint },
  );
}

async function call<T>(
  method: "get" | "post" | "patch",
  url: string,
  body?: unknown,
  params?: object,
): Promise<T> {
  try {
    const response = await client().request<T>({
      method,
      url,
      data: body,
      params,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, method.toUpperCase() + " " + url);
  }
}

export const http = {
  get: <T>(url: string, params?: object) =>
    call<T>("get", url, undefined, params),
  post: <T>(url: string, body?: unknown) => call<T>("post", url, body),
  patch: <T>(url: string, body?: unknown) => call<T>("patch", url, body),
};
