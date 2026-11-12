// hooks/useGetShiftById.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";

const getShiftById = async (id: string) => {
  const token = Cookies.get("idToken");
  const response = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}/v1/hcm/shift/${id}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const useGetShiftById = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ["shift", id],
    queryFn: () => getShiftById(id),
    enabled,
  });
};

export default useGetShiftById;
