import { GitBranch } from 'lucide-react';

export default function Footer() {
  return (
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
  );
}
