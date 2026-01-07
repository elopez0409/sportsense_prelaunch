'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LiveGameData } from '@/components/games/LiveGameCard';

interface GameChangeInfo extends LiveGameData {
  _changes?: {
    scoreChanged: boolean;
    homeScored: boolean;
    awayScored: boolean;
    clockChanged: boolean;
    pointsScored: { home: number; away: number } | null;
  };
}

interface SSEMessage {
  type: 'connected' | 'update' | 'error';
  timestamp: number;
  lastUpdated?: string;
  games?: GameChangeInfo[];
  liveCount?: number;
  message?: string;
}

interface UseLiveGameUpdatesOptions {
  enabled?: boolean;
  onScoreChange?: (gameId: string, team: 'home' | 'away', points: number, game: GameChangeInfo) => void;
  onGameUpdate?: (games: GameChangeInfo[]) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useLiveGameUpdates(
  initialGames: LiveGameData[],
  options: UseLiveGameUpdatesOptions = {}
) {
  const { 
    enabled = true, 
    onScoreChange, 
    onGameUpdate,
    onConnectionChange 
  } = options;

  const [games, setGames] = useState<GameChangeInfo[]>(initialGames);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    return Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttempts.current),
      30000 // Max 30 seconds
    );
  }, []);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;
    
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('[LiveUpdates] Connecting to SSE stream...');
    
    const eventSource = new EventSource('/api/live/nba/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[LiveUpdates] Connected to SSE stream');
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      onConnectionChange?.(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SSEMessage = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('[LiveUpdates] Initial connection confirmed');
          return;
        }
        
        if (data.type === 'error') {
          console.error('[LiveUpdates] Server error:', data.message);
          setError(data.message || 'Unknown error');
          return;
        }
        
        if (data.type === 'update' && data.games) {
          setLastUpdate(new Date(data.timestamp));
          
          // Check for score changes and trigger callbacks
          data.games.forEach((game) => {
            if (game._changes?.scoreChanged) {
              if (game._changes.homeScored && game._changes.pointsScored) {
                onScoreChange?.(game.gameId, 'home', game._changes.pointsScored.home, game);
              }
              if (game._changes.awayScored && game._changes.pointsScored) {
                onScoreChange?.(game.gameId, 'away', game._changes.pointsScored.away, game);
              }
            }
          });

          // Update games state
          setGames(data.games);
          onGameUpdate?.(data.games);
        }
      } catch (e) {
        console.error('[LiveUpdates] Failed to parse SSE message:', e);
      }
    };

    eventSource.onerror = (event) => {
      console.error('[LiveUpdates] SSE connection error:', event);
      setIsConnected(false);
      onConnectionChange?.(false);
      
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = getReconnectDelay();
        console.log(`[LiveUpdates] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current += 1;
          connect();
        }, delay);
      } else {
        setError('Failed to connect after multiple attempts. Please refresh the page.');
      }
    };

    return () => {
      eventSource.close();
    };
  }, [enabled, onScoreChange, onGameUpdate, onConnectionChange, getReconnectDelay]);

  // Initial connection
  useEffect(() => {
    const hasLiveGames = initialGames.some(g => g.status === 'live' || g.status === 'halftime');
    
    if (enabled && hasLiveGames) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, connect, initialGames]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/live/nba');
      if (response.ok) {
        const data = await response.json();
        setGames(data.games);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('[LiveUpdates] Manual refresh failed:', e);
    }
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  // Reconnect function
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    setError(null);
    connect();
  }, [connect]);

  return {
    games,
    isConnected,
    lastUpdate,
    error,
    refresh,
    disconnect,
    reconnect,
  };
}

export default useLiveGameUpdates;



