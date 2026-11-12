import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";

export interface loginUserType {
  email: string;
  password: string;
}

// When set (e.g. ".assistly.live"), auth cookies are shared across sibling
// subdomains so embedded apps under the same site pick up the session.
// Leave unset on localhost — browsers reject Domain=... mismatched cookies.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

const cookieOptions: Cookies.CookieAttributes = {
  expires: 1,
  secure: true,
  sameSite: "Lax",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

const authenticateUser = async (payload: any) => {
  const { userData, path } = payload;
  const response = await axios.post(
    `${process.env.NEXT_PUBLIC_BASE_URL}${path}`,
    userData,
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  const cookies = response?.data?.cookies;
  if (cookies) {
    saveAuthTokenToCookie(cookies);
  }
  return response;
};

const saveAuthTokenToCookie = (cookies: {
  idToken: string;
  userId: string;
  homeId: string;
  accessToken: string;
}) => {
  const { idToken, homeId, userId, accessToken } = cookies;
  Cookies.set("idToken", idToken, cookieOptions);
  Cookies.set("accessToken", accessToken, cookieOptions);
  Cookies.set("userId", userId, cookieOptions);
  Cookies.set("homeId", homeId, cookieOptions);
};

const useAuthenticateUser = () => {
  return useMutation({
    mutationFn: (payload: { userData: any; path: string }) =>
      authenticateUser(payload),
  });
};

export default useAuthenticateUser;
