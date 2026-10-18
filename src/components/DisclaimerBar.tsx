import React from 'react';
import { Info, Database, Zap } from 'lucide-react';
import { CatalogueStatus } from '../types.ts';

interface DisclaimerBarProps {
  catalogueStatus: CatalogueStatus | null;
}

export const DisclaimerBar: React.FC<DisclaimerBarProps> = ({ catalogueStatus }) => {
  return (
    <div className="bg-blue-900 text-blue-100 text-xs px-3 py-1.5 flex flex-wrap items-center justify-between border-b border-blue-800 gap-2 sticky top-0 z-50">
      <div className="flex items-center gap-1.5 font-medium">
        <Info className="w-3.5 h-3.5 text-blue-300 shrink-0" />
        <span>AI assistant using dummy data. Estimates are approximate.</span>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        {catalogueStatus ? (
          <span className="inline-flex items-center gap-1 bg-blue-800/80 px-2 py-0.5 rounded text-blue-200">
            <Database className="w-3 h-3 text-sky-400" />
            <span>
              {catalogueStatus.catalogue_source === 'airtable_live' ? 'Verified Live Stays & Spots' : 'Curated Travel Guide'}
            </span>
            <span className="text-blue-400">•</span>
            <span>{catalogueStatus.destinations_count} Destinations</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-blue-800/60 px-2 py-0.5 rounded text-blue-300">
            <Zap className="w-3 h-3 text-amber-300 animate-pulse" />
            <span>Updating Stays</span>
          </span>
        )}
      </div>
    </div>
  );
};
