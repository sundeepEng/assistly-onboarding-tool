import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import Cookies from "js-cookie";

// API endpoint
const hcmCreateShift = '/v1/hcm/shift';

type BackendError = {
  message?: string;
  error?: string;
  errors?: any;
};

const createShift = async (shiftData: any) => {
  const token = Cookies.get("idToken");
  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL}${hcmCreateShift}`,
      shiftData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      }
    );

    if (response.status === 201) {
      return response;
    } else {
      throw new Error('Failed to create shift');
    }
  } catch (error) {
    const e = error as AxiosError<BackendError>
    console.log('Error creating shift:', e)
    throw error;
  }
};

// Custom hook for creating a shift
const useCreateShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shiftData: any) => createShift(shiftData),
    onSuccess: () => {
      // Update this to a relevant query key if needed
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },

    onError: (error: unknown) => {
      console.error("Error in shift creation:", (error as any)?.message ?? error);
    },
  });
};

export default useCreateShift;