import React, { useState, useEffect } from 'react'
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
  DialogActions
} from '@mui/material'
import { Delete as DeleteIcon, Visibility as ViewIcon } from '@mui/icons-material'
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

export default function UserDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadAnalyses()
    }
  }, [user])

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

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Your Analyses
      </Typography>
      
      {analyses.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No analyses found
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Start by analyzing a codebase to see it here
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/')}
          >
            Analyze Codebase
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {analyses.map((analysis) => (
            <Grid item xs={12} md={6} lg={4} key={analysis.analysis_id}>
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
      )}

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
    </Box>
  )
}