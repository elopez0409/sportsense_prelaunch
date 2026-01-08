// Redis client using Upstash for caching and rate limiting

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Check if Redis is configured
const isRedisConfigured = () => {
  return (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
};

// Create Redis client (or null if not configured)
export const redis = isRedisConfigured()
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiter for API routes (10 requests per 10 seconds)
export const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: 'ratelimit:api',
    })
  : null;

// Rate limiter for AI endpoints (stricter - 5 per minute)
export const aiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
      prefix: 'ratelimit:ai',
    })
  : null;

// Rate limiter for external API calls (respect their limits)
export const externalApiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(25, '1 m'), // Stay under Ball Don't Lie's 30/min
      analytics: true,
      prefix: 'ratelimit:external',
    })
  : null;

// ============================================
// CACHE UTILITIES
// ============================================

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

const DEFAULT_TTL = 60; // 1 minute default
const CACHE_PREFIX = 'sportsense:cache:';

/**
 * Get a value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  
  try {
    const value = await redis.get<T>(`${CACHE_PREFIX}${key}`);
    return value;
  } catch (error) {
    console.error('[Cache] Get error:', error);
    return null;
  }
}

/**
 * Set a value in cache
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  if (!redis) return;
  
  const { ttl = DEFAULT_TTL } = options;
  
  try {
    await redis.set(`${CACHE_PREFIX}${key}`, value, { ex: ttl });
  } catch (error) {
    console.error('[Cache] Set error:', error);
  }
}

/**
 * Delete a value from cache
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.del(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('[Cache] Delete error:', error);
  }
}

/**
 * Delete all cache entries matching a pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redis) return;
  
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('[Cache] Delete pattern error:', error);
  }
}

// ============================================
// GAME STATE CACHE (for real-time updates)
// ============================================

export interface GameStateCache {
  gameId: string;
  homeScore: number;
  awayScore: number;
  period: number;
  gameClock: string | null;
  status: string;
  lastPlayId?: string;
  updatedAt: string;
}

/**
 * Cache live game state (short TTL for freshness)
 */
export async function cacheGameState(
  gameId: string,
  state: Omit<GameStateCache, 'gameId' | 'updatedAt'>
): Promise<void> {
  const cacheData: GameStateCache = {
    ...state,
    gameId,
    updatedAt: new Date().toISOString(),
  };
  
  // 10 second TTL for live games
  await setCache(`game:${gameId}:state`, cacheData, { ttl: 10 });
}

/**
 * Get cached game state
 */
export async function getCachedGameState(
  gameId: string
): Promise<GameStateCache | null> {
  return getCache<GameStateCache>(`game:${gameId}:state`);
}

// ============================================
// PUBSUB FOR REAL-TIME (Redis Streams simulation)
// ============================================

const GAME_UPDATES_CHANNEL = 'sportsense:game-updates';

/**
 * Publish a game update event
 */
export async function publishGameUpdate(
  gameId: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.publish(GAME_UPDATES_CHANNEL, JSON.stringify({
      gameId,
      ...data,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.error('[PubSub] Publish error:', error);
  }
}




