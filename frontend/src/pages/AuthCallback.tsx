import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../config/supabase';

export default function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in URL params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlError = hashParams.get('error');
        const urlErrorDescription = hashParams.get('error_description');

        if (urlError) {
          setStatus('error');
          setError(urlErrorDescription || urlError);
          return;
        }

        // Wait for Supabase to process the OAuth callback
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setStatus('error');
          setError(sessionError.message);
          return;
        }

        if (session) {
          setStatus('success');

          // Debug: Log provider token
          console.log('OAuth callback - Provider token:', session.provider_token);

          // Store GitHub provider token in localStorage for persistence
          if (session.provider_token) {
            localStorage.setItem('github_provider_token', session.provider_token);
          }

          // Get the intended redirect URL from sessionStorage or default to home
          const redirectTo = sessionStorage.getItem('auth_redirect') || '/';
          sessionStorage.removeItem('auth_redirect');

          // Small delay to show success message
          setTimeout(() => {
            navigate(redirectTo);
          }, 1000);
        } else {
          setStatus('error');
          setError('No session found. Please try signing in again.');
        }
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    };

    handleCallback();
  }, [navigate]);

  const handleRetry = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-12 shadow-xl border border-gray-100 text-center">
        {status === 'processing' && (
          <>
            <Loader2 size={64} className="mx-auto text-gray-400 mb-6 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Completing sign in...</h2>
            <p className="text-gray-600">Please wait while we authenticate your account</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={36} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Successfully signed in!</h2>
            <p className="text-gray-600">Redirecting you now...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={36} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Authentication failed</h2>
            <p className="text-red-600 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-xl font-medium transition-colors"
            >
              Return to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
