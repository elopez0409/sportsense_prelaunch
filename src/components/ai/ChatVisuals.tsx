'use client';

// Rich Visual Components for AI Chat Responses
// Renders structured data as beautiful tables, cards, and charts

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  Trophy, TrendingUp, TrendingDown, Minus, Target, Flame, Shield,
  Activity, Clock, MapPin, Tv, ChevronRight, Users, BarChart3,
  Zap, Star, AlertTriangle, CheckCircle, Calendar
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface VisualGameData {
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record?: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record?: string;
  };
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  period?: number;
  clock?: string;
  venue?: string;
  broadcast?: string;
  date?: string;
}

export interface VisualPlayerData {
  id: string;
  name: string;
  team: string;
  teamLogo: string;
  headshot: string;
  position: string;
  number?: string;
  stats: {
    ppg: number;
    rpg: number;
    apg: number;
    spg?: number;
    bpg?: number;
    fgPct?: number;
    fg3Pct?: number;
    ftPct?: number;
    mpg?: number;
    gp?: number;
    gamesPlayed?: number;
  };
  careerStats?: {
    ppg: number;
    rpg: number;
    apg: number;
    games: number;
  };
  gameStats?: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    minutes: string;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
  };
}

export interface VisualStandingsData {
  conference: 'East' | 'West';
  teams: Array<{
    rank: number;
    name: string;
    abbreviation: string;
    logo: string;
    wins: number;
    losses: number;
    winPct: string;
    gamesBehind: string;
    streak?: string;
    isPlayoff?: boolean;
    isPlayIn?: boolean;
  }>;
}

export interface VisualStatsTable {
  title: string;
  headers: string[];
  rows: Array<{
    label: string;
    values: (string | number)[];
    highlight?: 'home' | 'away' | 'none';
  }>;
  homeTeam?: string;
  awayTeam?: string;
}

export interface VisualLeadersData {
  category: string;
  players: Array<{
    rank: number;
    name: string;
    team: string;
    teamLogo: string;
    headshot: string;
    value: number | string;
    trend?: 'up' | 'down' | 'same';
  }>;
}

export type AIVisualResponse = 
  | { type: 'games'; data: VisualGameData[]; dateDisplay?: string }
  | { type: 'game'; data: VisualGameData }
  | { type: 'player'; data: VisualPlayerData }
  | { type: 'players'; data: VisualPlayerData[] }
  | { type: 'standings'; data: VisualStandingsData[] }
  | { type: 'statsTable'; data: VisualStatsTable }
  | { type: 'leaders'; data: VisualLeadersData }
  | { type: 'comparison'; data: PlayerComparisonVisual };

export interface PlayerComparisonVisual {
  player1: VisualPlayerData;
  player2: VisualPlayerData;
  verdict: string;
  categories: Array<{
    name: string;
    player1Value: number | string;
    player2Value: number | string;
    winner: 'player1' | 'player2' | 'tie';
  }>;
}

// ============================================
// GAME CARD COMPONENT
// ============================================

export function GameCard({ game }: { game: VisualGameData }) {
  const isLive = game.status === 'live' || game.status === 'halftime';
  const isFinal = game.status === 'final';
  
  const homeWinning = game.homeTeam.score > game.awayTeam.score;
  const awayWinning = game.awayTeam.score > game.homeTeam.score;

  return (
    <Link 
      href={`/nba/games/${game.gameId}`}
      className="block bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-white/10 hover:border-white/20 transition-all hover:scale-[1.02] overflow-hidden"
    >
      {/* Status Bar */}
      <div className={cn(
        "px-3 py-1.5 text-xs font-medium flex items-center justify-between",
        isLive ? "bg-red-500/20 text-red-400" :
        isFinal ? "bg-green-500/20 text-green-400" :
        "bg-blue-500/20 text-blue-400"
      )}>
        <div className="flex items-center gap-2">
          {isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          <span>
            {game.status === 'live' ? `Q${game.period} ${game.clock}` :
             game.status === 'halftime' ? 'HALFTIME' :
             game.status === 'final' ? 'FINAL' :
             game.clock || 'Scheduled'}
          </span>
        </div>
        {game.broadcast && <span className="text-white/50">{game.broadcast}</span>}
      </div>

      {/* Teams */}
      <div className="p-3 space-y-2">
        {/* Away Team */}
        <div className={cn(
          "flex items-center justify-between p-2 rounded-lg transition-colors",
          awayWinning && (isLive || isFinal) ? "bg-green-500/10" : "bg-white/5"
        )}>
          <div className="flex items-center gap-3">
            <Image
              src={game.awayTeam.logo}
              alt={game.awayTeam.abbreviation}
              width={32}
              height={32}
              className="object-contain"
              unoptimized
            />
            <div>
              <p className="font-semibold text-white text-sm">{game.awayTeam.abbreviation}</p>
              {game.awayTeam.record && (
                <p className="text-xs text-white/40">{game.awayTeam.record}</p>
              )}
            </div>
          </div>
          <span className={cn(
            "text-xl font-bold tabular-nums",
            awayWinning && (isLive || isFinal) ? "text-green-400" : "text-white"
          )}>
            {game.awayTeam.score}
          </span>
        </div>

        {/* Home Team */}
        <div className={cn(
          "flex items-center justify-between p-2 rounded-lg transition-colors",
          homeWinning && (isLive || isFinal) ? "bg-green-500/10" : "bg-white/5"
        )}>
          <div className="flex items-center gap-3">
            <Image
              src={game.homeTeam.logo}
              alt={game.homeTeam.abbreviation}
              width={32}
              height={32}
              className="object-contain"
              unoptimized
            />
            <div>
              <p className="font-semibold text-white text-sm">{game.homeTeam.abbreviation}</p>
              {game.homeTeam.record && (
                <p className="text-xs text-white/40">{game.homeTeam.record}</p>
              )}
            </div>
          </div>
          <span className={cn(
            "text-xl font-bold tabular-nums",
            homeWinning && (isLive || isFinal) ? "text-green-400" : "text-white"
          )}>
            {game.homeTeam.score}
          </span>
        </div>
      </div>

      {/* Footer */}
      {game.venue && (
        <div className="px-3 pb-2 flex items-center gap-1 text-xs text-white/40">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{game.venue}</span>
        </div>
      )}
    </Link>
  );
}

// ============================================
// GAMES GRID COMPONENT
// ============================================

export function GamesGrid({ games, title, dateDisplay }: { games: VisualGameData[]; title?: string; dateDisplay?: string }) {
  if (games.length === 0) return null;

  // Generate title based on date
  let displayTitle = title || "Today's Games";
  if (dateDisplay) {
    if (dateDisplay === 'Today') {
      displayTitle = "Today's Games";
    } else if (dateDisplay === 'Tomorrow') {
      displayTitle = "Tomorrow's Games";
    } else if (dateDisplay === 'Yesterday') {
      displayTitle = "Yesterday's Games";
    } else {
      // Parse date and format nicely
      try {
        const date = new Date(dateDisplay);
        if (!isNaN(date.getTime())) {
          const options: Intl.DateTimeFormatOptions = { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          };
          const formattedDate = date.toLocaleDateString('en-US', options);
          displayTitle = `${formattedDate}'s Games`;
        } else {
          // Use the dateDisplay string as-is
          displayTitle = `${dateDisplay}'s Games`;
        }
      } catch {
        displayTitle = `${dateDisplay}'s Games`;
      }
    }
  }

  return (
    <div className="w-full my-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-white">{displayTitle}</h3>
        <span className="text-xs text-white/40">({games.length} {games.length === 1 ? 'game' : 'games'})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {games.map((game) => (
          <GameCard key={game.gameId} game={game} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// PLAYER CARD COMPONENT
// ============================================

// Helper component for stat boxes matching EnhancedPlayerStats style
function StatBox({ 
  label, 
  value, 
  subtext,
  highlight = false,
  negative = false 
}: { 
  label: string; 
  value: string; 
  subtext?: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center">
      <p className="text-[10px] text-white/40 uppercase">{label}</p>
      <p className={`text-sm font-semibold ${
        negative ? 'text-red-400' : highlight ? 'text-yellow-400' : 'text-white'
      }`}>
        {value}
      </p>
      {subtext && <p className="text-[10px] text-white/30">{subtext}</p>}
    </div>
  );
}

export function PlayerCard({ player }: { player: VisualPlayerData }) {
  const hasGameStats = !!player.gameStats;
  const useGameStats = hasGameStats;
  
  // Determine which stats to show
  const pts = useGameStats ? (player.gameStats?.points || 0) : (player.stats.ppg || 0);
  const reb = useGameStats ? (player.gameStats?.rebounds || 0) : (player.stats.rpg || 0);
  const ast = useGameStats ? (player.gameStats?.assists || 0) : (player.stats.apg || 0);
  
  // Calculate shooting percentages with validation
  // ESPN returns percentages as whole numbers (51.26 = 51.26%), NOT decimals
  // So we only multiply by 100 if the value is < 1 (meaning it's a decimal)
  const formatPercentage = (val: number | undefined, gameFgm?: number, gameFga?: number): string => {
    if (gameFga && gameFga > 0 && gameFgm !== undefined) {
      // Calculate from game stats
      const pct = (gameFgm / gameFga) * 100;
      return Math.max(0, Math.min(100, pct)).toFixed(1); // Clamp between 0-100
    }
    if (val === undefined || val === null) return '0.0';
    // ESPN returns as percentage already (51.26), so only multiply if < 1
    const pct = val > 1 ? val : val * 100;
    return Math.max(0, Math.min(100, pct)).toFixed(1); // Clamp between 0-100
  };
  
  const fgPct = formatPercentage(
    player.stats.fgPct,
    player.gameStats?.fgm,
    player.gameStats?.fga
  );
  
  const fg3Pct = formatPercentage(
    player.stats.fg3Pct,
    player.gameStats?.fg3m,
    player.gameStats?.fg3a
  );
  
  const ftPct = formatPercentage(player.stats.ftPct);

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 overflow-hidden max-w-md mx-auto">
      {/* Team Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {player.teamLogo && (
          <Image
            src={player.teamLogo}
            alt={player.team}
            width={32}
            height={32}
            className="object-contain"
            unoptimized
          />
        )}
        <span className="font-semibold text-white">{player.team}</span>
      </div>

      {/* Player Header Card */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Player Photo */}
          <div className="relative">
            {player.headshot ? (
              <Image
                src={player.headshot}
                alt={player.name}
                width={72}
                height={72}
                className="rounded-xl object-cover bg-white/10"
                unoptimized
              />
            ) : (
              <div className="w-[72px] h-[72px] rounded-xl flex items-center justify-center text-xl font-bold text-white bg-white/10">
                {player.number ? `#${player.number}` : '?'}
              </div>
            )}
          </div>
          
          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white truncate">{player.name}</h4>
              {player.number && <span className="text-xs text-white/40">#{player.number}</span>}
            </div>
            <p className="text-sm text-white/50">{player.position}</p>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-3 mt-2">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{useGameStats ? pts : pts.toFixed(1)}</p>
                <p className="text-[10px] text-white/40 uppercase">{useGameStats ? 'PTS' : 'PPG'}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white/80">{useGameStats ? reb : reb.toFixed(1)}</p>
                <p className="text-[10px] text-white/40 uppercase">{useGameStats ? 'REB' : 'RPG'}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white/80">{useGameStats ? ast : ast.toFixed(1)}</p>
                <p className="text-[10px] text-white/40 uppercase">{useGameStats ? 'AST' : 'APG'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-3">
        {useGameStats && player.gameStats ? (
          <>
            <StatBox label="MIN" value={player.gameStats.minutes || '0'} />
            <StatBox label="PTS" value={player.gameStats.points?.toString() || '0'} highlight />
            <StatBox label="REB" value={player.gameStats.rebounds?.toString() || '0'} />
            <StatBox label="AST" value={player.gameStats.assists?.toString() || '0'} />
            <StatBox label="STL" value={player.gameStats.steals?.toString() || '0'} />
            <StatBox label="BLK" value={player.gameStats.blocks?.toString() || '0'} />
            <StatBox 
              label="FG" 
              value={`${player.gameStats.fgm || 0}-${player.gameStats.fga || 0}`} 
              subtext={fgPct + '%'}
            />
            <StatBox 
              label="3PT" 
              value={`${player.gameStats.fg3m || 0}-${player.gameStats.fg3a || 0}`} 
              subtext={fg3Pct + '%'}
            />
            <StatBox label="FG%" value={fgPct + '%'} />
            <StatBox label="3P%" value={fg3Pct + '%'} />
            <StatBox label="FT%" value={ftPct + '%'} />
          </>
        ) : (
          <>
            <StatBox label="PPG" value={player.stats.ppg?.toFixed(1) || '0.0'} highlight />
            <StatBox label="RPG" value={player.stats.rpg?.toFixed(1) || '0.0'} />
            <StatBox label="APG" value={player.stats.apg?.toFixed(1) || '0.0'} />
            <StatBox label="SPG" value={player.stats.spg?.toFixed(1) || '0.0'} />
            <StatBox label="BPG" value={player.stats.bpg?.toFixed(1) || '0.0'} />
            <StatBox label="MPG" value={player.stats.mpg?.toFixed(1) || '0.0'} />
            <StatBox label="FG%" value={fgPct + '%'} />
            <StatBox label="3P%" value={fg3Pct + '%'} />
            <StatBox label="FT%" value={ftPct + '%'} />
            {player.stats.gamesPlayed && (
              <StatBox label="GP" value={player.stats.gamesPlayed.toString()} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// PLAYERS GRID COMPONENT
// ============================================

export function PlayersGrid({ players, title }: { players: VisualPlayerData[]; title?: string }) {
  if (players.length === 0) return null;

  return (
    <div className="w-full my-4">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// STATS TABLE COMPONENT
// ============================================

export function StatsTable({ table }: { table: VisualStatsTable }) {
  return (
    <div className="w-full my-4 bg-slate-900/80 rounded-xl border border-white/10 overflow-hidden">
      {/* Title */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500/20 to-blue-500/20 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">{table.title}</h3>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5">
              <th className="px-4 py-2 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Stat
              </th>
              {table.headers.map((header, i) => (
                <th 
                  key={i}
                  className="px-4 py-2 text-center text-xs font-medium text-white/60 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {table.rows.map((row, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-white/80 font-medium">
                  {row.label}
                </td>
                {row.values.map((value, j) => {
                  const isHighlight = row.highlight === 'home' && j === 1 || row.highlight === 'away' && j === 0;
                  return (
                    <td 
                      key={j}
                      className={cn(
                        "px-4 py-3 text-center tabular-nums",
                        isHighlight ? "text-green-400 font-bold" : "text-white"
                      )}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// STANDINGS TABLE COMPONENT
// ============================================

export function StandingsTable({ standings }: { standings: VisualStandingsData }) {
  return (
    <div className="w-full my-4 bg-slate-900/80 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className={cn(
        "px-4 py-3 border-b border-white/10",
        standings.conference === 'East' 
          ? "bg-gradient-to-r from-blue-500/20 to-blue-600/20" 
          : "bg-gradient-to-r from-red-500/20 to-red-600/20"
      )}>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-semibold text-white">{standings.conference}ern Conference</h3>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-xs text-white/60">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-center">W</th>
              <th className="px-3 py-2 text-center">L</th>
              <th className="px-3 py-2 text-center">PCT</th>
              <th className="px-3 py-2 text-center">GB</th>
              <th className="px-3 py-2 text-center">STRK</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {standings.teams.map((team) => (
              <tr 
                key={team.abbreviation}
                className={cn(
                  "hover:bg-white/5 transition-colors",
                  team.isPlayoff && "bg-green-500/5",
                  team.isPlayIn && "bg-yellow-500/5"
                )}
              >
                <td className="px-3 py-2">
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                    team.rank <= 6 ? "bg-green-500/20 text-green-400" :
                    team.rank <= 10 ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-white/10 text-white/60"
                  )}>
                    {team.rank}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Image
                      src={team.logo}
                      alt={team.abbreviation}
                      width={24}
                      height={24}
                      className="object-contain"
                      unoptimized
                    />
                    <span className="text-white font-medium">{team.abbreviation}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center text-white tabular-nums">{team.wins}</td>
                <td className="px-3 py-2 text-center text-white/60 tabular-nums">{team.losses}</td>
                <td className="px-3 py-2 text-center text-white tabular-nums">{team.winPct}</td>
                <td className="px-3 py-2 text-center text-white/60 tabular-nums">{team.gamesBehind}</td>
                <td className="px-3 py-2 text-center">
                  {team.streak && (
                    <span className={cn(
                      "text-xs font-medium",
                      team.streak.startsWith('W') ? "text-green-400" : "text-red-400"
                    )}>
                      {team.streak}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-white/10 flex items-center gap-4 text-xs text-white/40">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500/40" />
          <span>Playoff</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500/40" />
          <span>Play-In</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LEADERS TABLE COMPONENT
// ============================================

export function LeadersTable({ leaders }: { leaders: VisualLeadersData }) {
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('point') || cat.includes('scoring')) return <Flame className="w-4 h-4 text-orange-400" />;
    if (cat.includes('rebound')) return <Shield className="w-4 h-4 text-blue-400" />;
    if (cat.includes('assist')) return <Target className="w-4 h-4 text-green-400" />;
    if (cat.includes('steal')) return <Zap className="w-4 h-4 text-yellow-400" />;
    if (cat.includes('block')) return <Shield className="w-4 h-4 text-purple-400" />;
    return <Star className="w-4 h-4 text-white/60" />;
  };

  return (
    <div className="w-full my-4 bg-slate-900/80 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border-b border-white/10">
        <div className="flex items-center gap-2">
          {getCategoryIcon(leaders.category)}
          <h3 className="text-sm font-semibold text-white">{leaders.category} Leaders</h3>
        </div>
      </div>

      {/* Players List */}
      <div className="divide-y divide-white/5">
        {leaders.players.map((player, index) => (
          <div 
            key={player.name}
            className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
          >
            {/* Rank */}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
              index === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-slate-900" :
              index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900" :
              index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-slate-900" :
              "bg-white/10 text-white/60"
            )}>
              {player.rank}
            </div>

            {/* Player Photo */}
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-800">
              <Image
                src={player.headshot}
                alt={player.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>

            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{player.name}</p>
              <div className="flex items-center gap-2">
                <Image
                  src={player.teamLogo}
                  alt={player.team}
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
                <span className="text-xs text-white/50">{player.team}</span>
              </div>
            </div>

            {/* Value */}
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white tabular-nums">{player.value}</span>
              {player.trend && (
                player.trend === 'up' ? <TrendingUp className="w-4 h-4 text-green-400" /> :
                player.trend === 'down' ? <TrendingDown className="w-4 h-4 text-red-400" /> :
                <Minus className="w-4 h-4 text-white/40" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ENHANCED COMPARISON CARD
// ============================================

export function ComparisonCard({ comparison }: { comparison: PlayerComparisonVisual }) {
  const { player1, player2, verdict } = comparison;

  // Helper to render a player card matching EnhancedPlayerStats style EXACTLY
  const renderPlayerCard = (player: VisualPlayerData) => {
    // Ensure stats exist and have values
    const ppg = player.stats?.ppg ?? 0;
    const rpg = player.stats?.rpg ?? 0;
    const apg = player.stats?.apg ?? 0;
    const spg = player.stats?.spg ?? 0;
    const bpg = player.stats?.bpg ?? 0;
    const mpg = player.stats?.mpg ?? 0;
    const gamesPlayed = player.stats?.gamesPlayed ?? 0;
    // ESPN returns percentages as whole numbers (51.26 = 51.26%), NOT decimals
    // Only multiply by 100 if value is < 1 (meaning it's a decimal)
    const formatPct = (val: number | undefined): number => {
      if (val === undefined || val === null) return 0;
      return val > 1 ? val : val * 100; // Already a percentage if > 1
    };
    
    const fgPct = formatPct(player.stats?.fgPct);
    const fg3Pct = formatPct(player.stats?.fg3Pct);
    const ftPct = formatPct(player.stats?.ftPct);

    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(0,0,0,0.3) 100%)`,
        }}
      >
        {/* Player Header - EXACT match to EnhancedPlayerStats */}
        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Player Photo */}
            <div className="relative">
              {player.headshot ? (
                <Image
                  src={player.headshot}
                  alt={player.name}
                  width={72}
                  height={72}
                  className="rounded-xl object-cover bg-white/10"
                  unoptimized
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-xl flex items-center justify-center text-xl font-bold text-white bg-white/10">
                  {player.number ? `#${player.number}` : '?'}
                </div>
              )}
            </div>
            
            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white truncate">{player.name}</h4>
                {player.number && <span className="text-xs text-white/40">#{player.number}</span>}
              </div>
              <p className="text-sm text-white/50">{player.position}</p>
              
              {/* Quick Stats - EXACT match to EnhancedPlayerStats */}
              <div className="flex items-center gap-3 mt-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{ppg.toFixed(1)}</p>
                  <p className="text-[10px] text-white/40 uppercase">PPG</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white/80">{rpg.toFixed(1)}</p>
                  <p className="text-[10px] text-white/40 uppercase">RPG</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white/80">{apg.toFixed(1)}</p>
                  <p className="text-[10px] text-white/40 uppercase">APG</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Details - EXACT match to EnhancedPlayerStats season stats view */}
        <div className="px-4 pb-4 border-t border-white/10">
          <div className="mt-4 grid grid-cols-3 gap-3">
            {gamesPlayed > 0 && (
              <StatBox label="Games" value={gamesPlayed.toString()} />
            )}
            <StatBox label="MPG" value={mpg.toFixed(1)} />
            <StatBox label="PPG" value={ppg.toFixed(1)} highlight />
            <StatBox label="RPG" value={rpg.toFixed(1)} />
            <StatBox label="APG" value={apg.toFixed(1)} />
            <StatBox label="SPG" value={spg.toFixed(1)} />
            <StatBox label="BPG" value={bpg.toFixed(1)} />
            <StatBox label="FG%" value={`${fgPct.toFixed(1)}%`} />
            <StatBox label="3P%" value={`${fg3Pct.toFixed(1)}%`} />
            <StatBox label="FT%" value={`${ftPct.toFixed(1)}%`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto my-4 animate-fade-in">
      {/* Team Headers - matching EnhancedPlayerStats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          {player1.teamLogo && (
            <Image
              src={player1.teamLogo}
              alt={player1.team}
              width={32}
              height={32}
              className="object-contain"
              unoptimized
            />
          )}
          <span className="font-semibold text-white">{player1.team}</span>
        </div>
        <div className="flex items-center gap-2">
          {player2.teamLogo && (
            <Image
              src={player2.teamLogo}
              alt={player2.team}
              width={32}
              height={32}
              className="object-contain"
              unoptimized
            />
          )}
          <span className="font-semibold text-white">{player2.team}</span>
        </div>
      </div>

      {/* Two Player Cards Side by Side - EXACT match to EnhancedPlayerStats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPlayerCard(player1)}
        {renderPlayerCard(player2)}
      </div>

      {/* AI Verdict */}
      {verdict && (
        <div className="mt-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 border border-white/10">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-blue-500/20">
              <Star className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">AI Verdict</p>
              <p className="text-white/90 text-sm leading-relaxed">{verdict}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN VISUAL RENDERER
// ============================================

export function AIVisualRenderer({ visual }: { visual: AIVisualResponse }) {
  switch (visual.type) {
    case 'games':
      return <GamesGrid games={visual.data} dateDisplay={visual.dateDisplay} />;
    case 'game':
      return <GameCard game={visual.data} />;
    case 'player':
      return <PlayerCard player={visual.data} />;
    case 'players':
      return <PlayersGrid players={visual.data} />;
    case 'standings':
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visual.data.map((s) => (
            <StandingsTable key={s.conference} standings={s} />
          ))}
        </div>
      );
    case 'statsTable':
      return <StatsTable table={visual.data} />;
    case 'leaders':
      return <LeadersTable leaders={visual.data} />;
    case 'comparison':
      return <ComparisonCard comparison={visual.data} />;
    default:
      return null;
  }
}

