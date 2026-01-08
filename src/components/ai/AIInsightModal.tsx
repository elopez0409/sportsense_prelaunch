'use client';

// AI Insight Modal - Displays AI-generated game insights
// Used by GameCard and notifications to show detailed AI analysis

import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameStatus: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  gameDate?: string;
}

// Cache for AI insights to avoid re-fetching
const insightCache = new Map<string, { content: string; timestamp: number; status: string }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AIInsightModal({
  isOpen,
  onClose,
  gameId,
  gameStatus,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  gameDate,
}: AIInsightModalProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine summary type based on game status
  const getSummaryType = useCallback(() => {
    if (gameStatus === 'FINAL') return 'final';
    if (gameStatus === 'LIVE' || gameStatus === 'HALFTIME') return 'halftime';
    return 'pregame';
  }, [gameStatus]);

  // Create cache key based on game state
  const getCacheKey = useCallback(() => {
    const type = getSummaryType();
    // Include scores in cache key for live/final games to get fresh insights when score changes
    if (type === 'halftime' || type === 'final') {
      return `${gameId}-${type}-${homeScore}-${awayScore}`;
    }
    return `${gameId}-${type}`;
  }, [gameId, getSummaryType, homeScore, awayScore]);

  const fetchInsight = useCallback(async (forceRefresh = false) => {
    const cacheKey = getCacheKey();
    const summaryType = getSummaryType();

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
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          type: summaryType,
          homeTeamAbbr: homeTeam,
          awayTeamAbbr: awayTeam,
          gameDate,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok && data?.success) {
        const content = data.data.summary;
        setInsight(content);

        // Cache the result
        insightCache.set(cacheKey, {
          content,
          timestamp: Date.now(),
          status: gameStatus,
        });
        return;
      }

      const chatResponse = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a ${summaryType === 'final' ? 'final recap' : summaryType === 'halftime' ? 'halftime report' : 'pregame preview'} for ${awayTeam} @ ${homeTeam}.`,
          type: 'game',
          length: 'short',
          requestVisuals: false,
          gameContext: {
            homeTeam,
            awayTeam,
            homeScore: homeScore ?? null,
            awayScore: awayScore ?? null,
            period: null,
            gameClock: null,
            status: gameStatus,
          },
        }),
      });

      const chatData = await chatResponse.json();
      if (!chatResponse.ok || !chatData?.response) {
        throw new Error(data?.error?.message || 'Failed to fetch AI insight');
      }

      const content = chatData.response;
      setInsight(content);

      insightCache.set(cacheKey, {
        content,
        timestamp: Date.now(),
        status: gameStatus,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI insight');
    } finally {
      setIsLoading(false);
    }
  }, [
    gameId,
    getCacheKey,
    getSummaryType,
    gameStatus,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    gameDate,
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

  const summaryType = getSummaryType();
  const typeLabels = {
    pregame: 'Pregame Preview',
    halftime: 'Live Analysis',
    final: 'Game Recap',
  };

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
          className="glass-dark rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl border border-white/10 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-orange-500/10 to-purple-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-purple-600">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">AI Insight</h2>
                <p className="text-xs text-white/60">
                  {awayTeam} @ {homeTeam} • {typeLabels[summaryType]}
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
                <p className="mt-4 text-white/60 text-sm">Generating AI insight...</p>
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
                {/* Score display for live/final games */}
                {(summaryType === 'halftime' || summaryType === 'final') && (
                  <div className="flex items-center justify-center gap-4 py-3 px-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-center">
                      <p className="text-white/60 text-xs">{awayTeam}</p>
                      <p className="text-2xl font-bold text-white tabular-nums">{awayScore}</p>
                    </div>
                    <div className="text-white/30 text-sm">vs</div>
                    <div className="text-center">
                      <p className="text-white/60 text-xs">{homeTeam}</p>
                      <p className="text-2xl font-bold text-white tabular-nums">{homeScore}</p>
                    </div>
                  </div>
                )}

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
                    Powered by AI • Analysis based on available game data
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

// Utility function to get cached insight (for notifications)
export function getCachedInsight(gameId: string, status: string): string | null {
  const type = status === 'FINAL' ? 'final' : status === 'HALFTIME' ? 'halftime' : 'pregame';
  
  // Look for any cached insight for this game and type
  for (const [key, value] of insightCache.entries()) {
    if (key.startsWith(`${gameId}-${type}`)) {
      if (Date.now() - value.timestamp < CACHE_DURATION) {
        return value.content;
      }
    }
  }
  return null;
}

// Utility function to pre-fetch and cache insight
export async function prefetchInsight(
  gameId: string,
  type: 'pregame' | 'halftime' | 'final'
): Promise<string | null> {
  try {
    const response = await fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, type }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return null;
    }

    const content = data.data.summary;
    const cacheKey = `${gameId}-${type}`;
    
    insightCache.set(cacheKey, {
      content,
      timestamp: Date.now(),
      status: type,
    });

    return content;
  } catch {
    return null;
  }
}
