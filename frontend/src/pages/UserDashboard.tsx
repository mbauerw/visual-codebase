import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Eye, Calendar, FileCode, GitBranch, Loader2, AlertCircle, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getUserAnalyses, deleteAnalysis, updateAnalysisTitle } from '../api/client'
import { useAuth } from '../hooks/useAuth'

interface Analysis {
  analysis_id: string
  directory_path: string
  github_repo?: {
    owner: string
    repo: string
    branch?: string
    path?: string
  }
  user_title?: string
  status: string
  progress: number
  file_count: number
  edge_count: number
  started_at: string
  completed_at?: string
}

interface UserDashboardProps {
  open: boolean
  onClose: () => void
}

export default function UserDashboard({ open, onClose }: UserDashboardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && open) {
      loadAnalyses()
    }
  }, [user, open])

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
    onClose()
  }

  const getDisplayTitle = (analysis: Analysis) => {
    return analysis.user_title
      || (analysis.github_repo
          ? `${analysis.github_repo.owner}/${analysis.github_repo.repo}`
          : (analysis.directory_path.split('/').pop() || analysis.directory_path))
  }

  const handleStartEdit = (analysis: Analysis) => {
    setEditingId(analysis.analysis_id)
    setEditTitle(analysis.user_title || '')
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const handleSaveTitle = async (analysisId: string) => {
    try {
      setSavingTitle(true)
      const trimmedTitle = editTitle.trim()
      await updateAnalysisTitle(analysisId, trimmedTitle || null)
      setAnalyses(prev =>
        prev.map(a =>
          a.analysis_id === analysisId
            ? { ...a, user_title: trimmedTitle || undefined }
            : a
        )
      )
      setEditingId(null)
      setEditTitle('')
    } catch (error) {
      console.error('Error updating title:', error)
    } finally {
      setSavingTitle(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, analysisId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveTitle(analysisId)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
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

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'pending':
      case 'parsing':
      case 'analyzing':
      case 'building_graph':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  if (!open) return null

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
          className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Your Analyses</h2>
              <p className="text-gray-600 mt-1">View and manage your codebase analyses</p>
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
          <div className="flex-1 overflow-y-auto p-8">
            {!user ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={32} className="text-gray-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">Sign in required</h3>
                <p className="text-gray-600">Sign in to view your saved analyses</p>
              </div>
            ) : loading ? (
              <div className="text-center py-16">
                <Loader2 size={48} className="text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading your analyses...</p>
              </div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#8FBCFA]/20 to-[#FF9A9D]/20 flex items-center justify-center mx-auto mb-6">
                  <GitBranch size={40} className="text-gray-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">No analyses yet</h3>
                <p className="text-gray-600 mb-8">Start by analyzing a codebase to see it here</p>
                <button
                  onClick={() => {
                    onClose()
                    navigate('/')
                  }}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-full font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-gray-900/20"
                >
                  Analyze Codebase
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {analyses.map((analysis) => (
                  <div
                    key={analysis.analysis_id}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all hover:scale-[1.01] flex flex-col"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 pr-3">
                        {editingId === analysis.analysis_id ? (
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, analysis.analysis_id)}
                              onBlur={() => handleSaveTitle(analysis.analysis_id)}
                              placeholder={getDisplayTitle(analysis)}
                              disabled={savingTitle}
                              className="flex-1 text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {savingTitle && <Loader2 size={16} className="text-gray-400 animate-spin" />}
                          </div>
                        ) : (
                          <div
                            className="group flex items-center gap-2 cursor-pointer mb-1"
                            onClick={() => handleStartEdit(analysis)}
                          >
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {getDisplayTitle(analysis)}
                            </h3>
                            <Pencil size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                        )}
                        <p className="text-sm text-gray-500 truncate">
                          {analysis.github_repo
                            ? `github.com/${analysis.github_repo.owner}/${analysis.github_repo.repo}`
                            : analysis.directory_path}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyles(analysis.status)}`}>
                        {analysis.status}
                      </span>
                    </div>

                    {/* Stats */}
                    {analysis.status === 'completed' && (
                      <div className="flex gap-4 mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8FBCFA]/20 to-[#8FBCFA]/10 flex items-center justify-center">
                            <FileCode size={16} className="text-[#8FBCFA]" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Files</p>
                            <p className="text-sm font-semibold text-gray-900">{analysis.file_count}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9A9D]/20 to-[#FF9A9D]/10 flex items-center justify-center">
                            <GitBranch size={16} className="text-[#FF9A9D]" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Links</p>
                            <p className="text-sm font-semibold text-gray-900">{analysis.edge_count}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="space-y-2 mb-6 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={14} className="text-gray-400" />
                        <span className="text-gray-500">Started:</span>
                        <span className="text-gray-700 font-medium">{formatDate(analysis.started_at)}</span>
                      </div>
                      {analysis.completed_at && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="text-gray-500">Completed:</span>
                          <span className="text-gray-700 font-medium">{formatDate(analysis.completed_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(analysis.analysis_id)}
                        disabled={analysis.status !== 'completed'}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-full font-medium transition-all hover:scale-[1.02] shadow-sm"
                      >
                        <Eye size={16} />
                        View
                      </button>
                      <button
                        onClick={() => {
                          setAnalysisToDelete(analysis.analysis_id)
                          setDeleteDialogOpen(true)
                        }}
                        className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-all border border-red-200 hover:scale-[1.05]"
                        aria-label="Delete analysis"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <>
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[60]"
            onClick={() => setDeleteDialogOpen(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} className="text-red-600" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
                Delete Analysis
              </h3>

              <p className="text-gray-600 text-center mb-8">
                Are you sure you want to delete this analysis? This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteDialogOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-full font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
