import React, { useState } from 'react';
import { 
  Star, 
  MessageSquareQuote, 
  FileCheck2, 
  IndianRupee, 
  Clock, 
  HelpCircle, 
  ShieldCheck, 
  UtensilsCrossed, 
  Scale, 
  Shuffle, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Sparkles
} from 'lucide-react';

interface EvidenceCardViewerProps {
  text: string;
  reviewStatus?: string;
  explanation?: string;
}

interface EvidenceSection {
  key: string;
  title: string;
  order: number;
  icon: React.ReactNode;
  accentColor: string;
  content: string;
}

const SECTION_CONFIGS = [
  {
    key: 'explanation',
    title: 'AI Explanation',
    order: 0,
    icon: <Sparkles className="w-4 h-4 text-purple-600" />,
    accentColor: 'border-purple-200 bg-purple-50/50 text-purple-950',
    headerBadge: 'bg-purple-100 text-purple-800'
  },
  {
    key: 'overview',
    title: 'Trip Overview',
    order: 1,
    icon: <Star className="w-4 h-4 text-amber-500 fill-amber-400" />,
    accentColor: 'border-amber-200 bg-amber-50/50 text-amber-950',
    headerBadge: 'bg-amber-100 text-amber-800'
  },
  {
    key: 'itinerary',
    title: 'Day-by-Day Itinerary',
    order: 2,
    icon: <Clock className="w-4 h-4 text-blue-600" />,
    accentColor: 'border-blue-200 bg-blue-50/50 text-blue-950',
    headerBadge: 'bg-blue-100 text-blue-800'
  },
  {
    key: 'stays',
    title: 'Verified Stays',
    order: 3,
    icon: <FileCheck2 className="w-4 h-4 text-emerald-600" />,
    accentColor: 'border-emerald-200 bg-emerald-50/50 text-emerald-950',
    headerBadge: 'bg-emerald-100 text-emerald-800'
  },
  {
    key: 'cost',
    title: 'Cost Breakdown & Budget Fit',
    order: 4,
    icon: <IndianRupee className="w-4 h-4 text-indigo-600" />,
    accentColor: 'border-indigo-200 bg-indigo-50/50 text-indigo-950',
    headerBadge: 'bg-indigo-100 text-indigo-800'
  },
  {
    key: 'guest evidence',
    title: 'Verified Guest Evidence',
    order: 5,
    icon: <MessageSquareQuote className="w-4 h-4 text-sky-500" />,
    accentColor: 'border-sky-200 bg-sky-50/50 text-sky-950',
    headerBadge: 'bg-sky-100 text-sky-800'
  },
  {
    key: 'food',
    title: 'Food & Dining',
    order: 6,
    icon: <UtensilsCrossed className="w-4 h-4 text-orange-600" />,
    accentColor: 'border-orange-200 bg-orange-50/50 text-orange-950',
    headerBadge: 'bg-orange-100 text-orange-800'
  },
  {
    key: 'safety',
    title: 'Accessibility, Safety & Hygiene',
    order: 7,
    icon: <ShieldCheck className="w-4 h-4 text-teal-600" />,
    accentColor: 'border-teal-200 bg-teal-50/50 text-teal-950',
    headerBadge: 'bg-teal-100 text-teal-800'
  },
  {
    key: 'assumptions',
    title: 'Planning Assumptions',
    order: 8,
    icon: <HelpCircle className="w-4 h-4 text-violet-600" />,
    accentColor: 'border-violet-200 bg-violet-50/50 text-violet-950',
    headerBadge: 'bg-violet-100 text-violet-800'
  },
  {
    key: 'trade-offs',
    title: 'Trade-offs',
    order: 9,
    icon: <Scale className="w-4 h-4 text-rose-600" />,
    accentColor: 'border-rose-200 bg-rose-50/50 text-rose-950',
    headerBadge: 'bg-rose-100 text-rose-800'
  },
  {
    key: 'alternatives',
    title: 'Alternative Destinations',
    order: 10,
    icon: <Shuffle className="w-4 h-4 text-cyan-600" />,
    accentColor: 'border-cyan-200 bg-cyan-50/50 text-cyan-950',
    headerBadge: 'bg-cyan-100 text-cyan-800'
  }
];

export const EvidenceCardViewer: React.FC<EvidenceCardViewerProps> = ({ text, reviewStatus, explanation }) => {
  const [copied, setCopied] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

  // Parse markdown text into ordered evidence cards
  const parseSections = (rawText: string) => {
    const lines = rawText.split('\n');
    let introLines: string[] = [];
    const extractedSections: Record<string, string[]> = {};
    let currentKey: string | null = null;

    for (const line of lines) {
      // Check for headings like ### 1. Rating or ### 2. Day-by-Day Itinerary
      const headingMatch = line.match(/^#{1,4}\s*(?:\d+[\.\)]\s*)?([a-zA-Z\s\-&:,]+)/i);
      
      let matchedConfig = null;
      if (headingMatch) {
        const rawTitle = headingMatch[1].trim().toLowerCase();
        matchedConfig = SECTION_CONFIGS.find(cfg => {
          if (cfg.key === 'explanation') return rawTitle.includes('explanation');
          if (cfg.key === 'overview') return rawTitle.includes('overview') || rawTitle.includes('rating') || rawTitle.includes('destination');
          if (cfg.key === 'itinerary') return rawTitle.includes('day') || rawTitle.includes('itinerary') || rawTitle.includes('travel time');
          if (cfg.key === 'stays') return rawTitle.includes('stay') || rawTitle.includes('hotel') || rawTitle.includes('evidence');
          if (cfg.key === 'cost') return rawTitle.includes('cost') || rawTitle.includes('budget');
          if (cfg.key === 'guest evidence') return rawTitle.includes('guest evidence') || rawTitle.includes('feedback') || rawTitle.includes('quote');
          if (cfg.key === 'food') return rawTitle.includes('food') || rawTitle.includes('dining') || rawTitle.includes('cuisine');
          if (cfg.key === 'safety') return rawTitle.includes('safety') || rawTitle.includes('cleanliness') || rawTitle.includes('accessibility');
          if (cfg.key === 'assumptions') return rawTitle.includes('assumption');
          if (cfg.key === 'trade-offs') return rawTitle.includes('trade-off') || rawTitle.includes('tradeoff');
          if (cfg.key === 'alternatives') return rawTitle.includes('alternative');
          return rawTitle.includes(cfg.key);
        });
      }

      if (matchedConfig) {
        currentKey = matchedConfig.key;
        if (!extractedSections[currentKey]) {
          extractedSections[currentKey] = [];
        }
      } else if (currentKey) {
        extractedSections[currentKey].push(line);
      } else {
        introLines.push(line);
      }
    }

    // Assemble sections in strict order
    const sections: EvidenceSection[] = SECTION_CONFIGS.map(cfg => {
      const contentLines = extractedSections[cfg.key] || [];
      let content = contentLines.join('\n').trim();
      if (cfg.key === 'explanation') {
        if (!content && explanation) {
          content = explanation;
        }
        if (content.length > 0) {
          // Explanation visibility: do not show ai_explanation to the user until review_status is Approved.
          // Show "Explanation pending review" in its place.
          content = reviewStatus === 'Approved' ? content : 'Explanation pending review';
        }
      } else {
        if (cfg.key === 'alternatives' && content.length > 0) {
          content = content.replace(/\s*\(\s*known\s*\)/gi, '');
        }
        // Rule 4: Show all 10 evidence cards. If a card has no matching verified evidence, do not drop it silently.
        // Show it with the line "No verified evidence available for this section."
        if (content.length === 0) {
          content = 'No verified evidence available for this section.';
        }
      }
      return {
        key: cfg.key,
        title: cfg.title,
        order: cfg.order,
        icon: cfg.icon,
        accentColor: cfg.accentColor,
        content
      };
    }).filter(s => s.content.length > 0);

    return {
      intro: introLines.join('\n').trim(),
      sections
    };
  };

  const { intro, sections } = parseSections(text);

  const toggleCollapse = (key: string) => {
    setCollapsedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return null;

          // Bullet points
          if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
            const clean = line.replace(/^[\*\-]\s*/, '');
            // Highlight bold prefixes e.g. **Hotel:**
            const parts = clean.split(/(\*\*.*?\*\*)/g);
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-blue-500 font-bold shrink-0 leading-none mt-1">•</span>
                <span className="flex-1">
                  {parts.map((part, pIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                    }
                    return <span key={pIdx}>{part}</span>;
                  })}
                </span>
              </div>
            );
          }

          // Regular paragraph
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={idx} className="pl-1">
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                }
                return <span key={pIdx}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  // If no structured sections matched, show the content formatted once
  if (sections.length === 0) {
    return (
      <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
        {renderFormattedContent(intro || text)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Introduction note if any */}
      {intro && (
        <div className="text-xs text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl p-3 leading-relaxed">
          {renderFormattedContent(intro)}
        </div>
      )}

      {/* Header with copy action */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 pb-0.5 border-b border-slate-100">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-blue-700">
          Verified Evidence Cards ({sections.length}/10)
        </span>
        <button
          onClick={copyText}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Full Itinerary'}</span>
        </button>
      </div>

      {/* 10 Evidence Cards Grid / Stack */}
      <div className="grid grid-cols-1 gap-2.5">
        {sections.map((sec) => {
          const isCollapsed = collapsedCards[sec.key];
          return (
            <div
              key={sec.key}
              className={`rounded-xl border transition-all duration-200 shadow-2xs overflow-hidden ${sec.accentColor}`}
            >
              <button
                type="button"
                onClick={() => toggleCollapse(sec.key)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left bg-white/70 hover:bg-white/90 transition-colors border-b border-inherit/40 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-white shadow-2xs shrink-0">
                    {sec.icon}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">#{sec.order}</span>
                    <span className="text-xs font-bold text-slate-900 tracking-tight">{sec.title}</span>
                  </div>
                </div>
                <div className="text-slate-400 hover:text-slate-600">
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-3 bg-white/40">
                  {renderFormattedContent(sec.content)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
