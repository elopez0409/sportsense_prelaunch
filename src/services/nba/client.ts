// NBA Data Client - Handles all external API calls with rate limiting and caching

import { logger } from '@/lib/logger';
import { retry, sleep } from '@/lib/utils';
import { getCache, setCache } from '@/lib/redis';
import type {
  BDLTeam,
  BDLPlayer,
  BDLGame,
  BDLStats,
  BDLPaginatedResponse,
  NBAStatsResponse,
  NBAStatsPlayByPlay,
} from '@/types/nba';

// ============================================
// CONFIGURATION
// ============================================

const BALL_DONT_LIE_BASE = 'https://api.balldontlie.io/v1';
const NBA_STATS_BASE = 'https://stats.nba.com/stats';

// Rate limiting state (in-memory for now, Redis for production)
let lastBDLRequest = 0;
let lastNBAStatsRequest = 0;
const BDL_MIN_INTERVAL = 2500; // 2.5 seconds between requests (safe for 30/min limit)
const NBA_STATS_MIN_INTERVAL = 1000; // 1 second between requests

// ============================================
// BALL DON'T LIE CLIENT
// ============================================

async function rateLimitBDL(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastBDLRequest;
  if (elapsed < BDL_MIN_INTERVAL) {
    await sleep(BDL_MIN_INTERVAL - elapsed);
  }
  lastBDLRequest = Date.now();
}

async function fetchBDL<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  await rateLimitBDL();

  const url = new URL(`${BALL_DONT_LIE_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  // Add API key if available
  if (process.env.BALLDONTLIE_API_KEY) {
    headers['Authorization'] = process.env.BALLDONTLIE_API_KEY;
  }

  logger.data.sync('balldontlie', `GET ${endpoint}`, { params });

  const response = await retry(
    async () => {
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limited by Ball Don\'t Lie API');
        }
        throw new Error(`BDL API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    {
      maxAttempts: 3,
      baseDelay: 2000,
      onError: (error, attempt) => {
        logger.warn(`BDL retry ${attempt}`, { endpoint }, error);
      },
    }
  );

  return response as T;
}

// ============================================
// NBA STATS CLIENT (Unofficial)
// ============================================

async function rateLimitNBAStats(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNBAStatsRequest;
  if (elapsed < NBA_STATS_MIN_INTERVAL) {
    await sleep(NBA_STATS_MIN_INTERVAL - elapsed);
  }
  lastNBAStatsRequest = Date.now();
}

const NBA_STATS_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
};

async function fetchNBAStats<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  await rateLimitNBAStats();

  const url = new URL(`${NBA_STATS_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  logger.data.sync('nba_stats', `GET ${endpoint}`, { params });

  const response = await retry(
    async () => {
      const res = await fetch(url.toString(), {
        headers: NBA_STATS_HEADERS,
      });
      if (!res.ok) {
        throw new Error(`NBA Stats API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    {
      maxAttempts: 3,
      baseDelay: 1000,
      onError: (error, attempt) => {
        logger.warn(`NBA Stats retry ${attempt}`, { endpoint }, error);
      },
    }
  );

  return response as T;
}

// ============================================
// PUBLIC API: TEAMS
// ============================================

export async function getAllTeams(): Promise<BDLTeam[]> {
  // Check cache first
  const cached = await getCache<BDLTeam[]>('nba:teams:all');
  if (cached) {
    logger.cache.hit('nba:teams:all');
    return cached;
  }

  logger.cache.miss('nba:teams:all');
  const response = await fetchBDL<BDLPaginatedResponse<BDLTeam>>('/teams', {
    per_page: 100,
  });

  // Cache for 24 hours - teams rarely change
  await setCache('nba:teams:all', response.data, { ttl: 86400 });

  return response.data;
}

export async function getTeamById(id: number): Promise<BDLTeam | null> {
  const cacheKey = `nba:team:${id}`;
  const cached = await getCache<BDLTeam>(cacheKey);
  if (cached) {
    logger.cache.hit(cacheKey);
    return cached;
  }

  logger.cache.miss(cacheKey);
  try {
    const response = await fetchBDL<{ data: BDLTeam }>(`/teams/${id}`);
    await setCache(cacheKey, response.data, { ttl: 86400 });
    return response.data;
  } catch {
    return null;
  }
}

// ============================================
// PUBLIC API: PLAYERS
// ============================================

export async function getPlayers(
  page: number = 1,
  perPage: number = 100
): Promise<BDLPaginatedResponse<BDLPlayer>> {
  const cacheKey = `nba:players:page:${page}`;
  const cached = await getCache<BDLPaginatedResponse<BDLPlayer>>(cacheKey);
  if (cached) {
    logger.cache.hit(cacheKey);
    return cached;
  }

  logger.cache.miss(cacheKey);
  const response = await fetchBDL<BDLPaginatedResponse<BDLPlayer>>('/players', {
    page,
    per_page: perPage,
  });

  // Cache for 12 hours
  await setCache(cacheKey, response, { ttl: 43200 });

  return response;
}

export async function searchPlayers(query: string): Promise<BDLPlayer[]> {
  const response = await fetchBDL<BDLPaginatedResponse<BDLPlayer>>('/players', {
    search: query,
    per_page: 25,
  });
  return response.data;
}

export async function getPlayerById(id: number): Promise<BDLPlayer | null> {
  const cacheKey = `nba:player:${id}`;
  const cached = await getCache<BDLPlayer>(cacheKey);
  if (cached) {
    logger.cache.hit(cacheKey);
    return cached;
  }

  logger.cache.miss(cacheKey);
  try {
    const response = await fetchBDL<{ data: BDLPlayer }>(`/players/${id}`);
    await setCache(cacheKey, response.data, { ttl: 43200 });
    return response.data;
  } catch {
    return null;
  }
}

// ============================================
// PUBLIC API: GAMES
// ============================================

export async function getGames(options: {
  dates?: string[];
  seasons?: number[];
  teamIds?: number[];
  page?: number;
  perPage?: number;
}): Promise<BDLPaginatedResponse<BDLGame>> {
  const params: Record<string, string | number> = {
    page: options.page || 1,
    per_page: options.perPage || 25,
  };

  if (options.dates?.length) {
    // BDL uses dates[] array param
    const dateParams = options.dates.map((d) => `dates[]=${d}`).join('&');
    // We'll handle this differently
  }

  if (options.seasons?.length) {
    params.seasons = options.seasons[0]; // BDL only accepts one season at a time
  }

  if (options.teamIds?.length) {
    params.team_ids = options.teamIds[0]; // BDL only accepts one team at a time
  }

  // For date-specific queries, build cache key
  const cacheKey = `nba:games:${JSON.stringify(options)}`;
  
  // Only cache historical games (not today's games)
  const today = new Date().toISOString().split('T')[0];
  const isHistorical = options.dates?.every((d) => d < today);
  
  if (isHistorical) {
    const cached = await getCache<BDLPaginatedResponse<BDLGame>>(cacheKey);
    if (cached) {
      logger.cache.hit(cacheKey);
      return cached;
    }
  }

  // Build URL with array params
  let url = `/games?page=${params.page}&per_page=${params.per_page}`;
  if (options.dates?.length) {
    options.dates.forEach((d) => {
      url += `&dates[]=${d}`;
    });
  }
  if (options.seasons?.length) {
    url += `&seasons[]=${options.seasons[0]}`;
  }
  if (options.teamIds?.length) {
    options.teamIds.forEach((id) => {
      url += `&team_ids[]=${id}`;
    });
  }

  const response = await fetchBDL<BDLPaginatedResponse<BDLGame>>(url);

  if (isHistorical) {
    await setCache(cacheKey, response, { ttl: 86400 }); // Cache historical for 24h
  }

  return response;
}

export async function getGameById(id: number): Promise<BDLGame | null> {
  try {
    const response = await fetchBDL<{ data: BDLGame }>(`/games/${id}`);
    return response.data;
  } catch {
    return null;
  }
}

export async function getTodaysGames(): Promise<BDLGame[]> {
  const today = new Date().toISOString().split('T')[0];
  
  // Short cache for today's games (5 minutes)
  const cacheKey = `nba:games:today:${today}`;
  const cached = await getCache<BDLGame[]>(cacheKey);
  if (cached) {
    logger.cache.hit(cacheKey);
    return cached;
  }

  logger.cache.miss(cacheKey);
  const response = await getGames({ dates: [today] });
  
  await setCache(cacheKey, response.data, { ttl: 300 }); // 5 min cache
  
  return response.data;
}

// ============================================
// PUBLIC API: STATS
// ============================================

export async function getGameStats(gameId: number): Promise<BDLStats[]> {
  const cacheKey = `nba:stats:game:${gameId}`;
  const cached = await getCache<BDLStats[]>(cacheKey);
  if (cached) {
    logger.cache.hit(cacheKey);
    return cached;
  }

  logger.cache.miss(cacheKey);
  
  // BDL stats endpoint
  const response = await fetchBDL<BDLPaginatedResponse<BDLStats>>('/stats', {
    game_ids: gameId,
    per_page: 100,
  });

  // Cache completed game stats longer
  await setCache(cacheKey, response.data, { ttl: 3600 }); // 1 hour

  return response.data;
}

// ============================================
// NBA STATS API: LIVE DATA
// ============================================

export interface NBALiveScoreboard {
  scoreboard: {
    gameDate: string;
    games: Array<{
      gameId: string;
      gameCode: string;
      gameStatus: number;
      gameStatusText: string;
      period: number;
      gameClock: string;
      homeTeam: {
        teamId: number;
        teamTricode: string;
        score: number;
      };
      awayTeam: {
        teamId: number;
        teamTricode: string;
        score: number;
      };
    }>;
  };
}

export async function getLiveScoreboard(): Promise<NBALiveScoreboard | null> {
  // NBA Stats live endpoint
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  try {
    // Try CDN endpoint first (faster, more reliable)
    const cdnUrl = `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`;
    
    const response = await fetch(cdnUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Live scoreboard error: ${response.status}`);
    }
    
    return await response.json() as NBALiveScoreboard;
  } catch (error) {
    logger.data.error('nba_live', 'getLiveScoreboard', error as Error);
    return null;
  }
}

export async function getPlayByPlay(gameId: string): Promise<NBAStatsPlayByPlay | null> {
  try {
    // NBA CDN play-by-play endpoint
    const url = `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Play-by-play error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      gameId,
      actions: data.game?.actions || [],
    };
  } catch (error) {
    logger.data.error('nba_live', `getPlayByPlay ${gameId}`, error as Error);
    return null;
  }
}

// ============================================
// SEASON HELPERS
// ============================================

export function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // NBA season starts in October
  // If we're before October, we're in the previous year's season
  return month >= 10 ? year : year - 1;
}

export function getSeasonString(year: number): string {
  return `${year}-${String(year + 1).slice(-2)}`;
}



