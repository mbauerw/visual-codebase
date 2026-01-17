import { useState, useEffect } from 'react'
import { X, Loader2, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  initialTab?: number
}

export function AuthModal({ open, onClose, initialTab = 0 }: AuthModalProps) {
  const { signIn, signUp, resetPassword, signInWithGitHub, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState(initialTab) // 0 = Sign In, 1 = Sign Up, 2 = Reset Password
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (tab === 0) {
        const { error } = await signIn(email, password)
        if (error) {
          setMessage({ type: 'error', text: error.message })
        } else {
          setMessage({ type: 'success', text: 'Successfully signed in!' })
          onClose()
        }
      } else if (tab === 1) {
        const { error } = await signUp(email, password, fullName)
        if (error) {
          setMessage({ type: 'error', text: error.message })
        } else {
          setMessage({ type: 'success', text: 'Check your email for confirmation!' })
        }
      } else if (tab === 2) {
        const { error } = await resetPassword(email)
        if (error) {
          setMessage({ type: 'error', text: error.message })
        } else {
          setMessage({ type: 'success', text: 'Password reset email sent!' })
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    setGithubLoading(true)
    setMessage(null)

    try {
      const { error } = await signInWithGitHub()
      if (error) {
        setMessage({ type: 'error', text: error.message })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to initiate GitHub sign in' })
    } finally {
      setGithubLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setMessage(null)

    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setMessage({ type: 'error', text: error.message })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to initiate Google sign in' })
    } finally {
      setGoogleLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setMessage(null)
  }

  const handleTabChange = (newTab: number) => {
    setTab(newTab)
    resetForm()
  }

  useEffect(() => {
    if (open) {
      setTab(initialTab)
    }
  }, [open, initialTab])

  if (!open) return null

  const tabs = [
    { id: 0, label: 'Sign In' },
    { id: 1, label: 'Sign Up' },
    { id: 2, label: 'Reset Password' },
  ]

  const getTitle = () => {
    switch (tab) {
      case 0: return 'Welcome Back'
      case 1: return 'Create Account'
      case 2: return 'Reset Password'
      default: return 'Authentication'
    }
  }

  const getSubtitle = () => {
    switch (tab) {
      case 0: return 'Sign in to access your analyses'
      case 1: return 'Join to save and manage your analyses'
      case 2: return 'Enter your email to reset your password'
      default: return ''
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{getTitle()}</h2>
              <p className="text-gray-600 mt-1 text-sm">{getSubtitle()}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={24} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-full mb-6">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-all ${
                    tab === t.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Message */}
            {message && (
              <div
                className={`flex items-center gap-3 p-4 rounded-2xl mb-6 ${
                  message.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}
              >
                {message.type === 'error' ? (
                  <AlertCircle size={20} className="flex-shrink-0" />
                ) : (
                  <CheckCircle size={20} className="flex-shrink-0" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {tab !== 2 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600/90 hover:bg-blue-500/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-full font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Please wait...</span>
                  </>
                ) : (
                  tab === 0 ? 'Sign In' : tab === 1 ? 'Create Account' : 'Send Reset Link'
                )}
              </button>
            </form>

            {/* OAuth - Show on Sign In and Sign Up tabs */}
            {(tab === 0 || tab === 1) && (
              <>
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-sm text-gray-500">or continue with</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="flex gap-3">
                  {/* Google */}
                  <button
                    type="button"
                    disabled={googleLoading}
                    onClick={handleGoogleSignIn}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white border border-gray-200 rounded-full font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {googleLoading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <svg height="20" width="20" viewBox="0 0 24 24">
                        <path
                          fill="#4285f4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34a853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#fbbc05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#ea4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    )}
                    <span>Google</span>
                  </button>

                  {/* GitHub */}
                  <button
                    type="button"
                    disabled={githubLoading}
                    onClick={handleGitHubSignIn}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 border border-gray-900 rounded-full font-medium text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {githubLoading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                    )}
                    <span>GitHub</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
