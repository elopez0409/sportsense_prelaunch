// POST /api/ai/summary - Generate game summaries

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { aiRateLimiter } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { generateGameSummary, generatePregamePreview, isAIAvailable } from '@/services/ai/gemini';
import type { AIGameContext, APIResponse } from '@/types/nba';

export const dynamic = 'force-dynamic';

const SummaryRequestSchema = z.object({
  gameId: z.string(),
  type: z.enum(['pregame', 'halftime', 'final']),
});

async function buildGameContext(gameId: string): Promise<AIGameContext | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      homeTeam: true,
      awayTeam: true,
      plays: {
        orderBy: { eventNum: 'desc' },
        take: 10,
      },
      playerStats: {
        include: { player: true },
        orderBy: { points: 'desc' },
      },
    },
  });

  if (!game) return null;

  const homeStats = game.playerStats.filter((s) => s.teamId === game.homeTeamId);
  const awayStats = game.playerStats.filter((s) => s.teamId === game.awayTeamId);

  const getLeader = (stats: typeof homeStats, stat: 'points' | 'reb' | 'ast') => {
    if (stats.length === 0) return undefined;
    const leader = stats.reduce((max, s) => (s[stat] > max[stat] ? s : max));
    return { player: leader.player.fullName, value: leader[stat] };
  };

  return {
    game: {
      homeTeam: game.homeTeam.fullName,
      awayTeam: game.awayTeam.fullName,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      period: game.period,
      gameClock: game.gameClock,
      isLive: game.status === 'LIVE',
      venue: game.venue,
    },
    recentPlays: game.plays.map((play) => ({
      description: play.description,
      period: play.period,
      clock: play.gameClock,
      scoreAfter: `${game.awayTeam.abbreviation} ${play.awayScore} - ${game.homeTeam.abbreviation} ${play.homeScore}`,
    })),
    homeLeaders: {
      points: getLeader(homeStats, 'points'),
      rebounds: getLeader(homeStats, 'reb'),
      assists: getLeader(homeStats, 'ast'),
    },
    awayLeaders: {
      points: getLeader(awayStats, 'points'),
      rebounds: getLeader(awayStats, 'reb'),
      assists: getLeader(awayStats, 'ast'),
    },
    dataTimestamp: game.lastSyncAt.toISOString(),
    dataSource: game.dataSource,
  };
}

export async function POST(request: NextRequest) {
  if (!isAIAvailable()) {
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'AI_UNAVAILABLE',
        message: 'AI features are not configured',
      },
    }, { status: 503 });
  }

  // Rate limiting
  if (aiRateLimiter) {
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const { success } = await aiRateLimiter.limit(ip);
    if (!success) {
      return NextResponse.json<APIResponse<null>>({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait.',
        },
      }, { status: 429 });
    }
  }

  try {
    const body = await request.json();
    const parsed = SummaryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<APIResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: parsed.error.issues[0].message,
        },
      }, { status: 400 });
    }

    const { gameId, type } = parsed.data;
    logger.api.request('POST', '/api/ai/summary', { gameId, type });

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { homeTeam: true, awayTeam: true },
    });

    if (!game) {
      return NextResponse.json<APIResponse<null>>({
        success: false,
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'Game not found',
        },
      }, { status: 404 });
    }

    let response;

    if (type === 'pregame') {
      response = await generatePregamePreview(
        game.homeTeam.fullName,
        game.awayTeam.fullName
      );
    } else {
      const context = await buildGameContext(gameId);
      if (!context) {
        return NextResponse.json<APIResponse<null>>({
          success: false,
          error: {
            code: 'CONTEXT_ERROR',
            message: 'Could not build game context',
          },
        }, { status: 500 });
      }
      response = await generateGameSummary(context, type);
    }

    // Save to database
    const summaryTypeMap = {
      pregame: 'PREGAME_PREVIEW',
      halftime: 'HALFTIME_REPORT',
      final: 'FINAL_RECAP',
    } as const;

    await prisma.aISummary.upsert({
      where: {
        gameId_summaryType: {
          gameId,
          summaryType: summaryTypeMap[type],
        },
      },
      update: {
        content: response.text,
        modelUsed: response.model,
        dataSnapshot: {},
        promptUsed: type,
        generatedAt: new Date(),
      },
      create: {
        gameId,
        summaryType: summaryTypeMap[type],
        content: response.text,
        modelUsed: response.model,
        dataSnapshot: {},
        promptUsed: type,
      },
    });

    return NextResponse.json<APIResponse<{ summary: string; type: string }>>({
      success: true,
      data: {
        summary: response.text,
        type,
      },
      meta: {
        model: response.model,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.api.error('POST', '/api/ai/summary', error as Error);
    
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate summary',
      },
    }, { status: 500 });
  }
}



