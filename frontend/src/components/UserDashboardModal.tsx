import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Modal,
  Fade,
  Backdrop,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { getUserAnalyses, deleteAnalysis } from '../api/client'
import { useAuth } from '../hooks/useAuth'

interface Analysis {
  analysis_id: string
  directory_path: string
  status: string
  progress: number
  file_count: number
  edge_count: number
  started_at: string
  completed_at?: string
}

interface UserDashboardModalProps {
  open: boolean
  onClose: () => void
}

export default function UserDashboardModal({ open, onClose }: UserDashboardModalProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null)

  // Load analyses when modal opens
  useEffect(() => {
    if (open && user) {
      loadAnalyses()
    }
  }, [open, user])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const loadAnalyses = async () => {
    try {
      setLoading(true)
      const response = await getUserAnalyses()
      setAnalyses(response.analyses)
    } catch (error) {
      console.error('Error loading analyses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!analysisToDelete) return

    try {
      await deleteAnalysis(analysisToDelete)
      setAnalyses(prev => prev.filter(a => a.analysis_id !== analysisToDelete))
      setDeleteDialogOpen(false)
      setAnalysisToDelete(null)
    } catch (error) {
      console.error('Error deleting analysis:', error)
    }
  }

  const handleView = (analysisId: string) => {
    onClose() // Close modal before navigating
    navigate(`/visualize?analysis=${analysisId}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'pending':
      case 'parsing':
      case 'analyzing':
      case 'building_graph': return 'warning'
      default: return 'default'
    }
  }

  // Modal content
  const renderContent = () => {
    if (!user) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Sign in to view your saved analyses
          </Typography>
        </Box>
      )
    }

    if (loading) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Loading your analyses...</Typography>
        </Box>
      )
    }

    if (analyses.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No analyses found
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Start by analyzing a codebase to see it here
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              onClose()
              navigate('/')
            }}
          >
            Analyze Codebase
          </Button>
        </Box>
      )
    }

    return (
      <Grid container spacing={3}>
        {analyses.map((analysis) => (
          <Grid size={{ xs: 12, md: 6, lg: 4 }} key={analysis.analysis_id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" component="div" sx={{ flexGrow: 1, pr: 1 }}>
                    {analysis.directory_path.split('/').pop() || analysis.directory_path}
                  </Typography>
                  <Chip
                    label={analysis.status}
                    color={getStatusColor(analysis.status) as any}
                    size="small"
                  />
                </Box>

                <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
                  {analysis.directory_path}
                </Typography>

                {analysis.status === 'completed' && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Files: {analysis.file_count} • Dependencies: {analysis.edge_count}
                    </Typography>
                  </Box>
                )}

                <Typography variant="body2" color="text.secondary">
                  Started: {formatDate(analysis.started_at)}
                </Typography>

                {analysis.completed_at && (
                  <Typography variant="body2" color="text.secondary">
                    Completed: {formatDate(analysis.completed_at)}
                  </Typography>
                )}
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  startIcon={<ViewIcon />}
                  onClick={() => handleView(analysis.analysis_id)}
                  disabled={analysis.status !== 'completed'}
                >
                  View
                </Button>
                <IconButton
                  size="small"
                  onClick={() => {
                    setAnalysisToDelete(analysis.analysis_id)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 300,
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
            }
          }
        }}
      >
        <Fade in={open}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: {
                xs: '95vw',
                sm: '90vw',
                md: '85vw',
                lg: '80vw'
              },
              height: {
                xs: '90vh',
                sm: '85vh'
              },
              bgcolor: 'background.paper',
              boxShadow: 24,
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header with close button */}
            <Box
              sx={{
                p: 3,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <Typography variant="h4" component="h2">
                Your Analyses
              </Typography>
              <IconButton
                onClick={onClose}
                aria-label="close"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'text.primary',
                    bgcolor: 'action.hover',
                  }
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Scrollable content area */}
            <Box
              sx={{
                p: 4,
                overflowY: 'auto',
                flexGrow: 1,
              }}
            >
              {renderContent()}
            </Box>
          </Box>
        </Fade>
      </Modal>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Analysis</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this analysis? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
