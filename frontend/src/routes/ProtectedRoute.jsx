import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()

  // Auth initializing (getSession reading localStorage, ~100ms)
  if (loading) return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#F9E4D4,#FDF6EC,#D4EDD4)',
      fontSize: '1rem', color: '#94A3B8',
    }}>
      ⏳ Memuat...
    </div>
  )

  // Not logged in
  if (!user) return <Navigate to="/login" replace />

  // Account needs admin approval or was rejected -> ALWAYS KICK TO LOGIN FIRST
  if (profile?.status === 'pending' || profile?.status === 'rejected') {
    return <Navigate to="/login" replace />
  }

  // User is ACTIVE, but profile data is missing or incomplete (missing phone) -> Complete it!
  if (!profile || !profile.phone) {
    return <Navigate to="/complete-profile" replace />
  }

  // Route requires specific role
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/login" replace />
  }

  return children
}
