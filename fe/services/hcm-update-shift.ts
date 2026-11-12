// hooks/useUpdateShift.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie"; // Adjust import path as needed

const updateShift = async (data:any) => {
  const token = Cookies.get("idToken");
  const id = data.id;
  const response = await axios.put(
    `${process.env.NEXT_PUBLIC_BASE_URL}/v1/hcm/shift/${id}`,
    data,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};

const useUpdateShift = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:(data:any)=> updateShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
};

export default useUpdateShift;
