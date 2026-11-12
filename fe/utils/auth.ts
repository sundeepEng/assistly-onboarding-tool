import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import { ACCESS_TOKEN, ID_TOKEN, USER_ID } from "./constants";

export const getIdToken = () => {
  return Cookies.get("idToken");
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

export const checkAndCleanExpiredTokens = () => {
  const idToken = Cookies.get("idToken");
  const shouldRemove = isTokenExpired() || !idToken;
  if (shouldRemove) {
    Cookies.remove(ID_TOKEN);
    Cookies.remove(ACCESS_TOKEN);
    Cookies.remove(USER_ID);
    Cookies.remove("role");
    Cookies.remove("homeId");
    Cookies.remove("isSalesRequired");
  }
  return !shouldRemove;
};

export const useCookieListener = (cookieNames: string[], interval = 5000) => {
  const [isValidSession, setIsValidSession] = useState(
    checkAndCleanExpiredTokens
  );
  const [cookies, setCookies] = useState(() => {
    return cookieNames.reduce((acc, name) => {
      acc[name] = Cookies.get(name);
      return acc;
    }, {} as Record<string, string | undefined>);
  });

  useEffect(() => {
    const checkSession = () => {
      const sessionValid = checkAndCleanExpiredTokens();
      setIsValidSession(sessionValid);
    };

    const intervalId = setInterval(checkSession, interval);
    return () => clearInterval(intervalId);
  }, [cookies, cookieNames, interval]);

  return isValidSession;
};

export const getUserRoleFromToken = (): string | null => {
  const idToken = Cookies.get("idToken");
  if (!idToken) return null;

  try {
    const decoded: any = decodeJwtToken(idToken);
    return decoded["custom:role"] || null; // match your claim name
  } catch (err) {
    console.error("Invalid token", err);
    return null;
  }
};

export const getUserIdFromToken = (): string | null => {
  const userId = Cookies.get("userId");
  if (!userId) return null;
  else return userId;

  //TODO : Need to work on this later with backend

  //   try {
  //     const decoded: any = decodeJwtToken(idToken);
  //     return decoded["custom:userId"] || null; // match your claim name
  //   } catch (err) {
  //     console.error("Invalid token", err);
  //     return null;
  //   }
};

export const getHomeIdFromToken = (): string | null => {
  const homeId = Cookies.get("homeId");
  if (!homeId) return null;
  else return homeId;

  //TODO : Need to work on this later with backend

  //   try {
  //     const decoded: any = decodeJwtToken(idToken);
  //     return decoded["custom:homeId"] || null; // match your claim name
  //   } catch (err) {
  //     console.error("Invalid token", err);
  //     return null;
  //   }
};

export const getUserEmailFromToken = (): string | null => {
  const idToken = Cookies.get("idToken");
  if (!idToken) return null;

  try {
    const decoded: any = decodeJwtToken(idToken);
    return decoded?.email || decoded["cognito:username"] || null;
  } catch (err) {
    console.error("Invalid token", err);
    return null;
  }
};

export const setIsSalesRequiredInCookie = (isSalesRequired: boolean) => {
  try {
    Cookies.set("isSalesRequired", String(isSalesRequired), { expires: 7 });
  } catch (error) {
    console.error("Error setting isSalesRequired in cookie:", error);
  }
};

export const getIsSalesRequiredFromCookie = (): boolean | null => {
  try {
    const isSalesRequired = Cookies.get("isSalesRequired");
    if (isSalesRequired) {
      const parsed = isSalesRequired === "true";
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("Error getting isSalesRequired from cookie:", error);
    return null;
  }
};

export const removeIsSalesRequiredCookie = () => {
  Cookies.remove("isSalesRequired");
};
