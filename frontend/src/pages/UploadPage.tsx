import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Play, Loader2, AlertCircle, Info } from 'lucide-react';
import { useAnalysis } from '../hooks/useAnalysis';

export default function UploadPage() {
  const [directoryPath, setDirectoryPath] = useState('');
  const [includeNodeModules, setIncludeNodeModules] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number | null>(null);
  const navigate = useNavigate();
  const { isLoading, status, result, error, analyze } = useAnalysis();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directoryPath.trim()) return;

    await analyze({
      directory_path: directoryPath.trim(),
      include_node_modules: includeNodeModules,
      max_depth: maxDepth ?? undefined,
    });
  };

  // Navigate to visualization when result is ready
  if (result) {
    // Store result in session storage for the visualization page
    sessionStorage.setItem('analysisResult', JSON.stringify(result));
    navigate('/visualize');
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Visual Codebase</h1>
          <p className="text-slate-400">
            Analyze your codebase and visualize file dependencies
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Directory Path Input */}
          <div>
            <label
              htmlFor="directory"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Directory Path
            </label>
            <div className="relative">
              <FolderOpen
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                id="directory"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="includeNodeModules"
                checked={includeNodeModules}
                onChange={(e) => setIncludeNodeModules(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                disabled={isLoading}
              />
              <label
                htmlFor="includeNodeModules"
                className="text-sm text-slate-300"
              >
                Include node_modules (not recommended)
              </label>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="maxDepth" className="text-sm text-slate-300">
                Max depth:
              </label>
              <input
                type="number"
                id="maxDepth"
                min="1"
                max="20"
                value={maxDepth ?? ''}
                onChange={(e) =>
                  setMaxDepth(e.target.value ? parseInt(e.target.value, 10) : null)
                }
                placeholder="Unlimited"
                className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !directoryPath.trim()}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play size={20} />
                Analyze Codebase
              </>
            )}
          </button>
        </form>

        {/* Progress */}
        {status && isLoading && (
          <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">{status.current_step}</span>
              <span className="text-sm text-slate-400">
                {Math.round(status.progress)}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            {status.total_files > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {status.files_processed} / {status.total_files} files processed
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400 font-medium">Analysis Failed</p>
              <p className="text-sm text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-400">
              <p className="font-medium text-slate-300 mb-1">Supported languages</p>
              <p>JavaScript (.js, .jsx), TypeScript (.ts, .tsx), Python (.py)</p>
              <p className="mt-2">
                The analyzer will extract import statements and use AI to understand
                the role of each file in your codebase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
