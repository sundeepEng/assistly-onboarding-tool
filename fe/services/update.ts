import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Cookies from 'js-cookie'
import { ExtendedLead } from '../components/stage-popup'
import { userRoles } from '../utils/constants'

const update = async (payload: any) => {
  const { data, path } = payload
  const id = data?.userId || data?.homeId || data?.id
  const token = Cookies.get('idToken')
  try {
    const response = await axios.put(`${process.env.NEXT_PUBLIC_BASE_URL}${path}/${id}`, data, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })

    return response.data
  } catch (error) {
    throw error
  }
}
const useUpdate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { data: any; path: string }) => update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userId'] })
      queryClient.invalidateQueries({ queryKey: ['team member'] })
      queryClient.invalidateQueries({ queryKey: ['user']})
      queryClient.invalidateQueries({ queryKey: [userRoles.SENIOR] })
      queryClient.invalidateQueries({ queryKey: [userRoles.LEAD] })
      queryClient.invalidateQueries({ queryKey:  [userRoles.REFERRAL] })
      queryClient.invalidateQueries({ queryKey: [userRoles.PCG] })
      queryClient.invalidateQueries({ queryKey: [userRoles.NURSE] })
      queryClient.invalidateQueries({ queryKey: [userRoles.NURSELEAD] })
      queryClient.invalidateQueries({ queryKey: [userRoles.SALES_REPRESENTATIVE] })
      queryClient.invalidateQueries({ queryKey: [userRoles.SALES_DIRECTOR] })
      queryClient.invalidateQueries({ queryKey: ['SALES_DIRECTORS_FOR_ASSIGN'] })
      queryClient.invalidateQueries({ queryKey: ['SALES_REPS_FOR_ASSIGN'] })
      queryClient.invalidateQueries({ queryKey: ['SENIORS_FOR_ASSIGN'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-daily-tracking'] })
    }
  })
}

export default useUpdate

 