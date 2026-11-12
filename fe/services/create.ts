import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isEmbedded } from '../utils/gia/embed'
import axios from 'axios'
import Cookies from "js-cookie";
import { BROADCAST, userRoles } from '../utils/constants';
import { SupportRequest } from '../model/support/support.model';

export interface createUserType {
  home?: string
  role?: 'PCHO' | 'Nurse' | 'PCG' | 'Senior' | 'Lead' | string
  name?: string // User's full name
  email?: string // User's email address (must be valid email format)
  mobile?: number // User's mobile number
  address?: string // Optional address
  tour_scheduled?: 'yes' | 'no' // Optional tour scheduled field
  tour_date_time?: string // Optional tour date-time (must be a valid datetime string)
  milestone?: 'initial contact' | 'tour' | 'onboarding' | 'contract' | string // Optional milestone status
  created_at?: string // Timestamp when the user was created (must be a valid datetime string)
  updated_at?: string // Optional timestamp when the user was last updated
}

const create = async (payload) => {
  const token = Cookies.get("idToken");
  const{userData,path}=payload
  try {
    const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}${path}`, userData, {
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${token}`,
      }
    })

    if (response.status === 202 || response.status === 201 || response.status === 200) {
      if (isEmbedded()) {
        const recordId =
          response?.data?.userId ||
          response?.data?.id ||
          response?.data?.user?.id ||
          null;
        window.dispatchEvent(
          new CustomEvent("assistly:record-saved", {
            detail: { entity: userData?.role ?? null, record_id: recordId },
          })
        );
      }
      return response
    } else {
      throw new Error('Failed to create user')
    }
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
}
}

const useCreate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload:{userData: createUserType|any,path:string}) => create(payload),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: [userRoles.LEAD] })
      queryClient.invalidateQueries({ queryKey: [userRoles.REFERRAL] })
      queryClient.invalidateQueries({ queryKey: [userRoles.SENIOR] })
      queryClient.invalidateQueries({ queryKey: [userRoles.PCG] })
      queryClient.invalidateQueries({ queryKey: [BROADCAST]})
      queryClient.invalidateQueries({ queryKey: [userRoles.COMPLIANCE_GUEST] })
      queryClient.invalidateQueries({ queryKey: [userRoles.NURSELEAD] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['budget'] })
      queryClient.invalidateQueries({ queryKey: ['salesMetrics'] })
      queryClient.invalidateQueries({ queryKey: ['salesMetricsDirector'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-daily-tracking'] })
    },
    onError: error => {
      console.error('Error in user creation:', error)
    }
  })
}

export default useCreate
