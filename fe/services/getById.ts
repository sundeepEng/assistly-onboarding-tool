import { useQuery } from '@tanstack/react-query'
import axios, { AxiosError } from 'axios'
import Cookies from 'js-cookie'

export const fetchById = async (payload: {id:string,path:string}) => {
  const{id,path}=payload
  const token = Cookies.get('idToken')
  try {
    const response = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}${path}/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }
    })
    return response?.data?.user||response?.data
  } catch (error) {
    const e = error as AxiosError<any>
    console.error('Error fetching data:', e.response?.data || e.message)
    throw error
  }
}

const useGetById = ({ key, payload }: { key: string; payload: {id:string,path:string,enabled?:boolean} }) => {
  const{id,path,enabled}=payload
  return useQuery({
    queryKey: [key, id,path],
    queryFn: () => fetchById(payload),
    enabled
  })
}

export default useGetById




export const fetchByIdTeamCommunication = async (payload: {path:string}) => {
  const{path}=payload
  const token = Cookies.get('idToken')
  try {
    const response = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
    return response?.data?.user||response?.data
  } catch (error) {
    console.error('Error fetching user data:', error)
    throw error
  }
}

const useGetByIdTeamCommunication = ({ key, payload }: { key: string; payload: {path:string,enabled?:boolean} }) => {
  const{path,enabled}=payload
  return useQuery({
    queryKey: [key, path],
    queryFn: () => fetchByIdTeamCommunication(payload),
    enabled
  })
}

export { useGetByIdTeamCommunication }