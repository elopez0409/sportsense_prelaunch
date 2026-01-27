'use client';

/**
 * WeekView.tsx
 * Shows the previous 7 days with clear date headers and games listed under each day.
 * Each day is clearly delineated; clicking a game updates the recap + player comparison.
 */

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Calendar, ChevronRight, Trophy, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WeekViewGame {
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
    record?: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
    record?: string;
  };
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  venue?: string;
  broadcast?: string;
  clock?: string;
  period?: number;
}

export interface WeekViewProps {
  gamesByDate: Record<string, WeekViewGame[]>;
  onSelectGame?: (gameId: string) => void;
  selectedGameId?: string;
}

function TeamLogo({ abbreviation, size = 24 }: { abbreviation: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const url = `https://a.espncdn.com/i/teamlogos/nba/500/${abbreviation.toLowerCase()}.png`;
  
  if (imgError) {
    return (
      <div 
        className="rounded flex items-center justify-center text-[10px] font-bold text-white bg-white/20"
        style={{ width: size, height: size }}
      >
        {abbreviation}
      </div>
    );
  }
  
  return (
    <Image
      src={url}
      alt={abbreviation}
      width={size}
      height={size}
      className="object-contain"
      onError={() => setImgError(true)}
      unoptimized
    />
  );
}

function GameCard({ 
  game, 
  isSelected,
  onSelect 
}: { 
  game: WeekViewGame; 
  isSelected?: boolean;
  onSelect?: (gameId: string) => void;
}) {
  const isLive = game.status === 'live' || game.status === 'halftime';
  const isFinal = game.status === 'final';
  const homeWon = isFinal && game.homeTeam.score > game.awayTeam.score;
  const awayWon = isFinal && game.awayTeam.score > game.homeTeam.score;
  
  return (
    <div
      className={cn(
        "p-3 rounded-xl border transition-all cursor-pointer",
        isSelected 
          ? "border-orange-500/50 bg-orange-500/10" 
          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20",
        isLive && "border-red-500/30 bg-red-500/5"
      )}
      onClick={() => onSelect?.(game.gameId)}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Teams */}
        <div className="flex-1 space-y-2">
          {/* Away Team */}
          <div className="flex items-center gap-2">
            <TeamLogo abbreviation={game.awayTeam.abbreviation} size={20} />
            <span className={cn(
              "font-medium text-sm",
              awayWon ? "text-green-400" : "text-white/80"
            )}>
              {game.awayTeam.abbreviation}
            </span>
            {game.awayTeam.record && (
              <span className="text-xs text-white/40">{game.awayTeam.record}</span>
            )}
            <span className="ml-auto font-bold tabular-nums">
              {game.awayTeam.score}
            </span>
          </div>
          
          {/* Home Team */}
          <div className="flex items-center gap-2">
            <TeamLogo abbreviation={game.homeTeam.abbreviation} size={20} />
            <span className={cn(
              "font-medium text-sm",
              homeWon ? "text-green-400" : "text-white/80"
            )}>
              {game.homeTeam.abbreviation}
            </span>
            {game.homeTeam.record && (
              <span className="text-xs text-white/40">{game.homeTeam.record}</span>
            )}
            <span className="ml-auto font-bold tabular-nums">
              {game.homeTeam.score}
            </span>
          </div>
        </div>
        
        {/* Status */}
        <div className="flex flex-col items-end gap-1">
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            isLive && "bg-red-500/20 text-red-400",
            game.status === 'halftime' && "bg-yellow-500/20 text-yellow-400",
            isFinal && "bg-green-500/20 text-green-400",
            game.status === 'scheduled' && "bg-blue-500/20 text-blue-400"
          )}>
            {isLive ? `Q${game.period} ${game.clock}` : 
             game.status === 'halftime' ? 'HALF' :
             isFinal ? 'FINAL' : 
             game.clock || 'TBD'}
          </span>
          
          <Link
            href={`/nba/games/${game.gameId}`}
            className="text-xs text-white/40 hover:text-white flex items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            Details <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
      
      {/* Venue (optional) */}
      {game.venue && (
        <div className="mt-2 flex items-center gap-1 text-xs text-white/30">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{game.venue}</span>
        </div>
      )}
    </div>
  );
}

function DaySection({
  date,
  games,
  isToday,
  selectedGameId,
  onSelectGame,
}: {
  date: string; // YYYY-MM-DD
  games: WeekViewGame[];
  isToday: boolean;
  selectedGameId?: string;
  onSelectGame?: (gameId: string) => void;
}) {
  const dateObj = new Date(date + 'T12:00:00'); // Noon to avoid timezone issues
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  const liveCount = games.filter(g => g.status === 'live' || g.status === 'halftime').length;
  const finalCount = games.filter(g => g.status === 'final').length;
  
  return (
    <div className="mb-6">
      {/* Date Header */}
      <div className={cn(
        "flex items-center justify-between mb-3 pb-2 border-b",
        isToday ? "border-orange-500/30" : "border-white/10"
      )}>
        <div className="flex items-center gap-2">
          <Calendar className={cn(
            "w-4 h-4",
            isToday ? "text-orange-400" : "text-white/40"
          )} />
          <h3 className={cn(
            "font-semibold",
            isToday ? "text-orange-400" : "text-white"
          )}>
            {isToday ? 'Today' : dayName}
          </h3>
          <span className="text-sm text-white/50">{monthDay}</span>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          {liveCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
              {liveCount} LIVE
            </span>
          )}
          <span className="text-white/40">{games.length} games</span>
        </div>
      </div>
      
      {/* Games List */}
      {games.length > 0 ? (
        <div className="space-y-2">
          {games.map(game => (
            <GameCard
              key={game.gameId}
              game={game}
              isSelected={selectedGameId === game.gameId}
              onSelect={onSelectGame}
            />
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-white/40 text-sm bg-white/5 rounded-xl">
          No games scheduled
        </div>
      )}
    </div>
  );
}

export function WeekView({
  gamesByDate,
  onSelectGame,
  selectedGameId,
}: WeekViewProps) {
  // Get the last 7 days (including today)
  const today = new Date();
  const todayKey = today.toISOString().split('T')[0];
  
  const last7Days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    last7Days.push(date.toISOString().split('T')[0]);
  }
  
  // Count total stats
  const totalGames = Object.values(gamesByDate).flat().length;
  const liveGames = Object.values(gamesByDate).flat().filter(g => g.status === 'live' || g.status === 'halftime').length;
  const finishedGames = Object.values(gamesByDate).flat().filter(g => g.status === 'final').length;
  
  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-2xl border border-white/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <Calendar className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">This Week</h2>
            <p className="text-xs text-white/50">Last 7 days</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-sm">
          {liveGames > 0 && (
            <span className="text-red-400">{liveGames} live</span>
          )}
          <span className="text-white/60">{totalGames} games</span>
        </div>
      </div>
      
      {/* Days */}
      <div className="space-y-1">
        {last7Days.map(dateKey => (
          <DaySection
            key={dateKey}
            date={dateKey}
            games={gamesByDate[dateKey] || []}
            isToday={dateKey === todayKey}
            selectedGameId={selectedGameId}
            onSelectGame={onSelectGame}
          />
        ))}
      </div>
      
      {/* Empty State */}
      {totalGames === 0 && (
        <div className="py-12 text-center">
          <Trophy className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No games found in the last 7 days</p>
        </div>
      )}
    </div>
  );
}

export default WeekView;
