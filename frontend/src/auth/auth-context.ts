import { createContext } from 'react'
import type { User } from '../lib/api'

export type AuthState = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)