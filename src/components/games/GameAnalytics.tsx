'use client';

// Game Analytics Component - Charts and visualizations for game data
// Uses Recharts for rendering

import { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import type { ESPNTeam, ESPNPlay } from '@/services/nba/espn-api';
import { Calendar, TrendingUp, BarChart3 } from 'lucide-react';

interface TeamTotals {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
}

interface GameAnalyticsProps {
  homeTeam: ESPNTeam;
  awayTeam: ESPNTeam;
  homeTotals: TeamTotals;
  awayTotals: TeamTotals;
  homeScore: number;
  awayScore: number;
  plays: ESPNPlay[];
  status?: string;
}

const COLORS = {
  home: '#3B82F6', // Blue
  away: '#F97316', // Orange
  neutral: '#6B7280',
};

export function GameAnalytics({
  homeTeam,
  awayTeam,
  homeTotals,
  awayTotals,
  homeScore,
  awayScore,
  plays,
  status = 'scheduled',
}: GameAnalyticsProps) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const isScheduled = status === 'scheduled';
  const hasData = homeScore > 0 || awayScore > 0 || homeTotals.points > 0 || awayTotals.points > 0;
  // Team comparison data for bar chart
  const comparisonData = useMemo(() => [
    {
      stat: 'Points',
      [homeTeam.abbreviation]: homeScore,
      [awayTeam.abbreviation]: awayScore,
    },
    {
      stat: 'Rebounds',
      [homeTeam.abbreviation]: homeTotals.rebounds,
      [awayTeam.abbreviation]: awayTotals.rebounds,
    },
    {
      stat: 'Assists',
      [homeTeam.abbreviation]: homeTotals.assists,
      [awayTeam.abbreviation]: awayTotals.assists,
    },
    {
      stat: 'Steals',
      [homeTeam.abbreviation]: homeTotals.steals,
      [awayTeam.abbreviation]: awayTotals.steals,
    },
    {
      stat: 'Blocks',
      [homeTeam.abbreviation]: homeTotals.blocks,
      [awayTeam.abbreviation]: awayTotals.blocks,
    },
  ], [homeTeam, awayTeam, homeTotals, awayTotals, homeScore, awayScore]);

  // Shooting percentages for radar chart
  const shootingData = useMemo(() => {
    const homeFGPct = homeTotals.fga > 0 ? (homeTotals.fgm / homeTotals.fga) * 100 : 0;
    const awayFGPct = awayTotals.fga > 0 ? (awayTotals.fgm / awayTotals.fga) * 100 : 0;
    const homeFG3Pct = homeTotals.fg3a > 0 ? (homeTotals.fg3m / homeTotals.fg3a) * 100 : 0;
    const awayFG3Pct = awayTotals.fg3a > 0 ? (awayTotals.fg3m / awayTotals.fg3a) * 100 : 0;
    const homeFTPct = homeTotals.fta > 0 ? (homeTotals.ftm / homeTotals.fta) * 100 : 0;
    const awayFTPct = awayTotals.fta > 0 ? (awayTotals.ftm / awayTotals.fta) * 100 : 0;

    return [
      { stat: 'FG%', home: homeFGPct, away: awayFGPct, fullMark: 100 },
      { stat: '3P%', home: homeFG3Pct, away: awayFG3Pct, fullMark: 100 },
      { stat: 'FT%', home: homeFTPct, away: awayFTPct, fullMark: 100 },
      { stat: 'REB', home: Math.min(homeTotals.rebounds, 60), away: Math.min(awayTotals.rebounds, 60), fullMark: 60 },
      { stat: 'AST', home: Math.min(homeTotals.assists, 40), away: Math.min(awayTotals.assists, 40), fullMark: 40 },
      { stat: 'STL+BLK', home: homeTotals.steals + homeTotals.blocks, away: awayTotals.steals + awayTotals.blocks, fullMark: 20 },
    ];
  }, [homeTotals, awayTotals]);

  // Scoring breakdown pie chart data
  const scoringBreakdown = useMemo(() => [
    { name: '2PT', home: (homeTotals.fgm - homeTotals.fg3m) * 2, away: (awayTotals.fgm - awayTotals.fg3m) * 2 },
    { name: '3PT', home: homeTotals.fg3m * 3, away: awayTotals.fg3m * 3 },
    { name: 'FT', home: homeTotals.ftm, away: awayTotals.ftm },
  ], [homeTotals, awayTotals]);

  // Score flow over time (from plays)
  const scoreFlow = useMemo(() => {
    if (plays.length === 0) return [];
    
    // Sort plays by sequence
    const sortedPlays = [...plays].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    
    // Sample every N plays to reduce data points
    const sampleRate = Math.max(1, Math.floor(sortedPlays.length / 50));
    
    return sortedPlays
      .filter((_, idx) => idx % sampleRate === 0)
      .map((play, idx) => ({
        play: idx + 1,
        [homeTeam.abbreviation]: play.homeScore,
        [awayTeam.abbreviation]: play.awayScore,
        period: `Q${play.period}`,
      }));
  }, [plays, homeTeam, awayTeam]);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    
    return (
      <div className="glass-dark rounded-lg p-3 border border-white/10">
        <p className="text-white font-medium mb-2">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  // If game hasn't started, show pre-game info
  if (isScheduled || !hasData) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-blue-400/50 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Game Not Started</h3>
          <p className="text-white/60 mb-6">Analytics will be available once the game begins.</p>
          
          {/* Pre-game team comparison based on season stats */}
          <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
            <div className="text-center">
              <p className="text-sm text-white/50 mb-2">{awayTeam.abbreviation}</p>
              <div className="glass rounded-xl p-4">
                <p className="text-3xl font-bold text-orange-400">{awayTeam.record || '0-0'}</p>
                <p className="text-xs text-white/40 mt-1">Season Record</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-white/50 mb-2">{homeTeam.abbreviation}</p>
              <div className="glass rounded-xl p-4">
                <p className="text-3xl font-bold text-blue-400">{homeTeam.record || '0-0'}</p>
                <p className="text-xs text-white/40 mt-1">Season Record</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Pre-game insights */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h4 className="font-semibold text-white">Pre-Game Preview</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold text-white">🏠</p>
              <p className="text-sm text-white/60 mt-2">{homeTeam.displayName}</p>
              <p className="text-xs text-white/40">Home Team</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold text-white">VS</p>
              <p className="text-sm text-white/60 mt-2">Tip-Off</p>
              <p className="text-xs text-white/40">Coming Soon</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold text-white">✈️</p>
              <p className="text-sm text-white/60 mt-2">{awayTeam.displayName}</p>
              <p className="text-xs text-white/40">Away Team</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render charts until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="space-y-8">
        <div className="h-64 bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
          <BarChart3 className="w-12 h-12 text-white/20" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Team Comparison Bar Chart */}
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
          Team Comparison
        </h3>
        <div style={{ width: '100%', height: 256 }}>
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={comparisonData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#6B7280" />
              <YAxis 
                dataKey="stat" 
                type="category" 
                stroke="#6B7280" 
                width={80}
                tick={{ fill: '#9CA3AF' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey={awayTeam.abbreviation} 
                fill={COLORS.away} 
                radius={[0, 4, 4, 0]}
                name={awayTeam.abbreviation}
              />
              <Bar 
                dataKey={homeTeam.abbreviation} 
                fill={COLORS.home} 
                radius={[0, 4, 4, 0]}
                name={homeTeam.abbreviation}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Shooting Efficiency Radar */}
        <div>
          <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
            Team Efficiency
          </h3>
          <div style={{ width: '100%', height: 288 }}>
            <ResponsiveContainer width="100%" height={288}>
              <RadarChart data={shootingData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#6B7280' }} />
                <Radar
                  name={awayTeam.abbreviation}
                  dataKey="away"
                  stroke={COLORS.away}
                  fill={COLORS.away}
                  fillOpacity={0.3}
                />
                <Radar
                  name={homeTeam.abbreviation}
                  dataKey="home"
                  stroke={COLORS.home}
                  fill={COLORS.home}
                  fillOpacity={0.3}
                />
                <Legend />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scoring Breakdown */}
        <div>
          <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
            Scoring Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Away Team Pie */}
            <div>
              <p className="text-xs text-center text-white/50 mb-2">{awayTeam.abbreviation}</p>
              <div style={{ width: '100%', height: 192 }}>
                <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie
                      data={scoringBreakdown.map(d => ({ name: d.name, value: d.away }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      <Cell fill="#F97316" />
                      <Cell fill="#FB923C" />
                      <Cell fill="#FDBA74" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Home Team Pie */}
            <div>
              <p className="text-xs text-center text-white/50 mb-2">{homeTeam.abbreviation}</p>
              <div style={{ width: '100%', height: 192 }}>
                <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie
                      data={scoringBreakdown.map(d => ({ name: d.name, value: d.home }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      <Cell fill="#3B82F6" />
                      <Cell fill="#60A5FA" />
                      <Cell fill="#93C5FD" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Score Flow Line Chart */}
      {scoreFlow.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white/60 mb-4 uppercase tracking-wider">
            Score Flow
          </h3>
          <div style={{ width: '100%', height: 256 }}>
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={scoreFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="play" 
                  stroke="#6B7280"
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={awayTeam.abbreviation}
                  stroke={COLORS.away}
                  strokeWidth={2}
                  dot={false}
                  name={awayTeam.abbreviation}
                />
                <Line
                  type="monotone"
                  dataKey={homeTeam.abbreviation}
                  stroke={COLORS.home}
                  strokeWidth={2}
                  dot={false}
                  name={homeTeam.abbreviation}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="FG%"
          awayValue={homeTotals.fga > 0 ? ((homeTotals.fgm / homeTotals.fga) * 100).toFixed(1) : '0.0'}
          homeValue={awayTotals.fga > 0 ? ((awayTotals.fgm / awayTotals.fga) * 100).toFixed(1) : '0.0'}
          awayLabel={awayTeam.abbreviation}
          homeLabel={homeTeam.abbreviation}
        />
        <StatCard
          label="3P%"
          awayValue={awayTotals.fg3a > 0 ? ((awayTotals.fg3m / awayTotals.fg3a) * 100).toFixed(1) : '0.0'}
          homeValue={homeTotals.fg3a > 0 ? ((homeTotals.fg3m / homeTotals.fg3a) * 100).toFixed(1) : '0.0'}
          awayLabel={awayTeam.abbreviation}
          homeLabel={homeTeam.abbreviation}
        />
        <StatCard
          label="FT%"
          awayValue={awayTotals.fta > 0 ? ((awayTotals.ftm / awayTotals.fta) * 100).toFixed(1) : '0.0'}
          homeValue={homeTotals.fta > 0 ? ((homeTotals.ftm / homeTotals.fta) * 100).toFixed(1) : '0.0'}
          awayLabel={awayTeam.abbreviation}
          homeLabel={homeTeam.abbreviation}
        />
        <StatCard
          label="Turnovers"
          awayValue={awayTotals.turnovers.toString()}
          homeValue={homeTotals.turnovers.toString()}
          awayLabel={awayTeam.abbreviation}
          homeLabel={homeTeam.abbreviation}
          lowerIsBetter
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  awayValue,
  homeValue,
  awayLabel,
  homeLabel,
  lowerIsBetter = false,
}: {
  label: string;
  awayValue: string;
  homeValue: string;
  awayLabel: string;
  homeLabel: string;
  lowerIsBetter?: boolean;
}) {
  const awayNum = parseFloat(awayValue);
  const homeNum = parseFloat(homeValue);
  const awayWins = lowerIsBetter ? awayNum < homeNum : awayNum > homeNum;
  const homeWins = lowerIsBetter ? homeNum < awayNum : homeNum > awayNum;

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs text-white/40 uppercase tracking-wider mb-3">{label}</p>
      <div className="flex justify-between items-center">
        <div className="text-center">
          <p className="text-xs text-white/50">{awayLabel}</p>
          <p className={`text-xl font-bold ${awayWins ? 'text-orange-400' : 'text-white/70'}`}>
            {awayValue}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/50">{homeLabel}</p>
          <p className={`text-xl font-bold ${homeWins ? 'text-blue-400' : 'text-white/70'}`}>
            {homeValue}
          </p>
        </div>
      </div>
    </div>
  );
}

