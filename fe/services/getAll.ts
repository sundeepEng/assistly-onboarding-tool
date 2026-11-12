import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
interface fetchUserDataType{
    userType?:string
    homeId?:string
    milestone?:string
    userId?:string
    home_id?:string
    pcg_user_id?:string
    pcho_user_id?:string
    billing_period?: string
    status?: string | string[]
    transaction_date?: string | string[]
    start_date?: string
    end_date?: string
    isReferredByUserId?: string | string[]
    [key: string]: any
}
const fetchUserData = async (payload: { params?: fetchUserDataType; path: string }) => {
    const token = Cookies.get("idToken");
    const { path, params } = payload;

    try {
        const response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}${path}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                ...(params ? { params, paramsSerializer: { indexes: null } } : {}), // conditionally add `params`
            }
        );
        return response?.data;
    } catch (error) {
        throw error;
    }
};

const useGetAll = (payload: { key: string; params?: fetchUserDataType; path: string; enabled?: boolean }) => {
    const { key, params, path, enabled } = payload;
    return useQuery({
        queryKey: [key, params ?? null], // include null to avoid key shifting
        queryFn: () => fetchUserData({ params, path }),
        enabled,
    });
};

export default useGetAll;

