import { CodebaseSummary } from '../types';
import {
  Code,
  Layers,
  Package,
  Target,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';

interface SummaryDisplayProps {
  summary: CodebaseSummary;
}

const projectTypeIcons: Record<string, JSX.Element> = {
  web_app: <Layers size={16} />,
  api: <Package size={16} />,
  library: <Code size={16} />,
  cli: <Code size={16} />,
  monorepo: <Layers size={16} />,
  mobile_app: <Layers size={16} />,
  unknown: <Code size={16} />,
};

const projectTypeLabels: Record<string, string> = {
  web_app: 'Web Application',
  api: 'API',
  library: 'Library',
  cli: 'CLI Tool',
  monorepo: 'Monorepo',
  mobile_app: 'Mobile App',
  unknown: 'Unknown',
};

const complexityColors = {
  simple: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle size={14} /> },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <AlertCircle size={14} /> },
  complex: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <XCircle size={14} /> },
};

export default function SummaryDisplay({ summary }: SummaryDisplayProps) {
  const complexityStyle = complexityColors[summary.complexity_assessment.level];

  return (
    <div className="space-y-6">
      {/* Header with project type and description */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            {projectTypeIcons[summary.project_type] || projectTypeIcons.unknown}
            {projectTypeLabels[summary.project_type] || 'Unknown Type'}
          </span>
        </div>
        <p className="text-slate-700 text-lg leading-relaxed">
          {summary.primary_purpose}
        </p>
      </div>

      {/* Tech Stack and Architecture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tech Stack Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Package size={16} className="text-slate-600" />
            Tech Stack
          </h3>
          <div className="space-y-2">
            {summary.tech_stack.languages.length > 0 && (
              <div>
                <span className="text-xs text-slate-500 font-medium">Languages:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {summary.tech_stack.languages.map((lang) => (
                    <span
                      key={lang}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {summary.tech_stack.frameworks.length > 0 && (
              <div>
                <span className="text-xs text-slate-500 font-medium">Frameworks:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {summary.tech_stack.frameworks.map((framework) => (
                    <span
                      key={framework}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                    >
                      {framework}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {summary.tech_stack.key_patterns.length > 0 && (
              <div>
                <span className="text-xs text-slate-500 font-medium">Patterns:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {summary.tech_stack.key_patterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Architecture Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Target size={16} className="text-slate-600" />
            Architecture
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed mb-3">
            {summary.architecture_summary}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Complexity:</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${complexityStyle.bg} ${complexityStyle.text} rounded text-xs font-medium`}>
              {complexityStyle.icon}
              {summary.complexity_assessment.level.charAt(0).toUpperCase() + summary.complexity_assessment.level.slice(1)}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-2 italic">
            {summary.complexity_assessment.reasoning}
          </p>
        </div>
      </div>

      {/* Key Modules */}
      {summary.key_modules.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Key Modules</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {summary.key_modules.map((module) => (
              <div
                key={module.name}
                className="bg-slate-50 border border-slate-200 rounded-lg p-3"
              >
                <div className="font-medium text-sm text-slate-900">{module.name}</div>
                <div className="text-xs text-slate-600 mt-1">{module.purpose}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notable Aspects */}
      {summary.notable_aspects.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Notable Aspects</h3>
          <ul className="list-disc list-inside space-y-1">
            {summary.notable_aspects.map((aspect, index) => (
              <li key={index} className="text-sm text-slate-700">
                {aspect}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
