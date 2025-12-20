import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Play, Loader2, AlertCircle, Zap, GitBranch, Eye, ChevronDown, Menu, X } from 'lucide-react';
import { useAnalysis } from '../hooks/useAnalysis';

export default function UploadPage() {
  const [directoryPath, setDirectoryPath] = useState('');
  const [includeNodeModules, setIncludeNodeModules] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const navigate = useNavigate();
  const { isLoading, status, result, error, analyze } = useAnalysis();

  // Handle navbar visibility on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setNavVisible(false);
      } else {
        setNavVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    sessionStorage.setItem('analysisResult', JSON.stringify(result));
    navigate('/visualize');
  }

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] overflow-x-hidden">
      {/* Gradient Banner */}
      {/* <div className="fixed top-0 left-0 right-0 z-[60] mx-3 md:mx-5 mt-3 md:mt-5">
        <div 
          className="bg-gradient-to-r from-[#8FBCFA] via-blue-600 to-purple-700 text-gray-900 py-2.5 px-4 text-center rounded-2xl max-w-6xl mx-auto transition-transform duration-500"
          style={{ transform: navVisible ? 'translateY(0)' : 'translateY(-150%)' }}
        >
          <p className="text-xs md:text-sm font-medium">
            <span className="font-semibold">✨ New:</span> AI-powered codebase analysis now available
          </p>
        </div>
      </div> */}

      {/* Navigation */}
      <header 
        className={`fixed z-50 left-3 right-3 md:left-5 md:right-5 transition-all duration-500 ${
          navVisible ? 'top-6 md:top-8' : '-top-24'
        }`}
      >
        <nav className="bg-white/95 backdrop-blur-md rounded-full px-5 md:px-8 py-3 md:py-4 flex items-center justify-between max-w-6xl mx-auto shadow-lg shadow-black/[0.03] border border-gray-100">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9A9D] to-[#F6D785] flex items-center justify-center">
              <GitBranch size={18} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-lg hidden sm:block">codebase-remap</span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('features')} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Features
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              How it Works
            </button>
            <button onClick={() => scrollToSection('analyze')} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Analyze
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* <div className="flex items-center gap-2 mr-4">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500 font-medium">Ready</span>
            </div> */}
            <button 
              onClick={() => scrollToSection('analyze')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium transition-colors"
            >
              Get Started
            </button>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white rounded-3xl mt-3 p-6 shadow-xl border border-gray-100 max-w-6xl mx-auto">
            <div className="flex flex-col gap-4">
              <button onClick={() => scrollToSection('features')} className="text-gray-600 hover:text-gray-900 font-medium text-left py-2">
                Features
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="text-gray-600 hover:text-gray-900 font-medium text-left py-2">
                How it Works
              </button>
              <button onClick={() => scrollToSection('analyze')} className="text-gray-600 hover:text-gray-900 font-medium text-left py-2">
                Analyze
              </button>
              <button 
                onClick={() => scrollToSection('analyze')}
                className="bg-gray-900 text-white px-6 py-3 rounded-full font-medium mt-2"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-32 pb-20 px-4 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Grid pattern */}
          <img
            className="absolute inset-0 opacity-[0.4] w-full h-full object-cover"
            src='public/spiral-grid-blue.jpeg'
          />
          
          {/* Diagonal lines */}
          <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="diagonal" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M-10,10 l20,-20 M0,40 l40,-40 M30,50 l20,-20" stroke="#FF9A9D" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#diagonal)" />
          </svg>

          {/* Floating 3D cubes - decorative */}
          <div className="absolute top-1/4 right-[15%] hidden lg:block">
            <div className="relative">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="absolute w-12 h-12 rounded-lg bg-gradient-to-br from-[#F6D785] to-[#FFE4A0] shadow-lg"
                  style={{
                    transform: `translate(${(i % 3) * 50}px, ${Math.floor(i / 3) * 50 + (i % 2) * 20}px) rotate(${i * 5}deg)`,
                    opacity: 0.8 - i * 0.1,
                    animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>
          </div>

          <div className="absolute top-1/3 left-[15%] hidden lg:block">
            <div className="relative">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="absolute w-12 h-12 rounded-lg bg-gradient-to-br from-blue-800 to-blue-500 shadow-lg"
                  style={{
                    transform: `translate(${(i % 3) * 950}px, ${Math.floor(i ) * 450 + (i % 2) * 20}px) rotate(${i * 10}deg)`,
                    opacity: 0.8 - i * 0.1,
                    animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Gradient orbs */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-[#8FBCFA]/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-40 w-96 h-96 bg-gradient-to-br from-[#FF9A9D]/20 to-transparent rounded-full blur-3xl" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
            codebase-<br className="sm:hidden" />remap
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Visualize your codebase architecture with AI-powered dependency analysis. 
            Understand file relationships at a glance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => scrollToSection('analyze')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-full font-medium text-lg transition-all hover:scale-[1.02] shadow-lg shadow-gray-900/20"
            >
              Analyze Your Codebase
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-full font-medium text-lg border border-gray-200 transition-all hover:border-gray-300"
            >
              See How It Works
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <button 
          onClick={() => scrollToSection('features')}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-400 hover:text-gray-600 transition-colors animate-bounce"
        >
          <ChevronDown size={32} />
        </button>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#FF9A9D] font-semibold text-sm uppercase tracking-wider">Features</span>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
              Everything you need to understand your code
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Powerful tools to analyze, visualize, and comprehend complex codebases
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8FBCFA] to-[#6BA3F5] flex items-center justify-center mb-6">
                <GitBranch size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Dependency Mapping</h3>
              <p className="text-gray-600 leading-relaxed">
                Automatically extract and visualize import statements across JavaScript, TypeScript, and Python files.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF9A9D] to-[#FF7A7D] flex items-center justify-center mb-6">
                <Zap size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">AI-Powered Analysis</h3>
              <p className="text-gray-600 leading-relaxed">
                Leverage AI to understand the role of each file and categorize them by their function in your architecture.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F6D785] to-[#F0C560] flex items-center justify-center mb-6">
                <Eye size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Interactive Visualization</h3>
              <p className="text-gray-600 leading-relaxed">
                Explore your codebase through an interactive node graph with zooming, panning, and filtering capabilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 md:py-32 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#8FBCFA] font-semibold text-sm uppercase tracking-wider">How It Works</span>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
              Three simple steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF9A9D]/20 to-[#FF9A9D]/10 flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-[#FF9A9D]">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Point to Your Project</h3>
              <p className="text-gray-600">
                Enter the path to your project directory. We support JavaScript, TypeScript, and Python.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8FBCFA]/20 to-[#8FBCFA]/10 flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-[#8FBCFA]">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">AI Analysis</h3>
              <p className="text-gray-600">
                Our AI processes your files, extracting imports and understanding each file's purpose.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F6D785]/20 to-[#F6D785]/10 flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-[#F6D785]">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Explore the Graph</h3>
              <p className="text-gray-600">
                Navigate your codebase visually, understanding dependencies and architecture at a glance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Analyze Section */}
      <section id="analyze" className="py-20 md:py-32 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-gray-100">
            <div className="text-center mb-10">
              <span className="text-[#F6D785] font-semibold text-sm uppercase tracking-wider">Get Started</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4 mb-4">
                Analyze Your Codebase
              </h2>
              <p className="text-gray-600">
                Enter your project path to begin the analysis
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Directory Path Input */}
              <div>
                <label htmlFor="directory" className="block text-sm font-medium text-gray-700 mb-2">
                  Directory Path
                </label>
                <div className="relative">
                  <FolderOpen size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    id="directory"
                    value={directoryPath}
                    onChange={(e) => setDirectoryPath(e.target.value)}
                    placeholder="/path/to/your/project"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNodeModules}
                    onChange={(e) => setIncludeNodeModules(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#8FBCFA] focus:ring-[#8FBCFA]"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-gray-600">Include node_modules</span>
                </label>

                <div className="flex items-center gap-3">
                  <label htmlFor="maxDepth" className="text-sm text-gray-600">Max depth:</label>
                  <input
                    type="number"
                    id="maxDepth"
                    min="1"
                    max="20"
                    value={maxDepth ?? ''}
                    onChange={(e) => setMaxDepth(e.target.value ? parseInt(e.target.value, 10) : null)}
                    placeholder="∞"
                    className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !directoryPath.trim()}
                className="w-full py-4 px-6 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play size={20} />
                    Start Analysis
                  </>
                )}
              </button>
            </form>

            {/* Progress */}
            {status && isLoading && (
              <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">{status.current_step}</span>
                  <span className="text-sm text-gray-500">{Math.round(status.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#8FBCFA] to-[#FF9A9D] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
                {status.total_files > 0 && (
                  <p className="text-xs text-gray-500 mt-3">
                    {status.files_processed} / {status.total_files} files processed
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-xl flex items-start gap-4">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Analysis Failed</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Supported Languages */}
            <div className="mt-8 pt-8 border-t border-gray-100">
              <p className="text-sm text-gray-500 text-center">
                <span className="font-medium text-gray-700">Supported:</span> JavaScript (.js, .jsx), TypeScript (.ts, .tsx), Python (.py)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9A9D] to-[#F6D785] flex items-center justify-center">
              <GitBranch size={18} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900">codebase-remap</span>
          </div>
          <p className="text-sm text-gray-500">
            Built with AI-powered analysis
          </p>
        </div>
      </footer>

      {/* Animation keyframes via style tag */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}