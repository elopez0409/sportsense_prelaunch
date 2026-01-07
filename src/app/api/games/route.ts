// GET /api/games - List games with filtering

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCache, setCache } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { APIResponse, GameInfo } from '@/types/nba';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date'); // YYYY-MM-DD
  const teamId = searchParams.get('teamId');
  const status = searchParams.get('status'); // SCHEDULED, LIVE, FINAL
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);

  logger.api.request('GET', '/api/games', { date, teamId, status, page, limit });

  try {
    // Build cache key
    const cacheKey = `api:games:${date || 'all'}:${teamId || 'all'}:${status || 'all'}:${page}:${limit}`;
    
    // Check cache for non-live data
    if (status !== 'LIVE') {
      const cached = await getCache<GameInfo[]>(cacheKey);
      if (cached) {
        logger.cache.hit(cacheKey);
        return NextResponse.json<APIResponse<GameInfo[]>>({
          success: true,
          data: cached,
          meta: { cached: true },
        });
      }
    }

    // Build query
    const where: Record<string, unknown> = {};
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      where.scheduledAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }
    
    if (teamId) {
      where.OR = [
        { homeTeamId: teamId },
        { awayTeamId: teamId },
      ];
    }
    
    if (status) {
      where.status = status;
    }

    const games = await prisma.game.findMany({
      where,
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: { scheduledAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalCount = await prisma.game.count({ where });

    // Transform to API response format
    const data: GameInfo[] = games.map((game) => ({
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
    }));

    // Cache for 1 minute (5 min for historical)
    const ttl = status === 'LIVE' ? 10 : (date && new Date(date) < new Date() ? 300 : 60);
    await setCache(cacheKey, data, { ttl });

    return NextResponse.json<APIResponse<GameInfo[]>>({
      success: true,
      data,
      meta: {
        page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        cached: false,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.api.error('GET', '/api/games', error as Error);
    
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch games',
      },
    }, { status: 500 });
  }
}



