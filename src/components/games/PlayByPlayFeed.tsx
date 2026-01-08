'use client';

// Play-by-Play Feed Component - Live game events display
// Shows recent plays with scoring highlights

import { useState, useMemo } from 'react';
import { ChevronDown, Zap, Target, Trophy } from 'lucide-react';
import type { ESPNPlay, ESPNTeam } from '@/services/nba/espn-api';
import { cn } from '@/lib/utils';

interface PlayByPlayFeedProps {
  plays: ESPNPlay[];
  homeTeam: ESPNTeam;
  awayTeam: ESPNTeam;
}

const PLAYS_PER_PAGE = 20;

export function PlayByPlayFeed({ plays, homeTeam, awayTeam }: PlayByPlayFeedProps) {
  const [visiblePlays, setVisiblePlays] = useState(PLAYS_PER_PAGE);
  const [filterPeriod, setFilterPeriod] = useState<number | null>(null);
  const [showScoresOnly, setShowScoresOnly] = useState(false);

  // Get unique periods
  const periods = useMemo(() => {
    const uniquePeriods = [...new Set(plays.map(p => p.period))].sort((a, b) => a - b);
    return uniquePeriods;
  }, [plays]);

  // Filter plays
  const filteredPlays = useMemo(() => {
    let result = plays;
    
    if (filterPeriod !== null) {
      result = result.filter(p => p.period === filterPeriod);
    }
    
    if (showScoresOnly) {
      result = result.filter(p => p.scoringPlay);
    }
    
    return result;
  }, [plays, filterPeriod, showScoresOnly]);

  const displayedPlays = filteredPlays.slice(0, visiblePlays);
  const hasMore = visiblePlays < filteredPlays.length;

  const loadMore = () => {
    setVisiblePlays(prev => prev + PLAYS_PER_PAGE);
  };

  // Determine play icon and styling
  const getPlayIcon = (play: ESPNPlay) => {
    if (play.scoringPlay) {
      const type = play.type?.toLowerCase() || '';
      if (type.includes('three') || type.includes('3-point')) {
        return <Target className="w-4 h-4 text-green-400" />;
      }
      if (type.includes('dunk') || type.includes('slam')) {
        return <Zap className="w-4 h-4 text-orange-400" />;
      }
      return <Trophy className="w-4 h-4 text-yellow-400" />;
    }
    return null;
  };

  // Period label
  const getPeriodLabel = (period: number) => {
    if (period <= 4) return `Q${period}`;
    return `OT${period - 4}`;
  };

  if (plays.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <p>No plays recorded yet</p>
        <p className="text-sm mt-2">Play-by-play will appear as the game progresses</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Period Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Period:</span>
          <button
            onClick={() => setFilterPeriod(null)}
            className={cn(
              "px-3 py-1 text-xs rounded-full transition-colors",
              filterPeriod === null
                ? "bg-blue-500/20 text-blue-400"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            All
          </button>
          {periods.map(period => (
            <button
              key={period}
              onClick={() => setFilterPeriod(period)}
              className={cn(
                "px-3 py-1 text-xs rounded-full transition-colors",
                filterPeriod === period
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              )}
            >
              {getPeriodLabel(period)}
            </button>
          ))}
        </div>

        {/* Scoring Plays Only */}
        <button
          onClick={() => setShowScoresOnly(!showScoresOnly)}
          className={cn(
            "px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1",
            showScoresOnly
              ? "bg-orange-500/20 text-orange-400"
              : "bg-white/5 text-white/60 hover:bg-white/10"
          )}
        >
          <Trophy className="w-3 h-3" />
          Scoring Plays
        </button>
      </div>

      {/* Plays List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {displayedPlays.map((play, idx) => {
          const prevPlay = displayedPlays[idx + 1];
          const showPeriodHeader = !prevPlay || prevPlay.period !== play.period;

          return (
            <div key={play.id || idx}>
              {/* Period Header */}
              {showPeriodHeader && (
                <div className="flex items-center gap-2 py-2 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-bold text-white/60 uppercase">
                    {getPeriodLabel(play.period)}
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              )}

              {/* Play Item */}
              <div
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-colors",
                  play.scoringPlay 
                    ? "bg-gradient-to-r from-white/5 to-transparent border-l-2 border-yellow-500/50" 
                    : "hover:bg-white/5"
                )}
              >
                {/* Clock */}
                <div className="w-14 flex-shrink-0 text-right">
                  <span className="text-sm font-mono text-white/50">{play.clock}</span>
                </div>

                {/* Icon */}
                <div className="w-6 flex-shrink-0 flex justify-center pt-0.5">
                  {getPlayIcon(play)}
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    play.scoringPlay ? "text-white font-medium" : "text-white/70"
                  )}>
                    {play.description}
                  </p>
                </div>

                {/* Score */}
                <div className="w-20 flex-shrink-0 text-right">
                  <span className="text-sm font-mono text-white/60">
                    <span className="text-orange-400/80">{play.awayScore}</span>
                    <span className="text-white/30"> - </span>
                    <span className="text-blue-400/80">{play.homeScore}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {hasMore && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <ChevronDown className="w-4 h-4" />
          Load More ({filteredPlays.length - visiblePlays} remaining)
        </button>
      )}

      {/* Play Count */}
      <div className="text-center text-xs text-white/40 pt-2">
        Showing {displayedPlays.length} of {filteredPlays.length} plays
        {showScoresOnly && ' (scoring only)'}
      </div>
    </div>
  );
}




