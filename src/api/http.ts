import axios from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://tartness-empathy-gambling.ngrok-free.dev',
  timeout: 10000,
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

