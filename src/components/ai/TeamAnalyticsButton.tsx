'use client';

// Team Analytics Button - Client component wrapper for team insights
// Similar to the AI insight button on game cards

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { TeamInsightModal } from './TeamInsightModal';

interface TeamAnalyticsButtonProps {
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  record: { wins: number; losses: number; winPct: string };
  stats: {
    ppg: number;
    oppg: number;
    rpg: number;
    apg: number;
    fgPct: number;
    fg3Pct: number;
    ftPct: number;
  };
}

export function TeamAnalyticsButton({
  teamId,
  teamName,
  teamAbbreviation,
  record,
  stats,
}: TeamAnalyticsButtonProps) {
  const [showInsightModal, setShowInsightModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowInsightModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-orange-500/30 to-purple-500/30 border border-orange-500/20 hover:from-orange-500/50 hover:to-purple-500/50 hover:border-orange-500/40 transition-all duration-300 hover:scale-105 shadow-lg shadow-orange-500/10"
        title="View Team Analytics & Insights"
      >
        <Sparkles className="w-4 h-4 text-orange-300" />
        <span className="text-sm font-medium text-white">Analytics & Insights</span>
      </button>

      <TeamInsightModal
        isOpen={showInsightModal}
        onClose={() => setShowInsightModal(false)}
        teamId={teamId}
        teamName={teamName}
        teamAbbreviation={teamAbbreviation}
        record={record}
        stats={stats}
      />
    </>
  );
}

