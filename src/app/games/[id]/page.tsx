// Game detail page

import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayByPlay } from '@/components/games/PlayByPlay';
import { BoxScore } from '@/components/games/BoxScore';
import { GameChat } from '@/components/ai/GameChat';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGameStatus, formatDateTime } from '@/lib/utils';
import type { GameDetail, PlayInfo, PlayerGameStatsInfo } from '@/types/nba';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getGameDetail(id: string): Promise<GameDetail | null> {
  try {
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        homeTeam: true,
        awayTeam: true,
        plays: {
          orderBy: { eventNum: 'desc' },
          take: 100,
        },
        playerStats: {
          include: {
            player: {
              include: { team: true },
            },
          },
          orderBy: { points: 'desc' },
        },
      },
    });

    if (!game) return null;

    const mapPlay = (play: typeof game.plays[0]): PlayInfo => ({
      id: play.id,
      period: play.period,
      gameClock: play.gameClock,
      playType: play.playType as PlayInfo['playType'],
      description: play.description,
      homeScore: play.homeScore,
      awayScore: play.awayScore,
      scoreChange: play.scoreChange,
      isBigPlay: play.isBigPlay,
      isClutch: play.isClutch,
    });

    const mapStats = (stat: typeof game.playerStats[0]): PlayerGameStatsInfo => ({
      player: {
        id: stat.player.id,
        firstName: stat.player.firstName,
        lastName: stat.player.lastName,
        fullName: stat.player.fullName,
        position: stat.player.position,
        jerseyNumber: stat.player.jerseyNumber,
        team: stat.player.team ? {
          id: stat.player.team.id,
          name: stat.player.team.name,
          fullName: stat.player.team.fullName,
          abbreviation: stat.player.team.abbreviation,
          city: stat.player.team.city,
          conference: stat.player.team.conference,
          division: stat.player.team.division,
          logoUrl: stat.player.team.logoUrl,
          primaryColor: stat.player.team.primaryColor,
          secondaryColor: stat.player.team.secondaryColor,
        } : null,
        headshotUrl: stat.player.headshotUrl,
      },
      minutes: stat.minutes,
      points: stat.points,
      rebounds: stat.reb,
      assists: stat.ast,
      steals: stat.stl,
      blocks: stat.blk,
      turnovers: stat.tov,
      fgm: stat.fgm,
      fga: stat.fga,
      fg3m: stat.fg3m,
      fg3a: stat.fg3a,
      ftm: stat.ftm,
      fta: stat.fta,
      plusMinus: stat.plusMinus,
    });

    return {
      id: game.id,
      homeTeam: {
        id: game.homeTeam.id,
        name: game.homeTeam.name,
        fullName: game.homeTeam.fullName,
        abbreviation: game.homeTeam.abbreviation,
        city: game.homeTeam.city,
        conference: game.homeTeam.conference,
        division: game.homeTeam.division,
        logoUrl: game.homeTeam.logoUrl,
        primaryColor: game.homeTeam.primaryColor,
        secondaryColor: game.homeTeam.secondaryColor,
      },
      awayTeam: {
        id: game.awayTeam.id,
        name: game.awayTeam.name,
        fullName: game.awayTeam.fullName,
        abbreviation: game.awayTeam.abbreviation,
        city: game.awayTeam.city,
        conference: game.awayTeam.conference,
        division: game.awayTeam.division,
        logoUrl: game.awayTeam.logoUrl,
        primaryColor: game.awayTeam.primaryColor,
        secondaryColor: game.awayTeam.secondaryColor,
      },
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      status: game.status as GameDetail['status'],
      period: game.period,
      gameClock: game.gameClock,
      scheduledAt: game.scheduledAt,
      venue: game.venue,
      nationalTv: game.nationalTv,
      plays: game.plays.map(mapPlay),
      homePlayerStats: game.playerStats
        .filter((s) => s.teamId === game.homeTeamId)
        .map(mapStats),
      awayPlayerStats: game.playerStats
        .filter((s) => s.teamId === game.awayTeamId)
        .map(mapStats),
    };
  } catch (error) {
    console.error('Failed to fetch game:', error);
    return null;
  }
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params;
  const game = await getGameDetail(id);

  if (!game) {
    notFound();
  }

  const isLive = game.status === 'LIVE';
  const isFinal = game.status === 'FINAL';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Game Header */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* Background gradient based on team colors */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(135deg, ${game.awayTeam.primaryColor || '#333'} 0%, transparent 50%, ${game.homeTeam.primaryColor || '#333'} 100%)`,
          }}
        />
        
        <div className="relative p-8">
          {/* Status */}
          <div className="flex justify-center mb-6">
            <Badge 
              variant={isLive ? 'live' : isFinal ? 'final' : 'scheduled'} 
              className="text-sm px-4 py-1"
            >
              {isLive && <span className="mr-2 h-2 w-2 rounded-full bg-white animate-ping inline-block" />}
              {formatGameStatus(game.status, game.period, game.gameClock, game.scheduledAt)}
            </Badge>
          </div>

          {/* Teams and Score */}
          <div className="flex items-center justify-center gap-8 md:gap-16">
            {/* Away Team */}
            <div className="text-center space-y-3">
              <div 
                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center mx-auto"
                style={{ backgroundColor: game.awayTeam.primaryColor || '#333' }}
              >
                {game.awayTeam.logoUrl ? (
                  <Image
                    src={game.awayTeam.logoUrl}
                    alt={game.awayTeam.name}
                    width={80}
                    height={80}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {game.awayTeam.abbreviation}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-white/60">{game.awayTeam.city}</p>
                <p className="text-lg font-semibold text-white">{game.awayTeam.name}</p>
              </div>
            </div>

            {/* Score */}
            <div className="text-center">
              <div className="flex items-center gap-4 md:gap-8">
                <span className="text-5xl md:text-7xl font-bold tabular-nums text-white">
                  {game.awayScore}
                </span>
                <span className="text-2xl text-white/40">-</span>
                <span className="text-5xl md:text-7xl font-bold tabular-nums text-white">
                  {game.homeScore}
                </span>
              </div>
              {game.venue && (
                <p className="text-sm text-white/50 mt-4">{game.venue}</p>
              )}
              <p className="text-xs text-white/40 mt-1">
                {formatDateTime(game.scheduledAt)}
              </p>
            </div>

            {/* Home Team */}
            <div className="text-center space-y-3">
              <div 
                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center mx-auto"
                style={{ backgroundColor: game.homeTeam.primaryColor || '#333' }}
              >
                {game.homeTeam.logoUrl ? (
                  <Image
                    src={game.homeTeam.logoUrl}
                    alt={game.homeTeam.name}
                    width={80}
                    height={80}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {game.homeTeam.abbreviation}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-white/60">{game.homeTeam.city}</p>
                <p className="text-lg font-semibold text-white">{game.homeTeam.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Play by Play */}
        <div className="lg:col-span-2 space-y-6">
          {/* Box Score */}
          <Card>
            <CardHeader>
              <CardTitle>Box Score</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-64" />}>
                <BoxScore
                  homeStats={game.homePlayerStats}
                  awayStats={game.awayPlayerStats}
                  homeTeamName={game.homeTeam.fullName}
                  awayTeamName={game.awayTeam.fullName}
                />
              </Suspense>
            </CardContent>
          </Card>

          {/* Play by Play */}
          <Card>
            <CardHeader>
              <CardTitle>Play-by-Play</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              <Suspense fallback={<Skeleton className="h-64" />}>
                <PlayByPlay
                  plays={game.plays}
                  homeAbbrev={game.homeTeam.abbreviation}
                  awayAbbrev={game.awayTeam.abbreviation}
                />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        {/* Right column - AI Chat */}
        <div className="space-y-6">
          <GameChat
            gameId={game.id}
            gameContext={{
              homeTeam: game.homeTeam.fullName,
              awayTeam: game.awayTeam.fullName,
              isLive,
            }}
          />
        </div>
      </div>
    </div>
  );
}




