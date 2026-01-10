// POST /api/ai/summary - Generate game summaries

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateGameSummary, generatePregamePreview, isAIAvailable } from '@/services/ai/gemini';
import { fetchGameBoxscore, fetchLiveScores, fetchScoresByDate } from '@/services/nba/live-data';
import type { AIGameContext, APIResponse } from '@/types/nba';

// Optional dependencies - wrap in try-catch to prevent route failure
let prisma: any;
let aiRateLimiter: any;
let getCache: any;
let setCache: any;
let logger: any;

try {
  const dbModule = require('@/lib/db');
  prisma = dbModule.prisma;
} catch (e) {
  console.warn('[AI Summary] Prisma not available:', e);
}

try {
  const redisModule = require('@/lib/redis');
  aiRateLimiter = redisModule.aiRateLimiter;
  getCache = redisModule.getCache;
  setCache = redisModule.setCache;
} catch (e) {
  console.warn('[AI Summary] Redis not available:', e);
}

try {
  const loggerModule = require('@/lib/logger');
  logger = loggerModule.logger || loggerModule.default;
} catch (e) {
  console.warn('[AI Summary] Logger not available:', e);
  logger = {
    api: {
      request: () => {},
      error: () => {},
    },
  };
}

export const dynamic = 'force-dynamic';

const SummaryRequestSchema = z.object({
  gameId: z.string(),
  type: z.enum(['pregame', 'halftime', 'final']),
  homeTeamAbbr: z.string().optional(),
  awayTeamAbbr: z.string().optional(),
  gameDate: z.string().optional(),
});

type SummaryCacheEntry = {
  summary: string;
  type: 'pregame' | 'halftime' | 'final';
  model?: string;
  timestamp: string;
};

function getSummaryCacheKey(params: {
  gameId: string;
  type: 'pregame' | 'halftime' | 'final';
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  gameDate?: string;
}) {
  const home = params.homeTeamAbbr || '';
  const away = params.awayTeamAbbr || '';
  const date = params.gameDate || '';
  return `ai:summary:${params.gameId}:${params.type}:${home}:${away}:${date}`;
}

function getSummaryCacheTtl(type: 'pregame' | 'halftime' | 'final') {
  if (type === 'halftime') return 60 * 3;
  if (type === 'pregame') return 60 * 60;
  return 60 * 60 * 24;
}

function getDateRange(dateStr?: string) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatDateParam(dateStr?: string) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeAbbr(abbr?: string) {
  return abbr?.trim().toUpperCase() || null;
}

function parseLeaderValue(leaderStr?: string) {
  if (!leaderStr) return null;
  const match = leaderStr.match(/^(.*)\s\(([^)]+)\)$/);
  if (!match) return null;
  const player = match[1]?.trim();
  const valueMatch = match[2]?.match(/[\d.]+/);
  if (!player || !valueMatch) return null;
  const value = parseFloat(valueMatch[0]);
  if (Number.isNaN(value)) return null;
  return { player, value };
}

async function buildContextFromLiveData(params: {
  gameId?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  gameDate?: string;
}): Promise<{ context: AIGameContext; homeName: string; awayName: string } | null> {
  const homeAbbr = normalizeAbbr(params.homeTeamAbbr);
  const awayAbbr = normalizeAbbr(params.awayTeamAbbr);
  const dateParam = formatDateParam(params.gameDate);

  const liveData = dateParam
    ? await fetchScoresByDate(dateParam)
    : await fetchLiveScores();

  const target = liveData.games.find((game) => {
    if (params.gameId && game.gameId === params.gameId) return true;
    if (!homeAbbr || !awayAbbr) return false;
    const home = normalizeAbbr(game.homeTeam.abbreviation);
    const away = normalizeAbbr(game.awayTeam.abbreviation);
    return (home === homeAbbr && away === awayAbbr) || (home === awayAbbr && away === homeAbbr);
  });

  if (!target) return null;

  let homeLeaders = {
    points: parseLeaderValue(target.leaders?.home.points || undefined) || undefined,
    rebounds: parseLeaderValue(target.leaders?.home.rebounds || undefined) || undefined,
    assists: parseLeaderValue(target.leaders?.home.assists || undefined) || undefined,
  };

  let awayLeaders = {
    points: parseLeaderValue(target.leaders?.away.points || undefined) || undefined,
    rebounds: parseLeaderValue(target.leaders?.away.rebounds || undefined) || undefined,
    assists: parseLeaderValue(target.leaders?.away.assists || undefined) || undefined,
  };

  const needsBoxscore =
    !homeLeaders.points || !homeLeaders.rebounds || !homeLeaders.assists ||
    !awayLeaders.points || !awayLeaders.rebounds || !awayLeaders.assists;

  if (needsBoxscore) {
    const boxscore = await fetchGameBoxscore(target.gameId);
    if (boxscore) {
      const topBy = (players: { points: number; rebounds: number; assists: number; name: string }[], key: 'points' | 'rebounds' | 'assists') => {
        if (!players.length) return undefined;
        const leader = players.reduce((max, p) => (p[key] > max[key] ? p : max));
        if (!leader[key]) return undefined;
        return { player: leader.name, value: leader[key] };
      };

      homeLeaders = {
        points: homeLeaders.points || topBy(boxscore.homePlayers, 'points'),
        rebounds: homeLeaders.rebounds || topBy(boxscore.homePlayers, 'rebounds'),
        assists: homeLeaders.assists || topBy(boxscore.homePlayers, 'assists'),
      };

      awayLeaders = {
        points: awayLeaders.points || topBy(boxscore.awayPlayers, 'points'),
        rebounds: awayLeaders.rebounds || topBy(boxscore.awayPlayers, 'rebounds'),
        assists: awayLeaders.assists || topBy(boxscore.awayPlayers, 'assists'),
      };
    }
  }

  const context: AIGameContext = {
    game: {
      homeTeam: target.homeTeam.name,
      awayTeam: target.awayTeam.name,
      homeScore: target.homeTeam.score,
      awayScore: target.awayTeam.score,
      period: target.period ?? null,
      gameClock: target.clock || null,
      venue: target.venue || null,
      isLive: target.status === 'live' || target.status === 'halftime',
    },
    recentPlays: [],
    homeLeaders,
    awayLeaders,
    dataSource: liveData.source,
    dataTimestamp: liveData.lastUpdated,
  };

  return {
    context,
    homeName: target.homeTeam.name,
    awayName: target.awayTeam.name,
  };
}

function buildTeamMatch(
  homeTeamAbbr: string,
  awayTeamAbbr: string,
  dateRange: { start: Date; end: Date } | null
) {
  const match: {
    homeTeam: { abbreviation: string };
    awayTeam: { abbreviation: string };
    scheduledAt?: { gte: Date; lt: Date };
  } = {
    homeTeam: { abbreviation: homeTeamAbbr },
    awayTeam: { abbreviation: awayTeamAbbr },
  };

  if (dateRange) {
    match.scheduledAt = { gte: dateRange.start, lt: dateRange.end };
  }

  return match;
}

async function buildGameContext(
  gameId: string,
  homeTeamAbbr?: string,
  awayTeamAbbr?: string,
  gameDate?: string
): Promise<AIGameContext | null> {
  const dateRange = getDateRange(gameDate);
  const teamFilters = homeTeamAbbr && awayTeamAbbr
    ? [
        buildTeamMatch(homeTeamAbbr, awayTeamAbbr, dateRange),
        buildTeamMatch(awayTeamAbbr, homeTeamAbbr, dateRange),
      ]
    : [];

  const game = await prisma.game.findFirst({
    where: {
      OR: [
        { id: gameId },
        { externalId: gameId },
        ...teamFilters,
      ],
    },
    orderBy: { scheduledAt: 'desc' },
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

  const homeStats = game.playerStats.filter((s: typeof game.playerStats[0]) => s.teamId === game.homeTeamId);
  const awayStats = game.playerStats.filter((s: typeof game.playerStats[0]) => s.teamId === game.awayTeamId);

  const getLeader = (stats: typeof homeStats, stat: 'points' | 'reb' | 'ast') => {
    if (stats.length === 0) return undefined;
    const leader = stats.reduce((max: typeof stats[0], s: typeof stats[0]) => (s[stat] > max[stat] ? s : max));
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
    recentPlays: game.plays.map((play: typeof game.plays[0]) => ({
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

  // Rate limiting (optional)
  if (aiRateLimiter && typeof aiRateLimiter.limit === 'function') {
    try {
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
    } catch (rateLimitError) {
      // Continue if rate limiting fails
      console.warn('[AI Summary] Rate limiting error:', rateLimitError);
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

    const { gameId, type, homeTeamAbbr, awayTeamAbbr, gameDate } = parsed.data;
    try {
      logger.api.request('POST', '/api/ai/summary', { gameId, type, homeTeamAbbr, awayTeamAbbr, gameDate });
    } catch (logError) {
      console.log('[AI Summary] Request:', { gameId, type, homeTeamAbbr, awayTeamAbbr, gameDate });
    }

    const cacheKey = getSummaryCacheKey({ gameId, type, homeTeamAbbr, awayTeamAbbr, gameDate });
    let cached: SummaryCacheEntry | null = null;
    if (getCache && typeof getCache === 'function') {
      try {
        const cacheResult = await getCache(cacheKey);
        cached = cacheResult as SummaryCacheEntry | null;
      } catch (cacheError) {
        console.warn('[AI Summary] Cache read error:', cacheError);
      }
    }
    if (cached) {
      return NextResponse.json<APIResponse<{ summary: string; type: string }>>({
        success: true,
        data: {
          summary: cached.summary,
          type: cached.type,
        },
        meta: {
          model: cached.model,
          timestamp: cached.timestamp,
          cached: true,
        },
      });
    }

    // Try database first, fallback to live data
    let game: any = null;
    if (prisma && prisma.game) {
      try {
        const dateRange = getDateRange(gameDate);
        const teamFilters = homeTeamAbbr && awayTeamAbbr
          ? [
              buildTeamMatch(homeTeamAbbr, awayTeamAbbr, dateRange),
              buildTeamMatch(awayTeamAbbr, homeTeamAbbr, dateRange),
            ]
          : [];

        game = await prisma.game.findFirst({
          where: {
            OR: [
              { id: gameId },
              { externalId: gameId },
              ...teamFilters,
            ],
          },
          orderBy: { scheduledAt: 'desc' },
          include: { homeTeam: true, awayTeam: true },
        });
      } catch (dbError) {
        console.warn('[AI Summary] Database query error:', dbError);
      }
    }

    if (!game) {
      const liveFallback = await buildContextFromLiveData({
        gameId,
        homeTeamAbbr,
        awayTeamAbbr,
        gameDate,
      });

      if (!liveFallback) {
        return NextResponse.json<APIResponse<null>>({
          success: false,
          error: {
            code: 'GAME_NOT_FOUND',
            message: 'Game not found',
          },
        }, { status: 404 });
      }

      if (type === 'pregame') {
        const response = await generatePregamePreview(
          liveFallback.context.game.homeTeam,
          liveFallback.context.game.awayTeam
        );

        if (setCache && typeof setCache === 'function') {
          try {
            await setCache(cacheKey, {
              summary: response.text,
              type,
              model: response.model,
              timestamp: new Date().toISOString(),
            }, { ttl: getSummaryCacheTtl(type) });
          } catch (cacheError) {
            console.warn('[AI Summary] Cache write error:', cacheError);
          }
        }

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
      }

      const response = await generateGameSummary(liveFallback.context, type);

        if (setCache && typeof setCache === 'function') {
          try {
            await setCache(cacheKey, {
              summary: response.text,
              type,
              model: response.model,
              timestamp: new Date().toISOString(),
            }, { ttl: getSummaryCacheTtl(type) });
          } catch (cacheError) {
            console.warn('[AI Summary] Cache write error:', cacheError);
          }
        }

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
    }

    let response;

    if (type === 'pregame') {
      response = await generatePregamePreview(
        game.homeTeam.fullName,
        game.awayTeam.fullName
      );
    } else {
      const context = await buildGameContext(gameId, homeTeamAbbr, awayTeamAbbr, gameDate);
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

    // Save to database (optional)
    if (prisma && prisma.aISummary) {
      try {
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
            dataSnapshot: JSON.stringify({}),
            promptUsed: type,
            generatedAt: new Date(),
          },
          create: {
            gameId,
            summaryType: summaryTypeMap[type],
            content: response.text,
            modelUsed: response.model,
            dataSnapshot: JSON.stringify({}),
            promptUsed: type,
          },
        });
      } catch (dbError) {
        console.warn('[AI Summary] Database save error:', dbError);
      }
    }

    // Cache the result (optional)
    if (setCache && typeof setCache === 'function') {
      try {
        await setCache(cacheKey, {
      summary: response.text,
      type,
      model: response.model,
      timestamp: new Date().toISOString(),
        }, { ttl: getSummaryCacheTtl(type) });
      } catch (cacheError) {
        console.warn('[AI Summary] Cache write error:', cacheError);
      }
    }

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
    try {
      logger.api.error('POST', '/api/ai/summary', error as Error);
    } catch (logError) {
      console.error('[AI Summary] Error:', error);
    }
    
    return NextResponse.json<APIResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate summary',
      },
    }, { status: 500 });
  }
}
