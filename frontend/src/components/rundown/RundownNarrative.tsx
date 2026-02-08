import { Route, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface RundownNarrativeProps {
  narrative: string;
}

export default function RundownNarrative({ narrative }: RundownNarrativeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gradient-to-r  hover:from-indigo-50/50 hover:to-blue-50/50 border border-indigo-200 rounded-xl p-6 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Route size={20} className="text-black flex-shrink-0" />
          <h3 className="text-xl font-semibold text-black flex-1">How This Codebase Works</h3>
          {/* <ChevronDown
            size={20}
            className={`text-slate-500 flex-shrink-0 transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          /> */}
        </div>

        <div
          className="grid transition-[grid-template-rows] duration-500 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line pt-4">
              {narrative}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
