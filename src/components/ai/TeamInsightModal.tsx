'use client';

// Team Insight Modal - Displays AI-generated team analytics and insights
// Similar to AIInsightModal but for team analysis

import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
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

// Cache for team insights to avoid re-fetching
const insightCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function TeamInsightModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  teamAbbreviation,
  record,
  stats,
}: TeamInsightModalProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create cache key based on team and stats
  const getCacheKey = useCallback(() => {
    return `${teamId}-${record.wins}-${record.losses}-${stats.ppg.toFixed(1)}`;
  }, [teamId, record.wins, record.losses, stats.ppg]);

  const fetchInsight = useCallback(async (forceRefresh = false) => {
    const cacheKey = getCacheKey();

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = insightCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setInsight(cached.content);
        setError(null);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build team context for AI
      const teamContext = {
        teamName,
        teamAbbreviation,
        record: `${record.wins}-${record.losses} (${record.winPct}%)`,
        stats: {
          ppg: stats.ppg.toFixed(1),
          oppg: stats.oppg.toFixed(1),
          rpg: stats.rpg.toFixed(1),
          apg: stats.apg.toFixed(1),
          fgPct: stats.fgPct.toFixed(1),
          fg3Pct: stats.fg3Pct.toFixed(1),
          ftPct: stats.ftPct.toFixed(1),
        },
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Provide a comprehensive analysis and insights for the ${teamName} (${teamAbbreviation}). Include their strengths, weaknesses, key players, recent performance trends, and what to watch for.`,
          type: 'team',
          length: 'medium',
          requestVisuals: false,
          teamContext,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.response) {
        throw new Error(data?.error?.message || 'Failed to fetch team insight');
      }

      const content = data.response;
      setInsight(content);

      // Cache the result
      insightCache.set(cacheKey, {
        content,
        timestamp: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team insight');
    } finally {
      setIsLoading(false);
    }
  }, [
    teamId,
    teamName,
    teamAbbreviation,
    record,
    stats,
    getCacheKey,
  ]);

  // Fetch insight when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchInsight();
    }
  }, [isOpen, fetchInsight]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="glass-dark rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl border border-white/10 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-purple-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-purple-600">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Team Analytics & Insights</h2>
                <p className="text-xs text-white/60">
                  {teamName} ({teamAbbreviation}) • {record.wins}-{record.losses}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isLoading && (
                <button
                  onClick={() => fetchInsight(true)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title="Refresh insight"
                >
                  <RefreshCw className="w-4 h-4 text-white/60" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 overflow-y-auto max-h-[60vh]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-purple-500 rounded-full blur-xl opacity-30 animate-pulse" />
                  <Loader2 className="w-10 h-10 text-orange-400 animate-spin relative z-10" />
                </div>
                <p className="mt-4 text-white/60 text-sm">Generating team insights...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-full bg-red-500/10 mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-white/80 font-medium mb-2">Unable to generate insight</p>
                <p className="text-white/50 text-sm mb-4">{error}</p>
                <button
                  onClick={() => fetchInsight(true)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : insight ? (
              <div className="space-y-4">
                {/* Team Stats Display */}
                <div className="grid grid-cols-4 gap-3 py-3 px-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-center">
                    <p className="text-white/60 text-xs">PPG</p>
                    <p className="text-lg font-bold text-green-400 tabular-nums">{stats.ppg.toFixed(1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/60 text-xs">OPP PPG</p>
                    <p className="text-lg font-bold text-red-400 tabular-nums">{stats.oppg.toFixed(1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/60 text-xs">RPG</p>
                    <p className="text-lg font-bold text-white tabular-nums">{stats.rpg.toFixed(1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/60 text-xs">APG</p>
                    <p className="text-lg font-bold text-white tabular-nums">{stats.apg.toFixed(1)}</p>
                  </div>
                </div>

                {/* AI insight text */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-white/90 leading-relaxed whitespace-pre-wrap">
                    {insight}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <p className="text-xs text-white/40">
                    Powered by AI • Analysis based on current team statistics and performance
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

