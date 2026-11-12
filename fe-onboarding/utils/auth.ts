import Cookies from "js-cookie";
import { ACCESS_TOKEN, ID_TOKEN, USER_ID } from "./constants";

export const getIdToken = () => {
  return Cookies.get(ID_TOKEN);
};

export const decodeJwtToken = (token: string) => {
  try {
    const base64Url = token?.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch (error) {
    console.error("Error decoding JWT token:", error);
    return null;
  }
};

export const isTokenExpired = () => {
  const token = getIdToken();
  if (!token) return true;
  try {
    const decoded = decodeJwtToken(token);
    return !decoded?.exp || decoded.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true; // Invalid token counts as expired
  }
};

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;
const AUTH_COOKIES = [ID_TOKEN, ACCESS_TOKEN, USER_ID, "role", "homeId"];

export const clearAuthCookies = () => {
  const opts = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : undefined;
  AUTH_COOKIES.forEach((name) => Cookies.remove(name, opts));
  if (opts) AUTH_COOKIES.forEach((name) => Cookies.remove(name));
};

export const checkAndCleanExpiredTokens = () => {
  const idToken = Cookies.get(ID_TOKEN);
  const shouldRemove = isTokenExpired() || !idToken;
  if (shouldRemove) {
    clearAuthCookies();
  }
  return !shouldRemove;
};

export const getUserRoleFromToken = (): string | null => {
  const idToken = Cookies.get(ID_TOKEN);
  if (!idToken) return null;

  try {
    const decoded: any = decodeJwtToken(idToken);
    return decoded["custom:role"] || null; // match your claim name
  } catch (err) {
    console.error("Invalid token", err);
    return null;
  }
};

export const getUserEmailFromToken = (): string | null => {
  const idToken = Cookies.get(ID_TOKEN);
  if (!idToken) return null;

  try {
    const decoded: any = decodeJwtToken(idToken);
    return decoded?.email || decoded["cognito:username"] || null;
  } catch (err) {
    console.error("Invalid token", err);
    return null;
  }
};
