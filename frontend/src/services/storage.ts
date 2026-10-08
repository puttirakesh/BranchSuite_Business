import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { LoginPortal } from "./demo";
const accessKey = "branchsuite.access-token";
const refreshKey = "branchsuite.refresh-token";
const portalKey = "branchsuite.login-portal";
async function get(key: string): Promise<string | null> {
  return Platform.OS === "web"
    ? typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function put(key: string, value: string | null) {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined")
      value
        ? sessionStorage.setItem(key, value)
        : sessionStorage.removeItem(key);
  } else if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}
export async function readToken() {
  return get(accessKey);
}
export async function writeToken(token: string | null) {
  await put(accessKey, token);
}
export async function readRefreshToken() {
  return get(refreshKey);
}
export async function writeRefreshToken(token: string | null) {
  await put(refreshKey, token);
}
export async function readLoginPortal(): Promise<LoginPortal> {
  return (await get(portalKey)) === "employee" ? "employee" : "staff";
}
export async function writeLoginPortal(portal: LoginPortal) {
  await put(portalKey, portal);
}
export async function clearAuthStorage() {
  await Promise.all([
    put(accessKey, null),
    put(refreshKey, null),
    put(portalKey, null),
  ]);
}
