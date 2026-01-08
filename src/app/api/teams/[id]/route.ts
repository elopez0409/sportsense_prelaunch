// GET /api/teams/[id] - Get team details with roster and recent games

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { APIResponse, TeamInfo, PlayerInfo, GameInfo } from '@/types/nba';

export const dynamic = 'force-dynamic';

interface TeamDetailResponse {
  team: TeamInfo;
  roster: PlayerInfo[];
  recentGames: GameInfo[];
  upcomingGames: GameInfo[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  logger.api.request('GET', `/api/teams/${id}`, {});

  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        players: {
          where: { isActive: true },
          orderBy: { lastName: 'asc' },
        },
      },
    });

    if (!team) {
      return NextResponse.json<APIResponse<null>>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team not found',
        },
      }, { status: 404 });
    }

    // Get recent and upcoming games
    const now = new Date();
    const [recentGames, upcomingGames] = await Promise.all([
      prisma.game.findMany({
        where: {
          OR: [{ homeTeamId: id }, { awayTeamId: id }],
          scheduledAt: { lt: now },
        },
        include: {
          homeTeam: true,
          awayTeam: true,
        },
        orderBy: { scheduledAt: 'desc' },
        take: 5,
      }),
      prisma.game.findMany({
        where: {
          OR: [{ homeTeamId: id }, { awayTeamId: id }],
          scheduledAt: { gte: now },
        },
        include: {
          homeTeam: true,
          awayTeam: true,
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
    ]);

    const transformGame = (game: typeof recentGames[0]): GameInfo => ({
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
      status: game.status as GameInfo['status'],
      period: game.period,
      gameClock: game.gameClock,
      scheduledAt: game.scheduledAt,
      venue: game.venue,
      nationalTv: game.nationalTv,
    });

    const data: TeamDetailResponse = {
      team: {
        id: team.id,
        name: team.name,
        fullName: team.fullName,
        abbreviation: team.abbreviation,
        city: team.city,
        conference: team.conference,
        division: team.division,
        logoUrl: team.logoUrl,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      },
      roster: team.players.map((player) => ({
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        fullName: player.fullName,
        position: player.position,
        jerseyNumber: player.jerseyNumber,
        team: null,
        headshotUrl: player.headshotUrl,
      })),
      recentGames: recentGames.map(transformGame),
      upcomingGames: upcomingGames.map(transformGame),
    };

    return NextResponse.json<APIResponse<TeamDetailResponse>>({
      success: true,
      data,
    });
  } catch (error) {
    logger.api.error('GET', `/api/teams/${id}`, error as Error);
    
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch team details',
      },
    }, { status: 500 });
  }
}





