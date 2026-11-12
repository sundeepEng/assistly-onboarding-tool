import axios from "axios";
import Cookies from "js-cookie";

export const fetchStripeByEmail = async (payload: {
  path: string;
  email: string;
}) => {
  const token = Cookies.get("idToken");
  const { path, email } = payload;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_BASE_URL env var.");
  }

  if (!token) {
    throw new Error("Unauthorized: No ID Token found.");
  }

  if (!email) {
    throw new Error("Missing email.");
  }

  const response = await axios.post(
    `${baseUrl}${path}`,
    { email },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response?.data;
};
