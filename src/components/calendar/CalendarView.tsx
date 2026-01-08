'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Game {
  id: string;
  scheduledAt: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    abbreviation: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  season?: {
    league?: {
      abbreviation: string;
    };
  } | null;
}

interface CalendarViewProps {
  year: number;
  month: number;
  gamesByDate: Record<string, Game[]>;
  sportFilter: string;
}

function TeamLogo({ team, size = 20 }: { team: Game['homeTeam']; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation.toLowerCase()}.png`;
  
  if (imgError) {
    return (
      <div 
        className="rounded flex items-center justify-center text-[8px] font-bold text-white"
        style={{ 
          width: size, 
          height: size,
          background: team.primaryColor || '#333'
        }}
      >
        {team.abbreviation.slice(0, 2)}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={team.name}
      width={size}
      height={size}
      className="object-contain"
      onError={() => setImgError(true)}
    />
  );
}

function DayCell({ 
  date, 
  games, 
  isCurrentMonth, 
  isToday 
}: { 
  date: Date; 
  games: Game[];
  isCurrentMonth: boolean;
  isToday: boolean;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const dayNum = date.getDate();
  const hasGames = games.length > 0;
  const hasLive = games.some(g => g.status === 'LIVE');

  return (
    <div
      className={cn(
        "relative min-h-[100px] p-2 border border-white/5 transition-colors",
        isCurrentMonth ? "bg-white/[0.02]" : "bg-transparent opacity-40",
        isToday && "ring-2 ring-blue-500/50 bg-blue-500/5",
        hasGames && "hover:bg-white/5 cursor-pointer"
      )}
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "text-sm font-medium",
          isToday ? "text-blue-400" : isCurrentMonth ? "text-white/80" : "text-white/30"
        )}>
          {dayNum}
        </span>
        
        {hasLive && (
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
      </div>

      {/* Game previews */}
      {hasGames && (
        <div className="space-y-1">
          {games.slice(0, 3).map((game) => (
            <Link
              key={game.id}
              href={`/nba/games/${game.id}`}
              className="block"
            >
              <div className={cn(
                "flex items-center gap-1 px-1 py-0.5 rounded text-[10px]",
                game.status === 'LIVE' 
                  ? "bg-red-500/20 text-red-300" 
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              )}>
                <TeamLogo team={game.awayTeam} size={14} />
                <span>@</span>
                <TeamLogo team={game.homeTeam} size={14} />
                {game.status === 'LIVE' && (
                  <span className="ml-auto text-red-400">LIVE</span>
                )}
              </div>
            </Link>
          ))}
          
          {games.length > 3 && (
            <p className="text-[10px] text-white/40 text-center">
              +{games.length - 3} more
            </p>
          )}
        </div>
      )}

      {/* Hover popup */}
      {showPopup && games.length > 0 && (
        <div className="absolute z-50 left-full top-0 ml-2 w-64 p-3 glass-dark rounded-xl shadow-xl animate-fade-in">
          <p className="text-sm font-semibold text-white mb-2">
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-xs text-white/50 mb-3">{games.length} games</p>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/nba/games/${game.id}`}
                className="block p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <TeamLogo team={game.awayTeam} size={20} />
                    <span className="text-white/70">{game.awayTeam.abbreviation}</span>
                  </div>
                  <span className="text-white/40">@</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/70">{game.homeTeam.abbreviation}</span>
                    <TeamLogo team={game.homeTeam} size={20} />
                  </div>
                </div>
                
                {game.status === 'LIVE' ? (
                  <p className="text-center text-[10px] text-red-400 mt-1">
                    LIVE: {game.awayScore} - {game.homeScore}
                  </p>
                ) : game.status === 'FINAL' ? (
                  <p className="text-center text-[10px] text-white/50 mt-1">
                    Final: {game.awayScore} - {game.homeScore}
                  </p>
                ) : (
                  <p className="text-center text-[10px] text-white/40 mt-1">
                    {new Date(game.scheduledAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CalendarView({ year, month, gamesByDate, sportFilter }: CalendarViewProps) {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Get the day of week for the first day (0 = Sunday)
  const startDayOfWeek = firstDay.getDay();
  
  // Generate all days to display
  const days: Date[] = [];
  
  // Add days from previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push(date);
  }
  
  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  // Add days from next month to complete the grid
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {weekDays.map((day) => (
          <div key={day} className="p-3 text-center text-sm font-medium text-white/50">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const games = gamesByDate[dateKey] || [];
          const isCurrentMonth = date.getMonth() === month;
          const isToday = date.toDateString() === today.toDateString();

          return (
            <DayCell
              key={index}
              date={date}
              games={games}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
            />
          );
        })}
      </div>
    </div>
  );
}





