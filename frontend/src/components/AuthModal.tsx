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
  const { signIn, signUp, resetPassword } = useAuth()
  const [tab, setTab] = useState(initialTab) // 0 = Sign In, 1 = Sign Up, 2 = Reset Password
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
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
      </DialogContent>
    </Dialog>
  )
}