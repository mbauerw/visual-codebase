import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import UploadPage from './pages/UploadPage';
import VisualizationPage from './pages/VisualizationPage';
import UserDashboard from './pages/UserDashboard';
import AuthCallback from './pages/AuthCallback';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/visualize" element={<VisualizationPage />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={0}
      />
    </Box>
  );
}
