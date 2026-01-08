'use client';

// Box Score component - Shows player stats for a game

import { cn, formatPercentage, calcPercentage } from '@/lib/utils';
import type { PlayerGameStatsInfo } from '@/types/nba';

interface BoxScoreProps {
  homeStats: PlayerGameStatsInfo[];
  awayStats: PlayerGameStatsInfo[];
  homeTeamName: string;
  awayTeamName: string;
}

export function BoxScore({
  homeStats,
  awayStats,
  homeTeamName,
  awayTeamName,
}: BoxScoreProps) {
  return (
    <div className="space-y-8">
      <TeamBoxScore stats={awayStats} teamName={awayTeamName} />
      <TeamBoxScore stats={homeStats} teamName={homeTeamName} />
    </div>
  );
}

interface TeamBoxScoreProps {
  stats: PlayerGameStatsInfo[];
  teamName: string;
}

function TeamBoxScore({ stats, teamName }: TeamBoxScoreProps) {
  if (stats.length === 0) {
    return (
      <div className="text-center py-4 text-white/50">
        No stats available for {teamName}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-white">{teamName}</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/50 text-xs border-b border-white/10">
              <th className="text-left py-2 px-2 sticky left-0 bg-[#0a0a0a]">
                Player
              </th>
              <th className="text-center py-2 px-2">MIN</th>
              <th className="text-center py-2 px-2">PTS</th>
              <th className="text-center py-2 px-2">REB</th>
              <th className="text-center py-2 px-2">AST</th>
              <th className="text-center py-2 px-2">FG</th>
              <th className="text-center py-2 px-2">3P</th>
              <th className="text-center py-2 px-2">FT</th>
              <th className="text-center py-2 px-2">STL</th>
              <th className="text-center py-2 px-2">BLK</th>
              <th className="text-center py-2 px-2">TO</th>
              <th className="text-center py-2 px-2">+/-</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, index) => (
              <tr
                key={stat.player.id}
                className={cn(
                  'border-b border-white/5 hover:bg-white/5 transition-colors',
                  index === 0 && 'bg-orange-500/5' // Highlight top scorer
                )}
              >
                <td className="py-2 px-2 sticky left-0 bg-inherit">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs w-4">
                      {stat.player.jerseyNumber || '-'}
                    </span>
                    <span className="text-white font-medium truncate max-w-[120px]">
                      {stat.player.fullName}
                    </span>
                    <span className="text-white/40 text-xs">
                      {stat.player.position}
                    </span>
                  </div>
                </td>
                <td className="text-center py-2 px-2 text-white/70">
                  {stat.minutes || '-'}
                </td>
                <td className="text-center py-2 px-2 text-white font-semibold">
                  {stat.points}
                </td>
                <td className="text-center py-2 px-2 text-white/90">
                  {stat.rebounds}
                </td>
                <td className="text-center py-2 px-2 text-white/90">
                  {stat.assists}
                </td>
                <td className="text-center py-2 px-2 text-white/70">
                  <span>{stat.fgm}-{stat.fga}</span>
                  {stat.fga > 0 && (
                    <span className="text-white/40 text-xs ml-1">
                      ({formatPercentage(calcPercentage(stat.fgm, stat.fga), 0)})
                    </span>
                  )}
                </td>
                <td className="text-center py-2 px-2 text-white/70">
                  {stat.fg3m}-{stat.fg3a}
                </td>
                <td className="text-center py-2 px-2 text-white/70">
                  {stat.ftm}-{stat.fta}
                </td>
                <td className="text-center py-2 px-2 text-white/70">
                  {stat.steals}
                </td>
                <td className="text-center py-2 px-2 text-white/70">
                  {stat.blocks}
                </td>
                <td className="text-center py-2 px-2 text-white/70">
                  {stat.turnovers}
                </td>
                <td
                  className={cn(
                    'text-center py-2 px-2 font-medium',
                    stat.plusMinus > 0
                      ? 'text-green-400'
                      : stat.plusMinus < 0
                      ? 'text-red-400'
                      : 'text-white/50'
                  )}
                >
                  {stat.plusMinus > 0 ? `+${stat.plusMinus}` : `${stat.plusMinus}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


