// GET /api/live - Server-Sent Events for live game updates

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCachedGameState, cacheGameState } from '@/lib/redis';
import * as nbaClient from '@/services/nba/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// How often to poll for updates (ms)
const POLL_INTERVAL = 10000; // 10 seconds

// Maximum connection time (ms) - reconnect after this
const MAX_CONNECTION_TIME = 300000; // 5 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const gameId = searchParams.get('gameId');

  logger.api.request('GET', '/api/live', { gameId });

  const encoder = new TextEncoder();
  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      const connectionStart = Date.now();
      
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)
      );

      // Polling loop
      const poll = async () => {
        while (isConnected && (Date.now() - connectionStart) < MAX_CONNECTION_TIME) {
          try {
            // Fetch live scoreboard from NBA
            const scoreboard = await nbaClient.getLiveScoreboard();
            
            if (scoreboard?.scoreboard?.games) {
              const games = scoreboard.scoreboard.games;
              
              // If specific gameId requested, filter
              const targetGames = gameId
                ? games.filter((g) => g.gameId === gameId)
                : games;

              for (const game of targetGames) {
                // Get previous state from cache
                const previousState = await getCachedGameState(game.gameId);
                
                // Check if anything changed
                const hasChanged = !previousState || 
                  previousState.homeScore !== game.homeTeam.score ||
                  previousState.awayScore !== game.awayTeam.score ||
                  previousState.period !== game.period ||
                  previousState.gameClock !== game.gameClock;

                if (hasChanged) {
                  // Map NBA status to our status
                  let status = 'SCHEDULED';
                  if (game.gameStatus === 2) status = 'LIVE';
                  else if (game.gameStatus === 3) status = 'FINAL';

                  const update = {
                    type: 'gameUpdate',
                    gameId: game.gameId,
                    homeTeam: game.homeTeam.teamTricode,
                    awayTeam: game.awayTeam.teamTricode,
                    homeScore: game.homeTeam.score,
                    awayScore: game.awayTeam.score,
                    period: game.period,
                    gameClock: game.gameClock,
                    status,
                    statusText: game.gameStatusText,
                    timestamp: Date.now(),
                  };

                  // Send update to client
                  controller.enqueue(
                    encoder.encode(`event: gameUpdate\ndata: ${JSON.stringify(update)}\n\n`)
                  );

                  // Update cache
                  await cacheGameState(game.gameId, {
                    homeScore: game.homeTeam.score,
                    awayScore: game.awayTeam.score,
                    period: game.period,
                    gameClock: game.gameClock,
                    status,
                  });

                  // Update database for persistence
                  try {
                    await prisma.game.updateMany({
                      where: { nbaStatsId: game.gameId },
                      data: {
                        homeScore: game.homeTeam.score,
                        awayScore: game.awayTeam.score,
                        period: game.period,
                        gameClock: game.gameClock,
                        status: status as 'SCHEDULED' | 'LIVE' | 'HALFTIME' | 'FINAL' | 'POSTPONED' | 'CANCELLED',
                        lastSyncAt: new Date(),
                      },
                    });
                  } catch {
                    // Non-critical - just for persistence
                  }
                }
              }
            }

            // Send heartbeat
            controller.enqueue(
              encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)
            );
          } catch (error) {
            logger.error('SSE poll error', {}, error as Error);
            
            // Send error event but keep connection alive
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'Temporary data fetch error' })}\n\n`)
            );
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        }

        // Connection timeout - tell client to reconnect
        controller.enqueue(
          encoder.encode(`event: reconnect\ndata: ${JSON.stringify({ message: 'Please reconnect' })}\n\n`)
        );
        controller.close();
      };

      poll();
    },
    
    cancel() {
      isConnected = false;
      logger.info('SSE connection closed by client');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}




