import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import { useState } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Skeleton className="h-24 w-full" />
  if (!user) return <Navigate to="/signin" replace state={{ from: location }} />
  return <>{children}</>
}

export function RoleRoute({ children, roles }: { children: ReactNode; roles: Array<'user' | 'moderator' | 'admin'> }) {
  const { user } = useAuth()
  const [forbidden] = useState(false)
  if (!user) return <Navigate to="/signin" replace />
  if (!roles.includes(user.role)) {
    // hide and handle as forbidden; UI shows error state (API 403 handled in pages too)
    return <ErrorState message="You do not have access to this page." />
  }
  if (forbidden) return <ErrorState message="Access denied." />
  return <>{children}</>
}