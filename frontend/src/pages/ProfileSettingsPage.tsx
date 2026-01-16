import { useState, useEffect } from 'react'
import {
  X,
  User,
  Shield,
  Settings,
  AlertTriangle,
  Loader2,
  Check,
  Camera,
  Eye,
  EyeOff,
  Download,
  Trash2,
  GitBranch,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  requestDataExport,
  type UserProfile,
  type PasswordValidationResult,
} from '../api/client'
import AccountDeletionModal from '../components/AccountDeletionModal'
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator'

interface ProfileSettingsPageProps {
  open: boolean
  onClose: () => void
}

type ActiveSection = 'profile' | 'security' | 'preferences' | 'danger'

export default function ProfileSettingsPage({ open, onClose }: ProfileSettingsPageProps) {
  const { user, authProvider } = useAuth()

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidationResult | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  // Preferences state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [defaultView, setDefaultView] = useState<'graph' | 'list'>('graph')

  // UI state
  const [activeSection, setActiveSection] = useState<ActiveSection>('profile')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // Load profile data
  useEffect(() => {
    if (user && open) {
      loadProfile()
    }
  }, [user, open])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const profileData = await getUserProfile()
      setProfile(profileData)

      // Initialize form values
      setDisplayName(profileData.display_name || '')
      setAvatarUrl(profileData.avatar_url || '')
      setTheme(profileData.preferences?.theme || 'system')
      setDefaultView(profileData.preferences?.default_view || 'graph')
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      await updateUserProfile({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })

      setSuccessMessage('Profile updated successfully')
      await loadProfile()
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      await updateUserProfile({
        preferences: {
          theme,
          default_view: defaultView,
        },
      })

      setSuccessMessage('Preferences saved')
      await loadProfile()
    } catch (err: any) {
      setError(err?.message || 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (!passwordValidation?.valid) {
      setPasswordError('Please meet all password requirements')
      return
    }

    try {
      setChangingPassword(true)
      setPasswordError(null)
      setPasswordSuccess(null)

      await changePassword(currentPassword, newPassword)

      setPasswordSuccess('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordValidation(null)
    } catch (err: any) {
      setPasswordError(err?.response?.data?.detail || err?.message || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleExportData = async () => {
    try {
      setExportLoading(true)
      await requestDataExport('full')
      setSuccessMessage('Data export requested. You will receive an email when ready.')
    } catch (err: any) {
      setError(err?.message || 'Failed to request data export')
    } finally {
      setExportLoading(false)
    }
  }

  const clearMessages = () => {
    setError(null)
    setSuccessMessage(null)
    setPasswordError(null)
    setPasswordSuccess(null)
  }

  if (!open) return null

  const isEmailAuth = authProvider === 'email'

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
          className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
              <p className="text-gray-600 mt-1">Manage your account and preferences</p>
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
          <div className="flex-1 overflow-hidden flex">
            {/* Sidebar Navigation */}
            <nav className="w-64 border-r border-gray-100 p-4 space-y-1">
              <button
                onClick={() => { setActiveSection('profile'); clearMessages(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === 'profile'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <User size={20} />
                Profile
              </button>
              <button
                onClick={() => { setActiveSection('security'); clearMessages(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === 'security'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Shield size={20} />
                Security
              </button>
              <button
                onClick={() => { setActiveSection('preferences'); clearMessages(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === 'preferences'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Settings size={20} />
                Preferences
              </button>
              <button
                onClick={() => { setActiveSection('danger'); clearMessages(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeSection === 'danger'
                    ? 'bg-red-600 text-white'
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <AlertTriangle size={20} />
                Danger Zone
              </button>
            </nav>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 size={32} className="animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {/* Success/Error Messages */}
                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                      {error}
                    </div>
                  )}
                  {successMessage && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-2">
                      <Check size={18} />
                      {successMessage}
                    </div>
                  )}

                  {/* Profile Section */}
                  {activeSection === 'profile' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h3>

                        {/* Avatar */}
                        <div className="flex items-center gap-6 mb-8">
                          <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#8FBCFA] to-[#FF9A9D] flex items-center justify-center text-white text-3xl font-bold">
                              {profile?.display_name?.[0]?.toUpperCase() ||
                                profile?.full_name?.[0]?.toUpperCase() ||
                                profile?.email?.[0]?.toUpperCase() ||
                                '?'}
                            </div>
                            <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-gray-200 hover:bg-gray-50 transition-colors">
                              <Camera size={16} className="text-gray-600" />
                            </button>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-lg">
                              {profile?.display_name || profile?.full_name || 'User'}
                            </p>
                            <p className="text-gray-500">{profile?.email}</p>
                            <div className="flex items-center gap-2 mt-2">
                              {authProvider === 'github' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                                  <GitBranch size={12} />
                                  GitHub
                                </span>
                              )}
                              {authProvider === 'google' && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full text-xs font-medium text-blue-600">
                                  Google
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Display Name */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="How you want to be called"
                            maxLength={50}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                          />
                          <p className="text-sm text-gray-500 mt-2">
                            This will be shown instead of your email in the app
                          </p>
                        </div>

                        {/* Save Button */}
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                        >
                          {saving ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Security Section */}
                  {activeSection === 'security' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-6">Security Settings</h3>

                        {/* Email Display */}
                        <div className="p-6 bg-gray-50 rounded-2xl mb-6">
                          <p className="text-sm font-medium text-gray-500 mb-1">Email Address</p>
                          <p className="text-gray-900 font-medium">{profile?.email}</p>
                        </div>

                        {/* Password Change (email auth only) */}
                        {isEmailAuth ? (
                          <div className="p-6 border border-gray-200 rounded-2xl">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h4>

                            {passwordError && (
                              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {passwordError}
                              </div>
                            )}
                            {passwordSuccess && (
                              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                                <Check size={16} />
                                {passwordSuccess}
                              </div>
                            )}

                            <div className="space-y-4">
                              {/* Current Password */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Current Password
                                </label>
                                <div className="relative">
                                  <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 pr-12 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  >
                                    {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                  </button>
                                </div>
                              </div>

                              {/* New Password */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  New Password
                                </label>
                                <div className="relative">
                                  <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 pr-12 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  >
                                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                  </button>
                                </div>
                                {newPassword && (
                                  <PasswordStrengthIndicator
                                    password={newPassword}
                                    onValidationChange={(result) => setPasswordValidation(result)}
                                  />
                                )}
                              </div>

                              {/* Confirm Password */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Confirm New Password
                                </label>
                                <input
                                  type="password"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                                />
                                {confirmPassword && newPassword !== confirmPassword && (
                                  <p className="text-red-500 text-sm mt-2">Passwords do not match</p>
                                )}
                              </div>

                              <button
                                onClick={handlePasswordChange}
                                disabled={
                                  changingPassword ||
                                  !currentPassword ||
                                  !newPassword ||
                                  !confirmPassword ||
                                  !passwordValidation?.valid ||
                                  newPassword !== confirmPassword
                                }
                                className="px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2"
                              >
                                {changingPassword ? (
                                  <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Changing...
                                  </>
                                ) : (
                                  'Change Password'
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 bg-gray-50 rounded-2xl">
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">Password</h4>
                            <p className="text-gray-600">
                              You signed in with {authProvider === 'github' ? 'GitHub' : 'Google'}.
                              Password is managed by your {authProvider === 'github' ? 'GitHub' : 'Google'} account.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preferences Section */}
                  {activeSection === 'preferences' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-6">Preferences</h3>

                        {/* Theme */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Theme
                          </label>
                          <div className="flex gap-3">
                            {(['light', 'dark', 'system'] as const).map((option) => (
                              <button
                                key={option}
                                onClick={() => setTheme(option)}
                                className={`px-4 py-2 rounded-xl font-medium transition-all capitalize ${
                                  theme === option
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Default View */}
                        <div className="mb-8">
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Default View
                          </label>
                          <div className="flex gap-3">
                            {(['graph', 'list'] as const).map((option) => (
                              <button
                                key={option}
                                onClick={() => setDefaultView(option)}
                                className={`px-4 py-2 rounded-xl font-medium transition-all capitalize ${
                                  defaultView === option
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleSavePreferences}
                          disabled={saving}
                          className="px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                        >
                          {saving ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Preferences'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Danger Zone */}
                  {activeSection === 'danger' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-xl font-semibold text-red-600 mb-6">Danger Zone</h3>

                        {/* Export Data */}
                        <div className="p-6 border border-gray-200 rounded-2xl mb-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900 mb-2">Export Your Data</h4>
                              <p className="text-gray-600 text-sm">
                                Download a copy of all your data including profile and analyses.
                              </p>
                            </div>
                            <button
                              onClick={handleExportData}
                              disabled={exportLoading}
                              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all flex items-center gap-2"
                            >
                              {exportLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Download size={18} />
                              )}
                              Export
                            </button>
                          </div>
                        </div>

                        {/* Delete Account */}
                        <div className="p-6 border border-red-200 bg-red-50 rounded-2xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-lg font-semibold text-red-600 mb-2">Delete Account</h4>
                              <p className="text-red-600 text-sm">
                                Permanently delete your account and all associated data.
                                This action has a 30-day grace period.
                              </p>
                            </div>
                            <button
                              onClick={() => setDeleteModalOpen(true)}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                            >
                              <Trash2 size={18} />
                              Delete Account
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Deletion Modal */}
      <AccountDeletionModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        userEmail={user?.email || ''}
      />
    </>
  )
}
