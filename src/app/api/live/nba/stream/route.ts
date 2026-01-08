// Real-time NBA Game Stream using Server-Sent Events
// Provides live updates every 5 seconds for live games

import { NextRequest } from 'next/server';
import { fetchLiveScores } from '@/services/nba/live-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Keep track of last known game state to detect changes
let lastGameStates: Map<string, { homeScore: number; awayScore: number; clock: string }> = new Map();

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)
      );

      let isActive = true;
      
      // Function to fetch and send updates
      const sendUpdate = async () => {
        if (!isActive) return;
        
        try {
          const { games, lastUpdated } = await fetchLiveScores();
          
          // Process each game to detect changes
          const updates: any[] = [];
          const liveGames = games.filter(g => g.status === 'live' || g.status === 'halftime');
          
          for (const game of games) {
            const gameKey = game.gameId;
            const lastState = lastGameStates.get(gameKey);
            
            const currentState = {
              homeScore: game.homeTeam.score,
              awayScore: game.awayTeam.score,
              clock: game.clock,
            };
            
            // Check if anything changed
            const hasScoreChange = lastState && (
              lastState.homeScore !== currentState.homeScore ||
              lastState.awayScore !== currentState.awayScore
            );
            
            const hasClockChange = lastState && lastState.clock !== currentState.clock;
            
            // Update last known state
            lastGameStates.set(gameKey, currentState);
            
            // Include change flags in the game data
            updates.push({
              ...game,
              _changes: {
                scoreChanged: hasScoreChange,
                homeScored: hasScoreChange && lastState && currentState.homeScore > lastState.homeScore,
                awayScored: hasScoreChange && lastState && currentState.awayScore > lastState.awayScore,
                clockChanged: hasClockChange,
                pointsScored: hasScoreChange && lastState ? {
                  home: currentState.homeScore - lastState.homeScore,
                  away: currentState.awayScore - lastState.awayScore,
                } : null,
              },
            });
          }
          
          // Send the update
          const message = {
            type: 'update',
            timestamp: Date.now(),
            lastUpdated,
            games: updates,
            liveCount: liveGames.length,
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );
        } catch (error) {
          console.error('[SSE] Error fetching live data:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to fetch data' })}\n\n`)
          );
        }
      };

      // Send initial data immediately
      await sendUpdate();

      // Set up interval for updates (every 5 seconds for live data)
      const intervalId = setInterval(sendUpdate, 5000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        isActive = false;
        clearInterval(intervalId);
        try {
          controller.close();
        } catch (e) {
          // Stream already closed
        }
      });

      // Keep the connection alive with heartbeat
      const heartbeatId = setInterval(() => {
        if (!isActive) return;
        try {
          controller.enqueue(
            encoder.encode(`: heartbeat ${Date.now()}\n\n`)
          );
        } catch (e) {
          // Connection closed
          isActive = false;
          clearInterval(heartbeatId);
          clearInterval(intervalId);
        }
      }, 30000); // Heartbeat every 30 seconds
    },
  });

  // Return the SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  });
}




