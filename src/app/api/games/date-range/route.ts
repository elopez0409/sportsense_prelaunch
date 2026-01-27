// GET /api/games/date-range - Fetch games for a date range with caching and retries
// Supports historical data (previous 7+ days) for calendar and recap features

import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { fetchScoresByDate, type LiveGameData } from '@/services/nba/live-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for fetching multiple days

interface DateRangeResponse {
  success: boolean;
  data?: {
    games: LiveGameData[];
    byDate: Record<string, LiveGameData[]>;
  };
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    startDate: string;
    endDate: string;
    daysRequested: number;
    gamesFound: number;
    cached: boolean;
    timestamp: string;
  };
}

/**
 * Fetch scores with retry logic
 */
async function fetchWithRetry(
  dateStr: string, 
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<LiveGameData[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetchScoresByDate(dateStr);
      return result.games;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`[DateRange] Retry ${attempt}/${maxRetries} for ${dateStr}`, { error: lastError.message });
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  logger.error(`[DateRange] All retries failed for ${dateStr}`, { error: lastError?.message });
  return []; // Return empty instead of throwing to allow partial results
}

/**
 * Format date to YYYYMMDD for ESPN API
 */
function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Format date to YYYY-MM-DD for display/keys
 */
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest): Promise<NextResponse<DateRangeResponse>> {
  const searchParams = request.nextUrl.searchParams;
  
  // Parse query params
  const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD
  const endDateParam = searchParams.get('endDate'); // YYYY-MM-DD
  const days = parseInt(searchParams.get('days') || '7'); // Default 7 days
  const teamId = searchParams.get('teamId'); // Optional filter
  
  logger.api.request('GET', '/api/games/date-range', { startDateParam, endDateParam, days, teamId });

  try {
    // Calculate date range
    let startDate: Date;
    let endDate: Date;
    
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else if (startDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days - 1);
    } else if (endDateParam) {
      endDate = new Date(endDateParam);
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days + 1);
    } else {
      // Default: last 7 days (including today)
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days + 1);
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_DATE',
          message: 'Invalid date format. Use YYYY-MM-DD.',
        },
      }, { status: 400 });
    }

    // Limit to max 31 days
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > 31) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RANGE_TOO_LARGE',
          message: 'Date range cannot exceed 31 days.',
        },
      }, { status: 400 });
    }

    // Check cache
    const cacheKey = `api:games:range:${formatDateKey(startDate)}:${formatDateKey(endDate)}:${teamId || 'all'}`;
    const cached = await getCache<{ games: LiveGameData[]; byDate: Record<string, LiveGameData[]> }>(cacheKey);
    
    if (cached) {
      logger.cache.hit(cacheKey);
      return NextResponse.json({
        success: true,
        data: cached,
        meta: {
          startDate: formatDateKey(startDate),
          endDate: formatDateKey(endDate),
          daysRequested: daysDiff,
          gamesFound: cached.games.length,
          cached: true,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Fetch all days in parallel (with concurrency limit)
    const allGames: LiveGameData[] = [];
    const gamesByDate: Record<string, LiveGameData[]> = {};
    
    const datesToFetch: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      datesToFetch.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Fetch in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < datesToFetch.length; i += batchSize) {
      const batch = datesToFetch.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (date) => {
          const dateStr = formatDateForAPI(date);
          const dateKey = formatDateKey(date);
          
          const games = await fetchWithRetry(dateStr);
          
          return { dateKey, games };
        })
      );

      for (const { dateKey, games } of results) {
        // Filter by team if specified
        let filteredGames = games;
        if (teamId) {
          filteredGames = games.filter(g => 
            g.homeTeam.abbreviation === teamId ||
            g.awayTeam.abbreviation === teamId
          );
        }
        
        gamesByDate[dateKey] = filteredGames;
        allGames.push(...filteredGames);
      }
    }

    // Sort games by date (most recent first)
    allGames.sort((a, b) => {
      const dateA = new Date(a.gameDate || '');
      const dateB = new Date(b.gameDate || '');
      return dateB.getTime() - dateA.getTime();
    });

    // Cache for 5 minutes (300s) for historical, 1 minute for today
    const today = formatDateKey(new Date());
    const hasToday = Object.keys(gamesByDate).includes(today);
    const ttl = hasToday ? 60 : 300;
    
    await setCache(cacheKey, { games: allGames, byDate: gamesByDate }, { ttl });
    logger.debug(`[DateRange] Cache set: ${cacheKey} (TTL: ${ttl}s)`);

    return NextResponse.json({
      success: true,
      data: {
        games: allGames,
        byDate: gamesByDate,
      },
      meta: {
        startDate: formatDateKey(startDate),
        endDate: formatDateKey(endDate),
        daysRequested: daysDiff,
        gamesFound: allGames.length,
        cached: false,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.api.error('GET', '/api/games/date-range', error as Error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch games for date range',
      },
    }, { status: 500 });
  }
}
