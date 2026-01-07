'use client';

// Scoreboard - Grid of game cards with live updates

import { useEffect, useState } from 'react';
import { GameCard } from './GameCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { GameInfo } from '@/types/nba';

interface ScoreboardProps {
  initialGames: GameInfo[];
  date?: string;
}

export function Scoreboard({ initialGames, date }: ScoreboardProps) {
  const [games, setGames] = useState<GameInfo[]>(initialGames);
  const [isConnected, setIsConnected] = useState(false);

  // SSE for live updates
  useEffect(() => {
    const hasLiveGames = games.some((g) => g.status === 'LIVE');
    if (!hasLiveGames) return;

    const eventSource = new EventSource('/api/live');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.addEventListener('gameUpdate', (event) => {
      const update = JSON.parse(event.data);
      
      setGames((prev) =>
        prev.map((game) => {
          // Match by external ID or tricode
          const isMatch = 
            game.homeTeam.abbreviation === update.homeTeam &&
            game.awayTeam.abbreviation === update.awayTeam;
          
          if (!isMatch) return game;

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

    eventSource.addEventListener('error', () => {
      setIsConnected(false);
    });

    eventSource.addEventListener('reconnect', () => {
      eventSource.close();
      // Reconnect will be handled by re-mounting
    });

    return () => {
      eventSource.close();
    };
  }, [games]);

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
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-yellow-500'
            }`}
          />
          <span className="text-white/60">
            {isConnected ? 'Live updates connected' : 'Connecting...'}
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

export function ScoreboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <Skeleton className="h-5 w-20" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-16 mt-1" />
                </div>
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-16 mt-1" />
                </div>
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}



