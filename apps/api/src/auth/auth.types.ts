export type AuthUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'CUSTOMER' | 'ADMIN'
  createdAt: Date
}

declare global {
  namespace Express {
    interface Request {
      authUser?: Pick<AuthUser, 'id' | 'role'>
    }
  }
}