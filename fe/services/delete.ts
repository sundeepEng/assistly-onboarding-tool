import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
import { userRoles } from "../utils/constants";

const deleteUser = async (payload: any) => {
  const { id, path } = payload;
  const token = Cookies.get("idToken");
  try {
    const response = await axios.delete(
      `${process.env.NEXT_PUBLIC_BASE_URL}${path}/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
const useDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: any; path: string }) => deleteUser(payload),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: [userRoles.LEAD] });
      queryClient.refetchQueries({ queryKey: ["userId"] });
      queryClient.refetchQueries({ queryKey: ["team member"] });
      queryClient.refetchQueries({ queryKey: ["user"] });
      queryClient.refetchQueries({ queryKey: [userRoles.SENIOR] });
      queryClient.refetchQueries({ queryKey: [userRoles.REFERRAL] });
      queryClient.refetchQueries({ queryKey: [userRoles.NURSE] });
      queryClient.refetchQueries({ queryKey: [userRoles.NURSELEAD] });
      queryClient.refetchQueries({ queryKey: [userRoles.PCG] });
      queryClient.refetchQueries({ queryKey: [userRoles.COMPLIANCE_GUEST] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-daily-tracking"] });
    },
  });
};

export default useDelete;
 