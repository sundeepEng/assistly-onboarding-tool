import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import Cookies from "js-cookie"
import { TEAM_COMMUNICATION } from "../utils/constants"

const upsert=async(payload:any)=>{
    const token=Cookies.get("idToken")
    const{data,path}=payload
    const response=axios.put(
        `${process.env.NEXT_PUBLIC_BASE_URL}${path}`,
        data,
        {
            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${token}`
            }
        }
    )
    return response;
}
const useUpsert=()=>{
    const queryClient=useQueryClient();
    return useMutation({
        mutationFn:(payload:{data:any,path:string})=>upsert(payload),
        onSuccess:()=>{
            queryClient.invalidateQueries({queryKey:["team member"]})
            queryClient.invalidateQueries({ queryKey: ['user'] })
            queryClient.invalidateQueries({ queryKey: ['compliance'] })
            queryClient.invalidateQueries({ queryKey: ['home'] })
            queryClient.invalidateQueries({ queryKey: [TEAM_COMMUNICATION] })
        }
    })
}

export default useUpsert