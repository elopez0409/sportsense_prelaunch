'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import type { GameInfo, TeamInfo } from '@/types/nba';
import { Clock, MapPin, Tv, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NBAScoreboardProps {
  initialGames: GameInfo[];
  date?: string;
}

function TeamLogo({ team, size = 48 }: { team: TeamInfo; size?: number }) {
  const [imgError, setImgError] = useState(false);
  
  // Use ESPN CDN for logos (more reliable)
  const logoUrl = `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation.toLowerCase()}.png`;
  
  if (imgError) {
    return (
      <div 
        className="rounded-lg flex items-center justify-center font-bold text-white"
        style={{ 
          width: size, 
          height: size,
          background: `linear-gradient(135deg, ${team.primaryColor || '#333'} 0%, ${team.secondaryColor || '#555'} 100%)`
        }}
      >
        {team.abbreviation}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={team.fullName}
      width={size}
      height={size}
      className="object-contain"
      onError={() => setImgError(true)}
    />
  );
}

function GameCard({ game, onBigPlay }: { game: GameInfo; onBigPlay?: (game: GameInfo, desc: string) => void }) {
  const isLive = game.status === 'LIVE';
  const isFinal = game.status === 'FINAL';
  const isScheduled = game.status === 'SCHEDULED';

  const homeWinning = (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const awayWinning = (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const closeGame = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0)) <= 5;

  const gameTime = new Date(game.scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Link href={`/nba/games/${game.id}`}>
      <div className={cn(
        "glass rounded-xl p-4 card-hover cursor-pointer overflow-hidden relative",
        isLive && closeGame && "live-pulse"
      )}>
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-3">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-red-400">
                Q{game.period} {game.gameClock}
              </span>
            </span>
          ) : isFinal ? (
            <span className="text-xs font-semibold text-white/50">FINAL</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              {gameTime}
            </span>
          )}

          {game.nationalTv && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <Tv className="w-3 h-3" />
              {game.nationalTv}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-3">
          {/* Away Team */}
          <div className={cn(
            "flex items-center justify-between",
            isFinal && awayWinning && "opacity-100",
            isFinal && homeWinning && "opacity-50"
          )}>
            <div className="flex items-center gap-3">
              <TeamLogo team={game.awayTeam} size={40} />
              <div>
                <p className={cn(
                  "font-semibold text-white",
                  awayWinning && isLive && "text-green-400"
                )}>
                  {game.awayTeam.abbreviation}
                </p>
                <p className="text-xs text-white/50">{game.awayTeam.city}</p>
              </div>
            </div>
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              awayWinning ? "text-white" : "text-white/60"
            )}>
              {game.awayScore ?? '-'}
            </span>
          </div>

          {/* Home Team */}
          <div className={cn(
            "flex items-center justify-between",
            isFinal && homeWinning && "opacity-100",
            isFinal && awayWinning && "opacity-50"
          )}>
            <div className="flex items-center gap-3">
              <TeamLogo team={game.homeTeam} size={40} />
              <div>
                <p className={cn(
                  "font-semibold text-white",
                  homeWinning && isLive && "text-green-400"
                )}>
                  {game.homeTeam.abbreviation}
                </p>
                <p className="text-xs text-white/50">{game.homeTeam.city}</p>
              </div>
            </div>
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              homeWinning ? "text-white" : "text-white/60"
            )}>
              {game.homeScore ?? '-'}
            </span>
          </div>
        </div>

        {/* Venue */}
        {game.venue && isScheduled && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-1 text-xs text-white/40">
            <MapPin className="w-3 h-3" />
            {game.venue}
          </div>
        )}

        {/* AI Insight Badge */}
        {isLive && closeGame && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs">
            <Sparkles className="w-3 h-3 text-orange-400" />
            <span className="text-orange-400">Close game! Click for AI insights</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function NBAScoreboard({ initialGames, date }: NBAScoreboardProps) {
  const [games, setGames] = useState<GameInfo[]>(initialGames);
  const [isConnected, setIsConnected] = useState(false);
  const { addNotification } = useNotifications();

  // Track previous scores for notifications
  const handleScoreUpdate = useCallback((game: GameInfo, prevHomeScore: number, prevAwayScore: number) => {
    const scoreDiff = ((game.homeScore ?? 0) + (game.awayScore ?? 0)) - (prevHomeScore + prevAwayScore);
    
    // Big play notification (3+ point play)
    if (scoreDiff >= 3) {
      const scoringTeam = (game.homeScore ?? 0) > prevHomeScore ? game.homeTeam : game.awayTeam;
      addNotification({
        type: 'highlight',
        title: `${scoringTeam.abbreviation} scores!`,
        message: `${scoreDiff === 3 ? 'Three-pointer' : `${scoreDiff} points`}! Score: ${game.awayTeam.abbreviation} ${game.awayScore} - ${game.homeTeam.abbreviation} ${game.homeScore}`,
        sport: 'NBA',
      });
    }

    // Close game notification
    const margin = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
    if (game.period && game.period >= 4 && margin <= 3) {
      addNotification({
        type: 'alert',
        title: 'Nail-biter! 🔥',
        message: `${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} - Only ${margin} point${margin !== 1 ? 's' : ''} apart in Q${game.period}!`,
        sport: 'NBA',
      });
    }
  }, [addNotification]);

  // SSE for live updates
  useEffect(() => {
    const hasLiveGames = games.some((g) => g.status === 'LIVE');
    if (!hasLiveGames) return;

    const eventSource = new EventSource('/api/live/nba');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.addEventListener('gameUpdate', (event) => {
      const update = JSON.parse(event.data);
      
      setGames((prev) =>
        prev.map((game) => {
          const isMatch = 
            game.homeTeam.abbreviation === update.homeTeam &&
            game.awayTeam.abbreviation === update.awayTeam;
          
          if (!isMatch) return game;

          // Check for score changes
          if (game.homeScore !== update.homeScore || game.awayScore !== update.awayScore) {
            handleScoreUpdate(
              { ...game, homeScore: update.homeScore, awayScore: update.awayScore, period: update.period },
              game.homeScore ?? 0,
              game.awayScore ?? 0
            );
          }

          return {
            ...game,
            homeScore: update.homeScore,
            awayScore: update.awayScore,
            period: update.period,
            gameClock: update.gameClock,
            status: update.status,
          };
        })
      );
    });

    eventSource.addEventListener('bigPlay', (event) => {
      const play = JSON.parse(event.data);
      addNotification({
        type: 'highlight',
        title: '🔥 Big Play!',
        message: play.description,
        sport: 'NBA',
      });
    });

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [games, addNotification, handleScoreUpdate]);

  // Polling fallback for score updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/games?date=${date || ''}&sport=nba`);
        if (res.ok) {
          const data = await res.json();
          setGames(data);
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 30000); // 30 second polling

    return () => clearInterval(interval);
  }, [date]);

  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60 text-lg">No games scheduled for this date</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      {games.some((g) => g.status === 'LIVE') && (
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            )}
          />
          <span className="text-white/60">
            {isConnected ? 'Live updates connected' : 'Connecting to live feed...'}
          </span>
        </div>
      )}

      {/* Games grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}

export function NBAScoreboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-4 space-y-4">
          <Skeleton className="h-5 w-20 bg-white/10" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
                <div>
                  <Skeleton className="h-4 w-12 bg-white/10" />
                  <Skeleton className="h-3 w-16 mt-1 bg-white/10" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 bg-white/10" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
                <div>
                  <Skeleton className="h-4 w-12 bg-white/10" />
                  <Skeleton className="h-3 w-16 mt-1 bg-white/10" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}





