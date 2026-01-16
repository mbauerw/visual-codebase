import { useEffect, useState, useCallback } from 'react'
import { Box, Typography, LinearProgress } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import {
  validatePassword,
  getPasswordPolicy,
  type PasswordValidationResult,
  type PasswordPolicy,
} from '../api/client'

interface PasswordStrengthIndicatorProps {
  password: string
  onValidationChange?: (result: PasswordValidationResult | null) => void
}

export default function PasswordStrengthIndicator({
  password,
  onValidationChange,
}: PasswordStrengthIndicatorProps) {
  const [validation, setValidation] = useState<PasswordValidationResult | null>(
    null
  )
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch password policy on mount
  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const policyData = await getPasswordPolicy()
        setPolicy(policyData)
      } catch (error) {
        console.error('Error fetching password policy:', error)
      }
    }
    fetchPolicy()
  }, [])

  // Debounced validation
  const validatePasswordDebounced = useCallback(
    async (pwd: string) => {
      if (!pwd || pwd.length < 1) {
        setValidation(null)
        onValidationChange?.(null)
        return
      }

      setLoading(true)
      try {
        const result = await validatePassword(pwd)
        setValidation(result)
        onValidationChange?.(result)
      } catch (error) {
        console.error('Error validating password:', error)
        // Fallback to client-side validation
        const clientValidation = validateClientSide(pwd, policy)
        setValidation(clientValidation)
        onValidationChange?.(clientValidation)
      } finally {
        setLoading(false)
      }
    },
    [onValidationChange, policy]
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validatePasswordDebounced(password)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [password, validatePasswordDebounced])

  // Client-side validation fallback
  const validateClientSide = (
    pwd: string,
    pol: PasswordPolicy | null
  ): PasswordValidationResult => {
    const criteria: PasswordValidationResult['criteria'] = []
    let passCount = 0

    const minLength = pol?.min_length || 8

    // Length check
    const lengthPassed = pwd.length >= minLength
    criteria.push({
      criterion: 'length',
      passed: lengthPassed,
      message: `At least ${minLength} characters`,
    })
    if (lengthPassed) passCount++

    // Uppercase check
    if (pol?.require_uppercase !== false) {
      const hasUpper = /[A-Z]/.test(pwd)
      criteria.push({
        criterion: 'uppercase',
        passed: hasUpper,
        message: 'At least one uppercase letter',
      })
      if (hasUpper) passCount++
    }

    // Lowercase check
    if (pol?.require_lowercase !== false) {
      const hasLower = /[a-z]/.test(pwd)
      criteria.push({
        criterion: 'lowercase',
        passed: hasLower,
        message: 'At least one lowercase letter',
      })
      if (hasLower) passCount++
    }

    // Number check
    if (pol?.require_number !== false) {
      const hasNumber = /[0-9]/.test(pwd)
      criteria.push({
        criterion: 'number',
        passed: hasNumber,
        message: 'At least one number',
      })
      if (hasNumber) passCount++
    }

    // Special character check
    if (pol?.require_special !== false) {
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
      criteria.push({
        criterion: 'special',
        passed: hasSpecial,
        message: 'At least one special character',
      })
      if (hasSpecial) passCount++
    }

    const score = Math.round((passCount / criteria.length) * 100)
    const valid = criteria.every((c) => c.passed)

    return {
      valid,
      score,
      criteria,
      suggestions: [],
    }
  }

  const getStrengthColor = (score: number) => {
    if (score < 40) return '#d32f2f' // Red
    if (score < 70) return '#ff9800' // Orange
    if (score < 100) return '#8FBCFA' // Blue
    return '#4caf50' // Green
  }

  const getStrengthLabel = (score: number) => {
    if (score < 40) return 'Weak'
    if (score < 70) return 'Fair'
    if (score < 100) return 'Good'
    return 'Strong'
  }

  if (!password) {
    return null
  }

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      {/* Strength Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant={loading ? 'indeterminate' : 'determinate'}
            value={validation?.score || 0}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                bgcolor: validation
                  ? getStrengthColor(validation.score)
                  : '#e0e0e0',
                borderRadius: 4,
              },
            }}
          />
        </Box>
        {validation && !loading && (
          <Typography
            variant="caption"
            sx={{
              color: getStrengthColor(validation.score),
              fontWeight: 600,
              minWidth: 50,
            }}
          >
            {getStrengthLabel(validation.score)}
          </Typography>
        )}
      </Box>

      {/* Criteria List */}
      {validation && !loading && (
        <Box sx={{ mt: 1 }}>
          {validation.criteria.map((criterion) => (
            <Box
              key={criterion.criterion}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 0.5,
              }}
            >
              {criterion.passed ? (
                <CheckCircleIcon
                  sx={{ fontSize: 16, color: '#4caf50' }}
                />
              ) : (
                <CancelIcon sx={{ fontSize: 16, color: '#d32f2f' }} />
              )}
              <Typography
                variant="caption"
                sx={{
                  color: criterion.passed ? 'text.secondary' : 'error.main',
                }}
              >
                {criterion.message}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Suggestions */}
      {validation &&
        !loading &&
        validation.suggestions &&
        validation.suggestions.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Suggestions:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {validation.suggestions.map((suggestion, index) => (
                <Typography
                  key={index}
                  component="li"
                  variant="caption"
                  color="text.secondary"
                >
                  {suggestion}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
    </Box>
  )
}
