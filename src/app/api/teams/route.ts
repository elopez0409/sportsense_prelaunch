// GET /api/teams - List all teams

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCache, setCache } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { APIResponse, TeamInfo } from '@/types/nba';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conference = searchParams.get('conference');
  const division = searchParams.get('division');

  logger.api.request('GET', '/api/teams', { conference, division });

  try {
    const cacheKey = `api:teams:${conference || 'all'}:${division || 'all'}`;
    
    const cached = await getCache<TeamInfo[]>(cacheKey);
    if (cached) {
      logger.cache.hit(cacheKey);
      return NextResponse.json<APIResponse<TeamInfo[]>>({
        success: true,
        data: cached,
        meta: { cached: true },
      });
    }

    const where: Record<string, unknown> = {};
    if (conference) where.conference = conference;
    if (division) where.division = division;

    const teams = await prisma.team.findMany({
      where,
      orderBy: [
        { conference: 'asc' },
        { division: 'asc' },
        { name: 'asc' },
      ],
    });

    const data: TeamInfo[] = teams.map((team) => ({
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
    }));

    // Cache for 24 hours
    await setCache(cacheKey, data, { ttl: 86400 });

    return NextResponse.json<APIResponse<TeamInfo[]>>({
      success: true,
      data,
      meta: {
        totalCount: data.length,
        cached: false,
      },
    });
  } catch (error) {
    logger.api.error('GET', '/api/teams', error as Error);
    
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch teams',
      },
    }, { status: 500 });
  }
}




