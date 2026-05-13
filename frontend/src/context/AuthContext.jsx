import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Fetch profile from DB ─────────────────────────────────────────────────
  const fetchProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from('users').select('*').eq('id', userId).single()
      setProfile(data ?? null)
      return data ?? null
    } catch {
      setProfile(null)
      return null
    }
  }

  // ── Initial boot ──────────────────────────────────────────────────────────
  // getSession reads from localStorage — fast, no network.
  // We await fetchProfile here so loading=false only fires AFTER profile ready.
  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) await fetchProfile(u.id)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // !! IMPORTANT: Do NOT use async/await inside onAuthStateChange.
    // Supabase SDK waits for the handler to complete before releasing its
    // internal lock. If the handler awaits a Supabase query, it deadlocks.
    // Instead: fire-and-forget (no await) for background updates.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') return  // handled by getSession above

        const u = session?.user ?? null
        setUser(u)
        if (u) {
          fetchProfile(u.id) // fire-and-forget — no await, no deadlock
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── login: used by Login.jsx ──────────────────────────────────────────────
  // Signs in + immediately sets user & profile in context so ProtectedRoute
  // never sees null profile after navigate().
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setUser(data.user)
    // fetchProfile here is OUTSIDE onAuthStateChange — no deadlock
    const p = await fetchProfile(data.user.id)
    return { session: data.session, profile: p }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user) return await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
