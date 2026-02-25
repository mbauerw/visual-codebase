import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../config/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  githubToken: string | null
  authProvider: 'email' | 'github' | 'google' | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    githubToken: null,
    authProvider: null
  })

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
      }

      // Get GitHub token from session or localStorage fallback
      let githubToken = session?.provider_token || null
      if (!githubToken && session?.user) {
        // Fallback to localStorage if provider_token is not in session
        const storedToken = localStorage.getItem('github_provider_token')
        if (storedToken) {
          githubToken = storedToken
        }
      }

      // Detect auth provider
      const authProvider = (session?.user?.app_metadata?.provider as 'email' | 'github' | 'google') || null

      setAuthState({
        user: session?.user || null,
        session: session,
        loading: false,
        githubToken: githubToken,
        authProvider: authProvider
      })
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Get GitHub token from session or localStorage fallback
        let githubToken = session?.provider_token || null
        if (!githubToken && session?.user) {
          const storedToken = localStorage.getItem('github_provider_token')
          if (storedToken) {
            githubToken = storedToken
          }
        }

        // Clear stored tokens on sign out
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('github_provider_token')
          localStorage.removeItem('google_provider_token')
        }

        // Detect auth provider
        const authProvider = (session?.user?.app_metadata?.provider as 'email' | 'github' | 'google') || null

        setAuthState({
          user: session?.user || null,
          session: session,
          loading: false,
          githubToken: githubToken,
          authProvider: authProvider
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error }
  }

  const signInWithGitHub = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'public_repo read:user user:email',
      },
    })
    return { data, error }
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
    signInWithGitHub,
    signInWithGoogle
  }
}