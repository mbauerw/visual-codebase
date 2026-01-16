import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, AlertCircle, Lock } from 'lucide-react'
import { supabase } from '../config/supabase'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isValidPassword, setIsValidPassword] = useState(false)

  // Check if we have a valid session from the reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        setError(
          'Invalid or expired reset link. Please request a new password reset.'
        )
      }
      setChecking(false)
    }

    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!isValidPassword) {
      setError('Password does not meet requirements')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(updateError.message)
      } else {
        setSuccess(true)
        // Redirect to home after 3 seconds
        setTimeout(() => {
          navigate('/')
        }, 3000)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-[#8FBCFA] animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#8FBCFA] to-[#6BA3F5] mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-600 mt-2">Enter your new password below</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Password Updated!
              </h2>
              <p className="text-gray-600 mb-4">
                Your password has been successfully reset.
              </p>
              <p className="text-sm text-gray-500">
                Redirecting you to the home page...
              </p>
            </div>
          ) : error && !password ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Link Expired
              </h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-gradient-to-r from-[#8FBCFA] to-[#6BA3F5] text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                Back to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="mb-4">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                  placeholder="Enter new password"
                  required
                  autoComplete="new-password"
                />
                <PasswordStrengthIndicator
                  password={password}
                  onValidationChange={(result) => setIsValidPassword(result?.valid ?? false)}
                />
              </div>

              <div className="mb-6">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-red-300 bg-red-50'
                      : confirmPassword && confirmPassword === password
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300'
                  }`}
                  placeholder="Confirm new password"
                  required
                  autoComplete="new-password"
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="mt-1.5 text-sm text-red-600">
                    Passwords do not match
                  </p>
                )}
                {confirmPassword && confirmPassword === password && (
                  <p className="mt-1.5 text-sm text-green-600">
                    Passwords match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !password ||
                  !confirmPassword ||
                  password !== confirmPassword ||
                  !isValidPassword
                }
                className="w-full py-3 bg-gradient-to-r from-[#8FBCFA] to-[#6BA3F5] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel and return home
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Remember your password?{' '}
          <button
            onClick={() => navigate('/')}
            className="text-[#8FBCFA] hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
