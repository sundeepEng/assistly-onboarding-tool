import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";

const createHome = async (body: any) => {
  const token = Cookies.get("accessToken") || Cookies.get("idToken");
  return axios.post(`${process.env.NEXT_PUBLIC_SIGNUP_URL}`, body, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

const useCreateHome = () => {
  return useMutation({ mutationFn: createHome });
};

export default useCreateHome;
