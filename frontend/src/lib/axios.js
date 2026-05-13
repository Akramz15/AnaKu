import axios from 'axios'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// Interceptor: otomatis sisipkan Bearer Token dari Supabase session
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Interceptor: global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.detail
              || error.response?.data?.message
              || 'Terjadi kesalahan. Silakan coba lagi.'

    if (error.response?.status !== 401) {
      toast.error(msg)
    }

    if (error.response?.status === 401) {
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api
