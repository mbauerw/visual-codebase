import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../config/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  githubToken: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    githubToken: null
  })

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
      }

      // Debug logging
      console.log('Session:', session)
      console.log('Provider token:', session?.provider_token)
      console.log('Provider refresh token:', session?.provider_refresh_token)

      // Get GitHub token from session or localStorage fallback
      let githubToken = session?.provider_token || null
      if (!githubToken && session?.user) {
        // Fallback to localStorage if provider_token is not in session
        const storedToken = localStorage.getItem('github_provider_token')
        if (storedToken) {
          console.log('Using stored GitHub token from localStorage')
          githubToken = storedToken
        }
      }

      setAuthState({
        user: session?.user || null,
        session: session,
        loading: false,
        githubToken: githubToken
      })
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event)
        console.log('Session:', session)
        console.log('Provider token:', session?.provider_token)

        // Get GitHub token from session or localStorage fallback
        let githubToken = session?.provider_token || null
        if (!githubToken && session?.user) {
          const storedToken = localStorage.getItem('github_provider_token')
          if (storedToken) {
            console.log('Using stored GitHub token from localStorage')
            githubToken = storedToken
          }
        }

        // Clear stored token on sign out
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('github_provider_token')
        }

        setAuthState({
          user: session?.user || null,
          session: session,
          loading: false,
          githubToken: githubToken
        })
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signOut = async () => {
    // Clear stored GitHub token
    localStorage.removeItem('github_provider_token')
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  const signInWithGitHub = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'repo read:user user:email',
      },
    })
    return { data, error }
  }

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    resetPassword,
    signInWithGitHub
  }
}