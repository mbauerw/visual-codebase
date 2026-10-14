import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import VisualizationPage from './pages/VisualizationPage';
import AuthCallback from './pages/AuthCallback';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import { useAuth } from './hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Graph engine dev harness (`/graph-dev`, see src/graph/README.md). Registered in
// dev builds only and lazy-loaded so it — and the MSW mock handlers it imports —
// stay out of the production bundle.
const GraphDevPage = import.meta.env.DEV ? lazy(() => import('./graph/dev/GraphDevPage')) : null;

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#FAFAFA]">
        <div className="text-center">
          <Loader2 size={48} className="text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/visualize" element={<VisualizationPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      {GraphDevPage && (
        <Route
          path="/graph-dev"
          element={
            <Suspense fallback={null}>
              <GraphDevPage />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
