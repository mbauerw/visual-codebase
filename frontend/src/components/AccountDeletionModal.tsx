import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import {
  requestAccountDeletion,
  getAccountDeletionStatus,
  cancelAccountDeletion,
  type AccountDeletionStatus,
} from '../api/client'

interface AccountDeletionModalProps {
  open: boolean
  onClose: () => void
  userEmail: string
}

export default function AccountDeletionModal({
  open,
  onClose,
  userEmail,
}: AccountDeletionModalProps) {
  const [step, setStep] = useState<'info' | 'confirm' | 'pending'>('info')
  const [reason, setReason] = useState('')
  const [exportData, setExportData] = useState(true)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'warning'
    text: string
  } | null>(null)
  const [deletionStatus, setDeletionStatus] =
    useState<AccountDeletionStatus | null>(null)

  // Check for existing deletion request on mount
  useEffect(() => {
    if (open) {
      checkDeletionStatus()
    }
  }, [open])

  const checkDeletionStatus = async () => {
    try {
      const status = await getAccountDeletionStatus()
      if (status) {
        setDeletionStatus(status)
        setStep('pending')
      } else {
        setStep('info')
        setDeletionStatus(null)
      }
    } catch (error) {
      console.error('Error checking deletion status:', error)
    }
  }

  const handleRequestDeletion = async () => {
    if (confirmEmail !== userEmail) {
      setMessage({ type: 'error', text: 'Email does not match' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await requestAccountDeletion(
        reason || undefined,
        exportData
      )
      setMessage({ type: 'success', text: response.message })
      setDeletionStatus({
        deletion_id: response.deletion_id,
        scheduled_deletion_at: response.scheduled_deletion_at,
        status: response.status,
        days_remaining: 30,
        can_cancel: true,
      })
      setStep('pending')
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error?.response?.data?.detail ||
          'Failed to request account deletion',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelDeletion = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await cancelAccountDeletion()
      setMessage({ type: 'success', text: response.message })
      setDeletionStatus(null)
      setStep('info')
      setConfirmEmail('')
      setReason('')
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error?.response?.data?.detail || 'Failed to cancel account deletion',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setMessage(null)
    setConfirmEmail('')
    onClose()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #FF9A9D 0%, #FFB7B9 100%)',
          color: '#4A1F1F',
          fontWeight: 600,
        }}
      >
        {step === 'pending' ? 'Deletion Pending' : 'Delete Account'}
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2, mt: 1 }}>
            {message.text}
          </Alert>
        )}

        {/* Info Step */}
        {step === 'info' && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                This action cannot be undone after the grace period.
              </Typography>
              <Typography variant="body2">
                Your account and all associated data will be permanently deleted
                after 30 days.
              </Typography>
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              What happens when you delete your account:
            </Typography>

            <Box
              component="ul"
              sx={{
                pl: 2,
                mb: 3,
                '& li': {
                  mb: 1,
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                },
              }}
            >
              <li>
                Your account enters a 30-day grace period where you can cancel
                deletion
              </li>
              <li>
                You will be logged out and unable to access your account during
                this period
              </li>
              <li>
                All your analyses and data will be permanently deleted after 30
                days
              </li>
              <li>This action is irreversible after the grace period ends</li>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={exportData}
                  onChange={(e) => setExportData(e.target.checked)}
                  sx={{
                    color: '#8FBCFA',
                    '&.Mui-checked': { color: '#8FBCFA' },
                  }}
                />
              }
              label={
                <Typography variant="body2">
                  Export my data before deletion (recommended)
                </Typography>
              }
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Reason for leaving (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Help us improve by sharing why you're leaving..."
              sx={{ mb: 3 }}
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={handleClose} variant="outlined" color="inherit">
                Cancel
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                variant="contained"
                sx={{
                  bgcolor: '#FF9A9D',
                  '&:hover': { bgcolor: '#E88A8D' },
                }}
              >
                Continue
              </Button>
            </Box>
          </Box>
        )}

        {/* Confirm Step */}
        {step === 'confirm' && (
          <Box>
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600}>
                Final Confirmation Required
              </Typography>
              <Typography variant="body2">
                Type your email address to confirm account deletion.
              </Typography>
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please type <strong>{userEmail}</strong> to confirm:
            </Typography>

            <TextField
              fullWidth
              label="Confirm Email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={userEmail}
              sx={{ mb: 3 }}
              autoComplete="off"
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setStep('info')}
                variant="outlined"
                color="inherit"
              >
                Back
              </Button>
              <Button
                onClick={handleRequestDeletion}
                variant="contained"
                disabled={loading || confirmEmail !== userEmail}
                sx={{
                  bgcolor: '#d32f2f',
                  '&:hover': { bgcolor: '#b71c1c' },
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Delete My Account'
                )}
              </Button>
            </Box>
          </Box>
        )}

        {/* Pending Step */}
        {step === 'pending' && deletionStatus && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Your account is scheduled for deletion
              </Typography>
              <Typography variant="body2">
                Permanent deletion on:{' '}
                {formatDate(deletionStatus.scheduled_deletion_at)}
              </Typography>
              <Typography variant="body2">
                Days remaining: {deletionStatus.days_remaining}
              </Typography>
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You can cancel the deletion and restore your account at any time
              during the grace period.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button onClick={handleClose} variant="outlined" color="inherit">
                Close
              </Button>
              {deletionStatus.can_cancel && (
                <Button
                  onClick={handleCancelDeletion}
                  variant="contained"
                  disabled={loading}
                  sx={{
                    bgcolor: '#4caf50',
                    '&:hover': { bgcolor: '#388e3c' },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Cancel Deletion & Restore Account'
                  )}
                </Button>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
