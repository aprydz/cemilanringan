import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { loginAccount, logoutAccount, refreshAccount, registerAccount, type UserProfile } from './api'
import { setAccessToken } from '../../lib/api'

type AuthContextValue = {
  user: UserProfile | null
  loading: boolean
  signIn: (input: { email: string; password: string }) => Promise<UserProfile>
  signUp: (input: { name: string; email: string; password: string; phone?: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshStarted = useRef(false)

  useEffect(() => {
    if (refreshStarted.current) return
    refreshStarted.current = true

    refreshAccount()
      .then(({ user: refreshedUser, accessToken }) => {
        setAccessToken(accessToken)
        setUser(refreshedUser)
      })
      .catch(() => {
        setAccessToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const signIn = async (input: { email: string; password: string }) => {
    const result = await loginAccount(input)
    setAccessToken(result.accessToken)
    setUser(result.user)
    return result.user
  }

  const signUp = async (input: { name: string; email: string; password: string; phone?: string }) => {
    const result = await registerAccount(input)
    setAccessToken(result.accessToken)
    setUser(result.user)
  }

  const signOut = async () => {
    try {
      await logoutAccount()
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}