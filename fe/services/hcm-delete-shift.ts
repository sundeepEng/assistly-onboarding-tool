// hooks/useDeleteShift.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";

const deleteShift = async (id: string) => {
  const token = Cookies.get("idToken");
  const response = await axios.delete(`${process.env.NEXT_PUBLIC_BASE_URL}/v1/hcm/shift/${id}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const useDeleteShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
};

export default useDeleteShift;
