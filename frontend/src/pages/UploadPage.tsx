import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, User, GitBranch } from 'lucide-react';
import { useAnalysis } from '../hooks/useAnalysis';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from '../components/AuthModal';
import UserDashboard from './UserDashboard';
import ProfileSettingsPage from './ProfileSettingsPage';
import AnalyzeSection, { type LocalAnalyzeRequest, type GitHubAnalyzeRequest } from '../components/AnalyzeSection';
import FeaturesSection from '../components/FeaturesSection';
import HowItWorksSection from '../components/HowItWorksSection';
import Footer from '../components/Footer';



export default function UploadPage() {
  const [navVisible, setNavVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState(0);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastScrollY = useRef(0);
  const navigate = useNavigate();
  const { isLoading, status, result, error, analyze } = useAnalysis();
  const { user, signOut } = useAuth();

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

  const handleAnalyzeLocal = async (request: LocalAnalyzeRequest) => {
    await analyze({
      directory_path: request.directory_path,
      include_node_modules: request.include_node_modules,
      max_depth: request.max_depth,
    });
  };

  const handleAnalyzeGitHub = async (request: GitHubAnalyzeRequest) => {
    const { include_node_modules, max_depth, ...github_repo } = request;
    await analyze({
      github_repo,
      include_node_modules,
      max_depth,
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

  const handleOpenAuthModal = (tab: number) => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
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
        className={`fixed z-50 left-3 right-3 md:left-5 md:right-5 transition-all duration-500 ${navVisible ? 'top-6 md:top-8' : '-top-24'
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
            {user ? (
              <>
                <button
                  onClick={() => setDashboardOpen(true)}
                  className="text-gray-600 hover:text-gray-900 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  My Analyses
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Account Settings"
                >
                  <User size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-700 font-medium">{user.email?.split('@')[0]}</span>
                </button>
                <button
                  onClick={signOut}
                  className="text-white font-medium transition-colors px-4 py-2 rounded-full bg-neutral-800 hover:scale-[1.05]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleOpenAuthModal(0)}
                  className="text-gray-700 hover:text-gray-900 font-medium transition-all px-5 py-2.5 rounded-full hover:bg-gray-50"
                >
                  Log In
                </button>
                <button
                  onClick={() => handleOpenAuthModal(1)}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-semibold transition-all hover:shadow-lg hover:scale-[1.02] shadow-md"
                >
                  Sign Up
                </button>
              </>
            )}
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

              {user ? (
                <>
                  <div className="border-t border-gray-100 my-2"></div>
                  <button
                    onClick={() => {
                      setDashboardOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="text-gray-600 hover:text-gray-900 font-medium text-left py-2"
                  >
                    My Analyses
                  </button>
                  <button
                    onClick={() => {
                      setSettingsOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors w-full"
                  >
                    <User size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700 font-medium">{user.email?.split('@')[0]}</span>
                  </button>
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="text-gray-600 hover:text-gray-900 font-medium text-left py-2"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <div className="border-t border-gray-100 my-2"></div>
                  <button
                    onClick={() => handleOpenAuthModal(0)}
                    className="text-gray-700 hover:text-gray-900 font-medium text-left py-2.5 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => handleOpenAuthModal(1)}
                    className="bg-gray-900 text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition-all shadow-md"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-32 pb-20 px-4 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Background Image */}
          <img
            className="absolute inset-0 opacity-[0.4] w-full h-full object-cover"
            src='public/spiral-grid-blue.jpeg'
          />

          {/* Diagonal lines */}
          {/* <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="diagonal" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M-10,10 l20,-20 M0,40 l40,-40 M30,50 l20,-20" stroke="#FF9A9D" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#diagonal)" />
          </svg> */}





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
              className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-full font-medium text-lg border border-gray-200 transition-all hover:border-gray-300 hover:scale-[1.02]"
            >
              See How It Works
            </button>
          </div>
          <button
            onClick={() => navigate('/visualize?analysis=6475bbb4-4362-495a-81de-346128526055')}
            className="mt-4 bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-full font-medium text-lg border border-gray-200 transition-all hover:border-gray-300 hover:scale-[1.02]"
          >
            Try Demo
          </button>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={() => scrollToSection('features')}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-400 hover:text-gray-600 transition-colors animate-bounce"
        >
          <ChevronDown size={32} />
        </button>
      </section>

      {/* Analyze Section */}
      <AnalyzeSection
        isLoading={isLoading}
        status={status}
        error={error}
        user={user}
        onAnalyzeLocal={handleAnalyzeLocal}
        onAnalyzeGitHub={handleAnalyzeGitHub}
        onOpenAuthModal={handleOpenAuthModal}
      />

      <HowItWorksSection />
      <FeaturesSection />

      



      <Footer />

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalTab}
      />

      {/* User Dashboard Modal */}
      <UserDashboard
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />

      {/* Profile Settings Modal */}
      <ProfileSettingsPage
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

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