'use client';

// Game Card - Displays a single game in the scoreboard

import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatGameStatus } from '@/lib/utils';
import type { GameInfo } from '@/types/nba';

interface GameCardProps {
  game: GameInfo;
}

export function GameCard({ game }: GameCardProps) {
  const isLive = game.status === 'LIVE';
  const isFinal = game.status === 'FINAL';
  
  // Determine winner for final games
  const homeWins = isFinal && game.homeScore > game.awayScore;
  const awayWins = isFinal && game.awayScore > game.homeScore;

  return (
    <Link href={`/games/${game.id}`}>
      <Card className="group relative overflow-hidden hover:border-orange-500/50 transition-all duration-300 hover:shadow-orange-500/10 hover:shadow-2xl cursor-pointer">
        {/* Live indicator glow */}
        {isLive && (
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5 animate-pulse" />
        )}
        
        <div className="p-4 space-y-4">
          {/* Status badge */}
          <div className="flex justify-between items-center">
            <Badge variant={isLive ? 'live' : isFinal ? 'final' : 'scheduled'}>
              {isLive && <span className="mr-1.5 h-2 w-2 rounded-full bg-white animate-ping" />}
              {formatGameStatus(game.status, game.period, game.gameClock, game.scheduledAt)}
            </Badge>
            
            {game.nationalTv && (
              <span className="text-xs text-white/40">{game.nationalTv}</span>
            )}
          </div>

          {/* Teams */}
          <div className="space-y-3">
            {/* Away Team */}
            <div className={`flex items-center justify-between ${awayWins ? 'opacity-100' : isFinal ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: game.awayTeam.primaryColor || '#333' }}
                >
                  {game.awayTeam.logoUrl ? (
                    <Image
                      src={game.awayTeam.logoUrl}
                      alt={game.awayTeam.abbreviation}
                      width={32}
                      height={32}
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="text-white font-bold text-xs">
                      {game.awayTeam.abbreviation}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white">{game.awayTeam.abbreviation}</p>
                  <p className="text-xs text-white/50">{game.awayTeam.city}</p>
                </div>
              </div>
              <span className={`text-2xl font-bold tabular-nums ${awayWins ? 'text-white' : 'text-white/80'}`}>
                {game.awayScore}
              </span>
            </div>

            {/* Home Team */}
            <div className={`flex items-center justify-between ${homeWins ? 'opacity-100' : isFinal ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: game.homeTeam.primaryColor || '#333' }}
                >
                  {game.homeTeam.logoUrl ? (
                    <Image
                      src={game.homeTeam.logoUrl}
                      alt={game.homeTeam.abbreviation}
                      width={32}
                      height={32}
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="text-white font-bold text-xs">
                      {game.homeTeam.abbreviation}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white">{game.homeTeam.abbreviation}</p>
                  <p className="text-xs text-white/50">{game.homeTeam.city}</p>
                </div>
              </div>
              <span className={`text-2xl font-bold tabular-nums ${homeWins ? 'text-white' : 'text-white/80'}`}>
                {game.homeScore}
              </span>
            </div>
          </div>

          {/* Venue */}
          {game.venue && (
            <p className="text-xs text-white/30 text-center">{game.venue}</p>
          )}
        </div>

        {/* Hover effect */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-orange-500 to-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
      </Card>
    </Link>
  );
}



