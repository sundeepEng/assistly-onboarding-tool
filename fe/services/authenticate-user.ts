import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
import { useRouter } from "next/router";
import { decodeJwtToken } from "../utils/auth";
import { userSignUpPath } from "../utils/constants";
export interface loginUserType {
  email: string;
  password: string;
}

const authenticateUser = async (payload: any) => {
  const { userData, path } = payload;
  const token = Cookies.get("idToken");
  const headers: any = {
    "Content-Type": "application/json",
  };
  if (path === userSignUpPath) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL}${path}`,
      userData,
      {
        headers,
      }
    );

    if (response.status == 200) {
      const cookies = response?.data?.cookies;
      if (cookies) {
        saveAuthTokenToCookie(cookies);
      }
      return response;
    }
  } catch (error) {
    throw error;
  }
};
const getAuthTokenFromCookie = (cookieString: string): string | null => {
  if (!cookieString) return null;

  const match = cookieString.match(/Authorization=([^;]+)/);

  return match ? match[1] : null;
};

const saveAuthTokenToCookie = (cookies: {idToken:string,userId:string,homeId:string,accessToken:string}) => {
  const { idToken,homeId,userId,accessToken} = cookies;
  const role = decodeJwtToken(idToken);
  Cookies.set("idToken", idToken, {
    expires: 1,
    secure: true,
    sameSite: "Strict",
  });
  Cookies.set("accessToken", accessToken, {
    expires: 1,
    secure: true,
    sameSite: "Strict",
  });
  Cookies.set("userId", userId, {
    expires: 1,
    secure: true,
    sameSite: "Strict",
  });
  Cookies.set("homeId", homeId, {
    expires: 1,
    secure: true,
    sameSite: "Strict",
  });
};

const useAuthenticateUser = () => {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: { userData: any; path: string }) =>
      authenticateUser(payload),
  });
};

export default useAuthenticateUser;
