'use client';

/**
 * TopPlayerComparison.tsx
 * Side-by-side view of top 3 players from each team (per mock requirements)
 * Shows: Name, headshot, minutes, points, rebounds, assists, 3PT made/attempted, 3PT%
 */

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateShootingPct, formatPercentage } from '@/lib/stat-utils';

export interface TopPlayerData {
  name: string;
  headshot?: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  fg3m: number;
  fg3a: number;
  fgm?: number;
  fga?: number;
  plusMinus?: string;
}

export interface TopPlayerComparisonProps {
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo?: string;
    color?: string;
    topPlayers: TopPlayerData[];
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo?: string;
    color?: string;
    topPlayers: TopPlayerData[];
  };
  status: 'live' | 'halftime' | 'final' | 'scheduled';
  onViewFullStats?: () => void;
}

function PlayerHeadshot({ src, name, size = 48 }: { src?: string; name: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const fallbackUrl = 'https://a.espncdn.com/i/headshots/nba/players/full/0.png';
  
  return (
    <div 
      className="rounded-lg overflow-hidden bg-white/10 flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <Image
        src={imgError ? fallbackUrl : (src || fallbackUrl)}
        alt={name}
        width={size}
        height={size}
        className="object-cover"
        onError={() => setImgError(true)}
        unoptimized
      />
    </div>
  );
}

function TeamLogo({ src, abbreviation, size = 32 }: { src?: string; abbreviation: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const url = src || `https://a.espncdn.com/i/teamlogos/nba/500/${abbreviation.toLowerCase()}.png`;
  
  if (imgError) {
    return (
      <div 
        className="rounded flex items-center justify-center text-xs font-bold text-white bg-white/20"
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

function PlayerRow({ player, rank }: { player: TopPlayerData; rank: number }) {
  // Calculate 3PT% - CRITICAL: Must be accurate (made/attempted)
  const fg3Pct = calculateShootingPct(player.fg3m, player.fg3a);
  const fg3PctDisplay = player.fg3a > 0 ? formatPercentage(fg3Pct) : '—';
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      {/* Rank badge */}
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
        rank === 1 && "bg-yellow-500/30 text-yellow-400",
        rank === 2 && "bg-slate-400/30 text-slate-300",
        rank === 3 && "bg-orange-600/30 text-orange-400"
      )}>
        {rank}
      </div>
      
      {/* Player headshot */}
      <PlayerHeadshot src={player.headshot} name={player.name} size={40} />
      
      {/* Player info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white text-sm truncate">{player.name}</p>
        <p className="text-xs text-white/50">{player.minutes} MIN</p>
      </div>
      
      {/* Stats grid */}
      <div className="flex items-center gap-2 text-xs">
        {/* Points - highlighted */}
        <div className="text-center min-w-[32px]">
          <p className="font-bold text-white text-sm">{player.points}</p>
          <p className="text-white/40 uppercase text-[10px]">PTS</p>
        </div>
        
        {/* Rebounds */}
        <div className="text-center min-w-[28px]">
          <p className="font-medium text-white/80">{player.rebounds}</p>
          <p className="text-white/40 uppercase text-[10px]">REB</p>
        </div>
        
        {/* Assists */}
        <div className="text-center min-w-[28px]">
          <p className="font-medium text-white/80">{player.assists}</p>
          <p className="text-white/40 uppercase text-[10px]">AST</p>
        </div>
        
        {/* 3PT - with percentage */}
        <div className="text-center min-w-[48px] bg-white/5 rounded px-1.5 py-0.5">
          <p className="font-medium text-blue-400">
            {player.fg3m}-{player.fg3a}
          </p>
          <p className="text-white/50 text-[10px]">{fg3PctDisplay}</p>
        </div>
      </div>
    </div>
  );
}

function TeamColumn({ 
  team, 
  isHome 
}: { 
  team: TopPlayerComparisonProps['homeTeam']; 
  isHome: boolean;
}) {
  return (
    <div className="flex-1 min-w-0">
      {/* Team header */}
      <div className={cn(
        "flex items-center gap-2 mb-3 p-2 rounded-lg",
        isHome ? "bg-green-500/10" : "bg-blue-500/10"
      )}>
        <TeamLogo src={team.logo} abbreviation={team.abbreviation} size={28} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{team.name}</p>
          <p className="text-xs text-white/50">{isHome ? 'Home' : 'Away'}</p>
        </div>
        <div className={cn(
          "text-2xl font-bold tabular-nums",
          isHome ? "text-green-400" : "text-blue-400"
        )}>
          {team.score}
        </div>
      </div>
      
      {/* Top 3 Players */}
      <div className="space-y-2">
        {team.topPlayers.length > 0 ? (
          team.topPlayers.slice(0, 3).map((player, idx) => (
            <PlayerRow key={player.name} player={player} rank={idx + 1} />
          ))
        ) : (
          <p className="text-sm text-white/40 text-center py-4">
            No player data available
          </p>
        )}
      </div>
    </div>
  );
}

export function TopPlayerComparison({
  gameId,
  homeTeam,
  awayTeam,
  status,
  onViewFullStats,
}: TopPlayerComparisonProps) {
  const isFinal = status === 'final';
  const homeWon = isFinal && homeTeam.score > awayTeam.score;
  const awayWon = isFinal && awayTeam.score > homeTeam.score;
  
  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between border-b border-white/10",
        status === 'live' && "bg-red-500/10",
        status === 'halftime' && "bg-yellow-500/10",
        status === 'final' && "bg-green-500/10"
      )}>
        <div className="flex items-center gap-2">
          <Trophy className={cn(
            "w-4 h-4",
            status === 'live' && "text-red-400",
            status === 'final' && "text-green-400"
          )} />
          <span className="text-sm font-medium text-white">
            Top Performers
          </span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            status === 'live' && "bg-red-500/20 text-red-400",
            status === 'halftime' && "bg-yellow-500/20 text-yellow-400",
            status === 'final' && "bg-green-500/20 text-green-400",
            status === 'scheduled' && "bg-blue-500/20 text-blue-400"
          )}>
            {status === 'live' ? 'LIVE' : 
             status === 'halftime' ? 'HALFTIME' : 
             status === 'final' ? 'FINAL' : 'SCHEDULED'}
          </span>
        </div>
        
        {(homeWon || awayWon) && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Target className="w-3 h-3" />
            {homeWon ? homeTeam.abbreviation : awayTeam.abbreviation} wins
          </div>
        )}
      </div>
      
      {/* Side-by-side comparison */}
      <div className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <TeamColumn team={awayTeam} isHome={false} />
          
          {/* Divider */}
          <div className="hidden md:flex flex-col items-center justify-center px-2">
            <div className="w-px h-full bg-white/10"></div>
          </div>
          <div className="md:hidden h-px bg-white/10 my-2"></div>
          
          <TeamColumn team={homeTeam} isHome={true} />
        </div>
      </div>
      
      {/* CTA Button */}
      <div className="px-4 pb-4">
        <Link
          href={`/nba/games/${gameId}`}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-blue-500/20 hover:from-orange-500/30 hover:to-blue-500/30 border border-white/10 hover:border-white/20 text-white font-medium text-sm transition-all"
          onClick={onViewFullStats}
        >
          Check out full game stats
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default TopPlayerComparison;
