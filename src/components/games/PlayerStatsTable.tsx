'use client';

// Player Stats Table - Box score display for game players
// Shows all individual player statistics with injury indicators

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronUp, AlertTriangle, Star } from 'lucide-react';
import type { ESPNPlayerStats } from '@/services/nba/espn-api';

interface PlayerStatsTableProps {
  players: ESPNPlayerStats[];
  teamColor?: string;
}

type SortField = 'points' | 'rebounds' | 'assists' | 'minutes' | 'plusMinus' | 'fgPct';
type SortDirection = 'asc' | 'desc';

export function PlayerStatsTable({ players, teamColor = '333' }: PlayerStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sort players
  const sortedPlayers = [...players].sort((a, b) => {
    let aVal: number, bVal: number;
    
    switch (sortField) {
      case 'points':
        aVal = a.points;
        bVal = b.points;
        break;
      case 'rebounds':
        aVal = a.rebounds;
        bVal = b.rebounds;
        break;
      case 'assists':
        aVal = a.assists;
        bVal = b.assists;
        break;
      case 'minutes':
        aVal = parseInt(a.minutes) || 0;
        bVal = parseInt(b.minutes) || 0;
        break;
      case 'plusMinus':
        aVal = parseInt(a.plusMinus) || 0;
        bVal = parseInt(b.plusMinus) || 0;
        break;
      case 'fgPct':
        aVal = parseFloat(a.fgPct) || 0;
        bVal = parseFloat(b.fgPct) || 0;
        break;
      default:
        aVal = a.points;
        bVal = b.points;
    }

    return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // Separate starters and bench
  const starters = sortedPlayers.filter(p => p.starter);
  const bench = sortedPlayers.filter(p => !p.starter);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' 
      ? <ChevronDown className="w-3 h-3" />
      : <ChevronUp className="w-3 h-3" />;
  };

  const renderPlayerRow = (player: ESPNPlayerStats, isStarter: boolean) => {
    const plusMinusNum = parseInt(player.plusMinus) || 0;
    
    return (
      <tr 
        key={player.player.id}
        className="border-b border-white/5 hover:bg-white/5 transition-colors"
      >
        {/* Player Info */}
        <td className="p-3 sticky left-0 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {player.player.headshot ? (
              <Image
                src={player.player.headshot}
                alt={player.player.name}
                width={36}
                height={36}
                className="rounded-full object-cover bg-white/10"
                unoptimized
              />
            ) : (
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: `#${teamColor}` }}
              >
                {player.player.jersey}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">
                  {player.player.shortName}
                </span>
                {isStarter && (
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                )}
              </div>
              <span className="text-xs text-white/40">
                {player.player.position} • #{player.player.jersey}
              </span>
            </div>
          </div>
        </td>

        {/* Basic Stats */}
        <td className="p-3 text-center text-white/60 text-sm">{player.minutes}</td>
        <td className="p-3 text-center text-white font-semibold">{player.points}</td>
        <td className="p-3 text-center text-white/80 text-sm">{player.rebounds}</td>
        <td className="p-3 text-center text-white/80 text-sm">{player.assists}</td>
        <td className="p-3 text-center text-white/60 text-sm">{player.steals}</td>
        <td className="p-3 text-center text-white/60 text-sm">{player.blocks}</td>
        <td className="p-3 text-center text-white/60 text-sm">{player.turnovers}</td>

        {/* Shooting */}
        <td className="p-3 text-center text-white/70 text-sm">
          {player.fgm}-{player.fga}
          <span className="text-white/40 ml-1">
            ({player.fgPct})
          </span>
        </td>
        <td className="p-3 text-center text-white/70 text-sm">
          {player.fg3m}-{player.fg3a}
          <span className="text-white/40 ml-1">
            ({player.fg3Pct})
          </span>
        </td>
        <td className="p-3 text-center text-white/70 text-sm">
          {player.ftm}-{player.fta}
          <span className="text-white/40 ml-1">
            ({player.ftPct})
          </span>
        </td>

        {/* Plus/Minus */}
        <td className={`p-3 text-center font-medium text-sm ${
          plusMinusNum > 0 ? 'text-green-400' : 
          plusMinusNum < 0 ? 'text-red-400' : 'text-white/60'
        }`}>
          {plusMinusNum > 0 ? `+${plusMinusNum}` : `${plusMinusNum}`}
        </td>
      </tr>
    );
  };

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <p>No player stats available yet</p>
        <p className="text-sm mt-2">Stats will appear once the game is in progress</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="text-xs text-white/50 border-b border-white/10 uppercase tracking-wider">
            <th className="text-left p-3 sticky left-0 bg-black/50 backdrop-blur-sm">Player</th>
            <th 
              className="p-3 text-center cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => toggleSort('minutes')}
            >
              <div className="flex items-center justify-center gap-1">
                MIN <SortIcon field="minutes" />
              </div>
            </th>
            <th 
              className="p-3 text-center cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => toggleSort('points')}
            >
              <div className="flex items-center justify-center gap-1">
                PTS <SortIcon field="points" />
              </div>
            </th>
            <th 
              className="p-3 text-center cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => toggleSort('rebounds')}
            >
              <div className="flex items-center justify-center gap-1">
                REB <SortIcon field="rebounds" />
              </div>
            </th>
            <th 
              className="p-3 text-center cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => toggleSort('assists')}
            >
              <div className="flex items-center justify-center gap-1">
                AST <SortIcon field="assists" />
              </div>
            </th>
            <th className="p-3 text-center">STL</th>
            <th className="p-3 text-center">BLK</th>
            <th className="p-3 text-center">TO</th>
            <th 
              className="p-3 text-center cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => toggleSort('fgPct')}
            >
              <div className="flex items-center justify-center gap-1">
                FG <SortIcon field="fgPct" />
              </div>
            </th>
            <th className="p-3 text-center">3PT</th>
            <th className="p-3 text-center">FT</th>
            <th 
              className="p-3 text-center cursor-pointer hover:text-white/80 transition-colors"
              onClick={() => toggleSort('plusMinus')}
            >
              <div className="flex items-center justify-center gap-1">
                +/- <SortIcon field="plusMinus" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Starters Section */}
          {starters.length > 0 && (
            <>
              <tr>
                <td colSpan={12} className="p-2 bg-white/5">
                  <span className="text-xs text-white/40 uppercase tracking-wider flex items-center gap-2">
                    <Star className="w-3 h-3 text-yellow-400" /> Starters
                  </span>
                </td>
              </tr>
              {starters.map(p => renderPlayerRow(p, true))}
            </>
          )}

          {/* Bench Section */}
          {bench.length > 0 && (
            <>
              <tr>
                <td colSpan={12} className="p-2 bg-white/5">
                  <span className="text-xs text-white/40 uppercase tracking-wider">
                    Bench
                  </span>
                </td>
              </tr>
              {bench.map(p => renderPlayerRow(p, false))}
            </>
          )}

          {/* If no starters/bench distinction */}
          {starters.length === 0 && bench.length === 0 && (
            sortedPlayers.map(p => renderPlayerRow(p, false))
          )}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/40">
        <span>MIN = Minutes</span>
        <span>PTS = Points</span>
        <span>REB = Rebounds</span>
        <span>AST = Assists</span>
        <span>STL = Steals</span>
        <span>BLK = Blocks</span>
        <span>TO = Turnovers</span>
        <span>FG = Field Goals</span>
        <span>3PT = 3-Point</span>
        <span>FT = Free Throws</span>
        <span>+/- = Plus/Minus</span>
      </div>
    </div>
  );
}


