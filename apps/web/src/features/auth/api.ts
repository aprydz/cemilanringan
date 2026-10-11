import { api } from '../../lib/api'
import type { ApiResponse } from '../products/types'

export type UserProfile = {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'CUSTOMER' | 'ADMIN'
  createdAt: string
}

export type AuthData = { user: UserProfile; accessToken: string }
type AuthEnvelope = ApiResponse<AuthData>

export async function registerAccount(input: { name: string; email: string; password: string; phone?: string }) {
  const response = await api.post<AuthEnvelope>('/auth/register', input)
  return response.data.data
}

export async function loginAccount(input: { email: string; password: string }) {
  const response = await api.post<AuthEnvelope>('/auth/login', input)
  return response.data.data
}

export async function refreshAccount() {
  const response = await api.post<AuthEnvelope>('/auth/refresh', null)
  return response.data.data
}

export async function logoutAccount() {
  await api.post('/auth/logout')
}