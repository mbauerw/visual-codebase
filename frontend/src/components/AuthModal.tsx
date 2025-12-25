import React, { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@mui/material'
import { Button, TextField, Alert, CircularProgress, Tabs, Tab, Box } from '@mui/material'
import { useAuth } from '../hooks/useAuth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  initialTab?: number
}

export function AuthModal({ open, onClose, initialTab = 0 }: AuthModalProps) {
  const { signIn, signUp, resetPassword, signInWithGitHub } = useAuth()
  const [tab, setTab] = useState(initialTab) // 0 = Sign In, 1 = Sign Up, 2 = Reset Password
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (tab === 0) {
        // Sign In
        const { error } = await signIn(email, password)
        if (error) {
          setMessage({ type: 'error', text: error.message })
        } else {
          setMessage({ type: 'success', text: 'Successfully signed in!' })
          onClose()
        }
      } else if (tab === 1) {
        // Sign Up
        const { error } = await signUp(email, password, fullName)
        if (error) {
          setMessage({ type: 'error', text: error.message })
        } else {
          setMessage({ type: 'success', text: 'Check your email for confirmation!' })
        }
      } else if (tab === 2) {
        // Reset Password
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
      // If successful, user will be redirected to GitHub OAuth flow
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to initiate GitHub sign in' })
    } finally {
      setGithubLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setMessage(null)
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue)
    resetForm()
  }

  // Update tab when initialTab prop changes
  React.useEffect(() => {
    if (open) {
      setTab(initialTab)
    }
  }, [open, initialTab])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <div>
        <DialogTitle>Authentication</DialogTitle>
      </div>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tab} onChange={handleTabChange}>
            <Tab label="Sign In" />
            <Tab label="Sign Up" />
            <Tab label="Reset Password" />
          </Tabs>
        </Box>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {tab === 1 && (
            <TextField
              fullWidth
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              margin="normal"
              required
            />
          )}
          
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
          />

          {tab !== 2 && (
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ mt: 3, mb: 2 }}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              tab === 0 ? 'Sign In' : tab === 1 ? 'Sign Up' : 'Reset Password'
            )}
          </Button>
        </form>

        {/* GitHub Sign In - Only show on Sign In tab */}
        {tab === 0 && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              <Box sx={{ px: 2, color: 'text.secondary', fontSize: '0.875rem' }}>OR</Box>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            </Box>

            <Button
              fullWidth
              variant="outlined"
              disabled={githubLoading}
              onClick={handleGitHubSignIn}
              sx={{
                mb: 2,
                textTransform: 'none',
                borderColor: '#24292e',
                color: '#24292e',
                '&:hover': {
                  backgroundColor: '#24292e',
                  color: 'white',
                  borderColor: '#24292e',
                },
              }}
              startIcon={
                githubLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                )
              }
            >
              Continue with GitHub
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}