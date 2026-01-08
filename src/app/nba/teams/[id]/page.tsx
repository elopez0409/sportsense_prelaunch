// NBA Team Detail Page - Full team information with roster and stats

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Users, AlertTriangle, TrendingUp, Calendar, ExternalLink, Sparkles } from 'lucide-react';
import { NBAHeader } from '@/components/nba/NBAHeader';
import { fetchTeamDetail, type ESPNTeamDetail } from '@/services/nba/espn-api';
import { TeamAnalyticsButton } from '@/components/ai/TeamAnalyticsButton';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

interface PageProps {
  params: Promise<{ id: string }>;
}

function StatCard({ label, value, color = 'white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold text-${color}`}>{value}</p>
      <p className="text-xs text-white/50 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { id } = await params;
  const team = await fetchTeamDetail(id);

  if (!team) {
    notFound();
  }

  // Group players by position
  const guards = team.roster.filter(p => p.position === 'G' || p.position === 'PG' || p.position === 'SG');
  const forwards = team.roster.filter(p => p.position === 'F' || p.position === 'SF' || p.position === 'PF');
  const centers = team.roster.filter(p => p.position === 'C');

  return (
    <div className="min-h-screen">
      <NBAHeader />
      
      <main className="container mx-auto px-4 py-6">
        <Link 
          href="/nba/teams"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Teams
        </Link>

        {/* Team Header */}
        <div className="glass rounded-2xl p-8 mb-8 relative overflow-hidden">
          {/* Background gradient */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              background: `linear-gradient(135deg, #${team.color} 0%, transparent 60%)`,
            }}
          />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            {/* Logo */}
            <div 
              className="w-32 h-32 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `#${team.color}33` }}
            >
              <Image
                src={team.logo}
                alt={team.displayName}
                width={100}
                height={100}
                className="object-contain"
                unoptimized
              />
            </div>

            {/* Team Info */}
            <div className="text-center md:text-left flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                {team.displayName}
              </h1>
              <p className="text-white/60 text-lg">
                {team.standing.conference} Conference • {team.standing.division}
              </p>
              
              {/* Record */}
              <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                <div className="px-4 py-2 rounded-lg bg-white/10">
                  <span className="text-2xl font-bold text-green-400">{team.record.wins}</span>
                  <span className="text-white/50 ml-1">W</span>
                </div>
                <div className="px-4 py-2 rounded-lg bg-white/10">
                  <span className="text-2xl font-bold text-red-400">{team.record.losses}</span>
                  <span className="text-white/50 ml-1">L</span>
                </div>
                <div className="px-4 py-2 rounded-lg bg-white/10">
                  <span className="text-2xl font-bold text-white">{team.record.winPct}%</span>
                  <span className="text-white/50 ml-1">PCT</span>
                </div>
              </div>
            </div>

            {/* Conference Rank */}
            <div className="text-center">
              <p className="text-5xl font-bold text-white">#{team.standing.rank || '?'}</p>
              <p className="text-white/50 text-sm">{team.standing.conference}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Team Statistics
            </h2>
            <TeamAnalyticsButton
              teamId={team.id}
              teamName={team.displayName}
              teamAbbreviation={team.abbreviation}
              record={team.record}
              stats={team.stats}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatCard label="PPG" value={team.stats.ppg.toFixed(1)} color="green-400" />
            <StatCard label="OPP PPG" value={team.stats.oppg.toFixed(1)} color="red-400" />
            <StatCard label="RPG" value={team.stats.rpg.toFixed(1)} />
            <StatCard label="APG" value={team.stats.apg.toFixed(1)} />
            <StatCard label="FG%" value={`${team.stats.fgPct.toFixed(1)}%`} />
            <StatCard label="3P%" value={`${team.stats.fg3Pct.toFixed(1)}%`} />
            <StatCard label="FT%" value={`${team.stats.ftPct.toFixed(1)}%`} />
          </div>
        </div>

        {/* Injuries */}
        {team.injuries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Injury Report
            </h2>
            <div className="glass rounded-xl overflow-hidden">
              <div className="divide-y divide-white/5">
                {team.injuries.map((injury, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {injury.player.headshot ? (
                        <Image
                          src={injury.player.headshot}
                          alt={injury.player.name}
                          width={40}
                          height={40}
                          className="rounded-full"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-white/60">
                            {injury.player.jersey}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">{injury.player.displayName}</p>
                        <p className="text-sm text-white/50">{injury.player.position}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        injury.status === 'Out' ? 'bg-red-500/20 text-red-400' :
                        injury.status === 'Questionable' ? 'bg-yellow-500/20 text-yellow-400' :
                        injury.status === 'Probable' ? 'bg-green-500/20 text-green-400' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {injury.status}
                      </span>
                      <p className="text-xs text-white/40 mt-1 max-w-xs">{injury.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Roster */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-400" />
            Roster ({team.roster.length} players)
          </h2>
          
          <div className="space-y-6">
            {/* Guards */}
            {guards.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">Guards</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {guards.map(player => (
                    <PlayerCard key={player.id} player={player} teamColor={team.color} />
                  ))}
                </div>
              </div>
            )}

            {/* Forwards */}
            {forwards.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">Forwards</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {forwards.map(player => (
                    <PlayerCard key={player.id} player={player} teamColor={team.color} />
                  ))}
                </div>
              </div>
            )}

            {/* Centers */}
            {centers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">Centers</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {centers.map(player => (
                    <PlayerCard key={player.id} player={player} teamColor={team.color} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Source Footer */}
        <div className="mt-8 text-center">
          <a 
            href={`https://www.espn.com/nba/team/_/name/${team.abbreviation.toLowerCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-sm transition-colors"
          >
            📊 View on ESPN <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </main>
    </div>
  );
}

function PlayerCard({ player, teamColor }: { player: ESPNTeamDetail['roster'][0]; teamColor: string }) {
  return (
    <div className="glass rounded-xl p-4 hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3">
        {player.headshot ? (
          <Image
            src={player.headshot}
            alt={player.displayName}
            width={48}
            height={48}
            className="rounded-full object-cover bg-white/10"
            unoptimized
          />
        ) : (
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `#${teamColor}33` }}
          >
            <span className="text-lg font-bold text-white">{player.jersey}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{player.displayName}</p>
          <p className="text-sm text-white/50">
            #{player.jersey} • {player.position}
          </p>
        </div>
      </div>
    </div>
  );
}




