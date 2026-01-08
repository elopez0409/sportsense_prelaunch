'use client';

// Enhanced Player Stats Component
// Features: Player pictures, toggle between game/season stats, comparison overlay

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  ChevronDown, 
  ChevronUp, 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart2,
  Calendar,
  User,
  Zap
} from 'lucide-react';
import type { ESPNPlayerStats, ESPNPlayerSeasonStats } from '@/services/nba/espn-api';

interface EnhancedPlayerStatsProps {
  players: ESPNPlayerStats[];
  teamColor?: string;
  teamName: string;
  teamLogo: string;
}

type ViewMode = 'game' | 'season' | 'comparison';
type SortField = 'points' | 'rebounds' | 'assists' | 'minutes';

interface PlayerWithSeasonStats extends ESPNPlayerStats {
  seasonStats?: ESPNPlayerSeasonStats;
}

export function EnhancedPlayerStats({ 
  players, 
  teamColor = '3B82F6', 
  teamName,
  teamLogo 
}: EnhancedPlayerStatsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('game');
  const [seasonStats, setSeasonStats] = useState<Map<string, ESPNPlayerSeasonStats>>(new Map());
  const [isLoadingSeasonStats, setIsLoadingSeasonStats] = useState(false);
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Fetch season stats when needed
  useEffect(() => {
    if ((viewMode === 'season' || viewMode === 'comparison') && seasonStats.size === 0 && players.length > 0) {
      setIsLoadingSeasonStats(true);
      const playerIds = players.map(p => p.player.id);
      
      fetch('/api/players/season-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds }),
      })
        .then(res => res.json())
        .then(data => {
          const newMap = new Map<string, ESPNPlayerSeasonStats>();
          if (data.stats) {
            Object.entries(data.stats).forEach(([id, stats]) => {
              newMap.set(id, stats as ESPNPlayerSeasonStats);
            });
          }
          setSeasonStats(newMap);
        })
        .catch(console.error)
        .finally(() => setIsLoadingSeasonStats(false));
    }
  }, [viewMode, players, seasonStats.size]);

  // Sort players
  const sortedPlayers = [...players].sort((a, b) => {
    let aVal: number, bVal: number;
    
    switch (sortField) {
      case 'points':
        aVal = viewMode === 'season' ? (seasonStats.get(a.player.id)?.pointsPerGame || 0) : a.points;
        bVal = viewMode === 'season' ? (seasonStats.get(b.player.id)?.pointsPerGame || 0) : b.points;
        break;
      case 'rebounds':
        aVal = viewMode === 'season' ? (seasonStats.get(a.player.id)?.reboundsPerGame || 0) : a.rebounds;
        bVal = viewMode === 'season' ? (seasonStats.get(b.player.id)?.reboundsPerGame || 0) : b.rebounds;
        break;
      case 'assists':
        aVal = viewMode === 'season' ? (seasonStats.get(a.player.id)?.assistsPerGame || 0) : a.assists;
        bVal = viewMode === 'season' ? (seasonStats.get(b.player.id)?.assistsPerGame || 0) : b.assists;
        break;
      case 'minutes':
        aVal = viewMode === 'season' ? (seasonStats.get(a.player.id)?.minutesPerGame || 0) : parseInt(a.minutes) || 0;
        bVal = viewMode === 'season' ? (seasonStats.get(b.player.id)?.minutesPerGame || 0) : parseInt(b.minutes) || 0;
        break;
      default:
        aVal = a.points;
        bVal = b.points;
    }

    return sortDesc ? bVal - aVal : aVal - bVal;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  // Comparison helper - returns arrow icon based on performance vs average
  const ComparisonIndicator = ({ current, average }: { current: number; average: number }) => {
    if (average === 0) return <Minus className="w-3 h-3 text-white/30" />;
    const diff = current - average;
    const pctDiff = (diff / average) * 100;
    
    if (Math.abs(pctDiff) < 10) {
      return <Minus className="w-3 h-3 text-white/40" />;
    }
    
    if (diff > 0) {
      return (
        <div className="flex items-center gap-0.5 text-green-400">
          <TrendingUp className="w-3 h-3" />
          <span className="text-[10px]">+{diff.toFixed(1)}</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-0.5 text-red-400">
        <TrendingDown className="w-3 h-3" />
        <span className="text-[10px]">{diff.toFixed(1)}</span>
      </div>
    );
  };

  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 text-white/20 mx-auto mb-3" />
        <p className="text-white/40">No player stats available yet</p>
        <p className="text-sm text-white/30 mt-1">Stats will appear once the game is in progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Image 
            src={teamLogo} 
            alt={teamName} 
            width={32} 
            height={32} 
            className="object-contain"
            unoptimized
          />
          <span className="font-semibold text-white">{teamName}</span>
        </div>
        
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setViewMode('game')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              viewMode === 'game' 
                ? 'bg-white/15 text-white' 
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Zap className="w-4 h-4" />
            This Game
          </button>
          <button
            onClick={() => setViewMode('season')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              viewMode === 'season' 
                ? 'bg-white/15 text-white' 
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Season Avg
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              viewMode === 'comparison' 
                ? 'bg-white/15 text-white' 
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Compare
          </button>
        </div>
      </div>

      {/* Loading state for season stats */}
      {isLoadingSeasonStats && (viewMode === 'season' || viewMode === 'comparison') && (
        <div className="flex items-center justify-center py-4 gap-2 text-white/50">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <span className="text-sm">Loading season stats...</span>
        </div>
      )}

      {/* Player Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedPlayers.map((player) => {
          const playerSeasonStats = seasonStats.get(player.player.id);
          const isExpanded = expandedPlayer === player.player.id;
          
          return (
            <div
              key={player.player.id}
              className={`rounded-2xl overflow-hidden transition-all duration-300 ${
                isExpanded ? 'ring-2 ring-blue-500/50' : ''
              }`}
              style={{
                background: `linear-gradient(135deg, #${teamColor}15 0%, rgba(0,0,0,0.3) 100%)`,
              }}
            >
              {/* Player Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedPlayer(isExpanded ? null : player.player.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Player Photo */}
                  <div className="relative">
                    {player.player.headshot ? (
                      <Image
                        src={player.player.headshot}
                        alt={player.player.name}
                        width={72}
                        height={72}
                        className="rounded-xl object-cover bg-white/10"
                        unoptimized
                      />
                    ) : (
                      <div 
                        className="w-[72px] h-[72px] rounded-xl flex items-center justify-center text-xl font-bold text-white"
                        style={{ backgroundColor: `#${teamColor}` }}
                      >
                        #{player.player.jersey}
                      </div>
                    )}
                    {player.starter && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                        <Star className="w-3 h-3 text-black fill-black" />
                      </div>
                    )}
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white truncate">{player.player.shortName}</h4>
                      <span className="text-xs text-white/40">#{player.player.jersey}</span>
                    </div>
                    <p className="text-sm text-white/50">{player.player.position}</p>
                    
                    {/* Quick Stats */}
                    <div className="flex items-center gap-3 mt-2">
                      {viewMode === 'game' || viewMode === 'comparison' ? (
                        <>
                          <div className="text-center">
                            <p className="text-lg font-bold text-white">{player.points}</p>
                            <p className="text-[10px] text-white/40 uppercase">PTS</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-white/80">{player.rebounds}</p>
                            <p className="text-[10px] text-white/40 uppercase">REB</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-white/80">{player.assists}</p>
                            <p className="text-[10px] text-white/40 uppercase">AST</p>
                          </div>
                        </>
                      ) : playerSeasonStats ? (
                        <>
                          <div className="text-center">
                            <p className="text-lg font-bold text-white">{playerSeasonStats.pointsPerGame.toFixed(1)}</p>
                            <p className="text-[10px] text-white/40 uppercase">PPG</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-white/80">{playerSeasonStats.reboundsPerGame.toFixed(1)}</p>
                            <p className="text-[10px] text-white/40 uppercase">RPG</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-white/80">{playerSeasonStats.assistsPerGame.toFixed(1)}</p>
                            <p className="text-[10px] text-white/40 uppercase">APG</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-white/40">Loading...</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Expand Icon */}
                  <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5 text-white/40" />
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/10">
                  {viewMode === 'comparison' && playerSeasonStats ? (
                    /* Comparison View */
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-4 gap-2 text-center text-xs text-white/50 mb-2">
                        <div>Stat</div>
                        <div>Game</div>
                        <div>Avg</div>
                        <div>Diff</div>
                      </div>
                      
                      <ComparisonRow 
                        label="Points" 
                        current={player.points} 
                        average={playerSeasonStats.pointsPerGame} 
                      />
                      <ComparisonRow 
                        label="Rebounds" 
                        current={player.rebounds} 
                        average={playerSeasonStats.reboundsPerGame} 
                      />
                      <ComparisonRow 
                        label="Assists" 
                        current={player.assists} 
                        average={playerSeasonStats.assistsPerGame} 
                      />
                      <ComparisonRow 
                        label="Steals" 
                        current={player.steals} 
                        average={playerSeasonStats.stealsPerGame} 
                      />
                      <ComparisonRow 
                        label="Blocks" 
                        current={player.blocks} 
                        average={playerSeasonStats.blocksPerGame} 
                      />
                      <ComparisonRow 
                        label="Minutes" 
                        current={parseFloat(player.minutes) || 0} 
                        average={playerSeasonStats.minutesPerGame} 
                      />
                      
                      {/* Shooting */}
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-white/40 mb-2">Shooting</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-xs text-white/40">FG%</p>
                            <p className="text-sm font-semibold text-white">{player.fgPct}</p>
                            <p className="text-[10px] text-white/30">Avg: {playerSeasonStats.fgPct.toFixed(1)}%</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-xs text-white/40">3P%</p>
                            <p className="text-sm font-semibold text-white">{player.fg3Pct}</p>
                            <p className="text-[10px] text-white/30">Avg: {playerSeasonStats.fg3Pct.toFixed(1)}%</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-xs text-white/40">FT%</p>
                            <p className="text-sm font-semibold text-white">{player.ftPct}</p>
                            <p className="text-[10px] text-white/30">Avg: {playerSeasonStats.ftPct.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : viewMode === 'season' && playerSeasonStats ? (
                    /* Season Stats View */
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <StatBox label="Games" value={playerSeasonStats.gamesPlayed.toString()} />
                      <StatBox label="Starts" value={playerSeasonStats.gamesStarted.toString()} />
                      <StatBox label="MPG" value={playerSeasonStats.minutesPerGame.toFixed(1)} />
                      <StatBox label="PPG" value={playerSeasonStats.pointsPerGame.toFixed(1)} highlight />
                      <StatBox label="RPG" value={playerSeasonStats.reboundsPerGame.toFixed(1)} />
                      <StatBox label="APG" value={playerSeasonStats.assistsPerGame.toFixed(1)} />
                      <StatBox label="SPG" value={playerSeasonStats.stealsPerGame.toFixed(1)} />
                      <StatBox label="BPG" value={playerSeasonStats.blocksPerGame.toFixed(1)} />
                      <StatBox label="TO" value={playerSeasonStats.turnoversPerGame.toFixed(1)} />
                      <StatBox label="FG%" value={`${playerSeasonStats.fgPct.toFixed(1)}%`} />
                      <StatBox label="3P%" value={`${playerSeasonStats.fg3Pct.toFixed(1)}%`} />
                      <StatBox label="FT%" value={`${playerSeasonStats.ftPct.toFixed(1)}%`} />
                    </div>
                  ) : (
                    /* Game Stats View */
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <StatBox label="MIN" value={player.minutes} />
                      <StatBox label="PTS" value={player.points.toString()} highlight />
                      <StatBox label="REB" value={player.rebounds.toString()} />
                      <StatBox label="AST" value={player.assists.toString()} />
                      <StatBox label="STL" value={player.steals.toString()} />
                      <StatBox label="BLK" value={player.blocks.toString()} />
                      <StatBox label="TO" value={player.turnovers.toString()} />
                      <StatBox label="FG" value={`${player.fgm}-${player.fga}`} subtext={player.fgPct} />
                      <StatBox label="3PT" value={`${player.fg3m}-${player.fg3a}`} subtext={player.fg3Pct} />
                      <StatBox label="FT" value={`${player.ftm}-${player.fta}`} subtext={player.ftPct} />
                      <StatBox 
                        label="+/-" 
                        value={(parseInt(player.plusMinus) || 0) > 0 ? `+${parseInt(player.plusMinus) || 0}` : `${parseInt(player.plusMinus) || 0}`}
                        highlight={(parseInt(player.plusMinus) || 0) > 0}
                        negative={(parseInt(player.plusMinus) || 0) < 0}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sort Options */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <span className="text-xs text-white/40">Sort by:</span>
        {(['points', 'rebounds', 'assists', 'minutes'] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              sortField === field
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {field.charAt(0).toUpperCase() + field.slice(1)}
            {sortField === field && (
              sortDesc ? <ChevronDown className="w-3 h-3 inline ml-1" /> : <ChevronUp className="w-3 h-3 inline ml-1" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper Components
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

function ComparisonRow({ 
  label, 
  current, 
  average 
}: { 
  label: string; 
  current: number; 
  average: number;
}) {
  const diff = current - average;
  const pctDiff = average > 0 ? (diff / average) * 100 : 0;
  
  return (
    <div className="grid grid-cols-4 gap-2 items-center bg-white/5 rounded-lg p-2">
      <p className="text-xs text-white/60">{label}</p>
      <p className="text-sm font-semibold text-white text-center">{current}</p>
      <p className="text-xs text-white/50 text-center">{average.toFixed(1)}</p>
      <div className={`text-xs font-medium text-center ${
        Math.abs(pctDiff) < 10 
          ? 'text-white/40' 
          : diff > 0 
            ? 'text-green-400' 
            : 'text-red-400'
      }`}>
        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
      </div>
    </div>
  );
}


