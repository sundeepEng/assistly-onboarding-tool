import { useQuery } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import Cookies from "js-cookie";
import { shiftsPath } from "../utils/constants";


// Define the params type for shifts API
interface ShiftParams {
  user_id?: string|string[];
  shift_start_time?: string; // ISO date string
  shift_end_time?: string; // ISO date string
  clock_in_timestamp?: string; // ISO date string
  clock_out_timestamp?: string; // ISO date string
  shift_status?: string; // e.g., "approved", "pending", etc.
  // Add more optional params if needed
}


// Axios fetch function
const fetchShifts = async (params: Record<string, string | string[]>, path: string) => {
    const token = Cookies.get("idToken");

    try {
        const response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}${path}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                params,
                // Custom serializer to support duplicate keys
                paramsSerializer: (params) => {
                    const searchParams = new URLSearchParams();
                    Object.entries(params).forEach(([key, value]) => {
                        if (Array.isArray(value)) {
                            value.forEach((v) => searchParams.append(key, v));
                        } else {
                            searchParams.append(key, value);
                        }
                    });
                    return searchParams.toString();
                },
            }
        );
        return response?.data;
    } catch (error) {
        const e = error as AxiosError<any>
        console.error('Error fetching shifts:', e.response?.data || e.message)
        throw error;
    }
};

const useGetAllShifts = ({
  key,
  params,
  enabled = true,
  path = shiftsPath,
}: {
  key?: string;
  params?: Record<string, string | string[]>;
  enabled?: boolean;
  path?: string;
}) => {
  return useQuery({
    queryKey: [key, params],
    queryFn: () => {
      if (!params) {
        throw new Error("Missing params for shifts query");
      }
      return fetchShifts(params, path);
    },
    enabled: Boolean(enabled && params),
  });
};

export default useGetAllShifts;

 