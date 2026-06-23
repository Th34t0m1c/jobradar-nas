import { useState, useCallback } from 'react'
import { AuthContext } from './authContext.js'
import { authApi, TOKEN_KEY } from '../api/client'

function isTokenValid(token) {
  if (!token) return false
  try {
    // JWT uses base64url (- and _ instead of + and /). atob() needs standard base64.
    const base64url = token.split('.')[1]
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
    const payload = JSON.parse(atob(padded))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!isTokenValid(token)) {
      if (token) localStorage.removeItem(TOKEN_KEY)
      return false
    }
    return true
  })

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    const token = res.data?.access_token
    if (!token) throw new Error('No token received from server')
    localStorage.setItem(TOKEN_KEY, token)
    // Full page reload guarantees token is in localStorage before any query fires
    window.location.href = '/dashboard'
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setIsAuthenticated(false)
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
