// POST /api/sync - Trigger data synchronization
// Protected endpoint - requires API key in production

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { syncTeams, syncPlayers, syncGames, syncGameStats, runFullSync } from '@/services/nba/sync';
import { getCurrentSeason } from '@/services/nba/client';
import type { APIResponse } from '@/types/nba';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for sync operations

// Simple API key auth for sync endpoint
function isAuthorized(request: NextRequest): boolean {
  // In development, allow all
  if (process.env.NODE_ENV === 'development') return true;
  
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.SYNC_API_KEY;
  
  if (!apiKey) return false;
  return authHeader === `Bearer ${apiKey}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key',
      },
    }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const syncType = body.type || 'full';

    logger.info('Sync triggered', { type: syncType });

    let result: Record<string, unknown> = {};

    switch (syncType) {
      case 'teams':
        result.teams = await syncTeams();
        break;

      case 'players':
        result.players = await syncPlayers(body.maxPages || 50);
        break;

      case 'games': {
        const today = new Date().toISOString().split('T')[0];
        const startDate = body.startDate || today;
        const endDate = body.endDate || today;
        result.games = await syncGames({
          startDate,
          endDate,
          season: body.season || getCurrentSeason(),
        });
        break;
      }

      case 'stats':
        if (!body.gameId) {
          return NextResponse.json<APIResponse<null>>({
            success: false,
            error: {
              code: 'MISSING_GAME_ID',
              message: 'gameId required for stats sync',
            },
          }, { status: 400 });
        }
        result.stats = await syncGameStats(body.gameId);
        break;

      case 'full':
      default:
        result = await runFullSync();
        break;
    }

    return NextResponse.json<APIResponse<typeof result>>({
      success: true,
      data: result,
      meta: {
        syncType,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Sync failed', {}, error as Error);
    
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'SYNC_FAILED',
        message: (error as Error).message,
      },
    }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  const { prisma } = await import('@/lib/db');
  
  const recentSyncs = await prisma.syncLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
  });

  const counts = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.game.count(),
    prisma.play.count(),
  ]);

  return NextResponse.json<APIResponse<unknown>>({
    success: true,
    data: {
      counts: {
        teams: counts[0],
        players: counts[1],
        games: counts[2],
        plays: counts[3],
      },
      recentSyncs: recentSyncs.map((s) => ({
        type: s.syncType,
        status: s.status,
        recordsProcessed: s.recordsProcessed,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
    },
  });
}





