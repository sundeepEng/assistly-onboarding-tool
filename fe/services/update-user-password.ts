import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
import { updatePasswordPath } from "../utils/constants";

export interface UpdatePasswordDataType {
  body: { accessToken: string; oldPassword: string; newPassword: string };
  path: string;
  type: "UPDATE_PASSWORD";
}

export interface ResetPasswordType {
  body: { email: string };
  path: string;
  type: "FORGOT_PASSWORD";
}

export interface ConfirmResetPasswordType {
  body: { email: string; newPassword: string; confirmationCode: number };
  path: string;
  type: "CONFIRM_RESET_PASSWORD";
}

export interface ActivateAccountType {
  body: { email: string; password: string; confirmPassword: string };
  path: string;
  type: "ACTIVATE_ACCOUNT";
}

type PasswordPayload =
  | UpdatePasswordDataType
  | ResetPasswordType
  | ConfirmResetPasswordType
  | ActivateAccountType;

const updateUserPassword = async (payload: PasswordPayload) => {
  const { body, path, type } = payload;
  const idToken = Cookies.get("idToken");

  // Handle missing token
  if (!idToken && type === "UPDATE_PASSWORD") {
    console.error("No ID Token found, authentication required.");
    throw new Error("Unauthorized: No ID Token found.");
  }

  const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

  try {
    let response;

    if (type === "ACTIVATE_ACCOUNT") {
      // Activation uses POST
      response = await axios.post(`${baseURL}${path}`, body, {
        headers: { "Content-Type": "application/json" },
      });
    } else if (type === "UPDATE_PASSWORD") {
      // Update password uses PUT with Authorization
      response = await axios.put(`${baseURL}${path}`, body, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
    } else {
      // Reset & Confirm reset password use POST
      response = await axios.put(`${baseURL}${path}`, body, {
        headers: { "Content-Type": "application/json" },
      });
    }

    return response;
  } catch (error: any) {
    throw error.response?.data || error;
  }
};

const useUpdatePassword = () => {
  return useMutation({
    mutationFn: (data: PasswordPayload) => updateUserPassword(data),
  });
};

export default useUpdatePassword;
