'use client';

// Live Notifications Hook - Monitors games and generates notifications
// Detects close games, big plays, and important moments

import { useEffect, useRef, useCallback } from 'react';
import { useNotifications } from '@/components/notifications/NotificationProvider';

interface LiveGame {
  gameId: string;
  homeTeam: { name: string; abbreviation: string; score: number };
  awayTeam: { name: string; abbreviation: string; score: number };
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  period: number;
  clock: string;
}

interface GameState {
  lastScore: { home: number; away: number };
  lastPeriod: number;
  notifiedFinal: boolean;
  notifiedHalftime: boolean;
  notifiedCloseGame: boolean;
  bigPlayCount: number;
}

export function useLiveNotifications(pollInterval = 30000) {
  const { addNotification } = useNotifications();
  const gameStatesRef = useRef<Map<string, GameState>>(new Map());
  const isPollingRef = useRef(false);

  // Check for notification-worthy events
  const checkForNotifications = useCallback((game: LiveGame) => {
    const state = gameStatesRef.current.get(game.gameId) || {
      lastScore: { home: 0, away: 0 },
      lastPeriod: 0,
      notifiedFinal: false,
      notifiedHalftime: false,
      notifiedCloseGame: false,
      bigPlayCount: 0,
    };

    const scoreChange = {
      home: game.homeTeam.score - state.lastScore.home,
      away: game.awayTeam.score - state.lastScore.away,
    };

    // Big scoring play (3+ points at once = 3-pointer or and-1)
    if (game.status === 'live') {
      const maxScoreChange = Math.max(scoreChange.home, scoreChange.away);
      
      if (maxScoreChange >= 3 && state.bigPlayCount < 5) { // Limit notifications
        const scoringTeam = scoreChange.home >= scoreChange.away ? game.homeTeam : game.awayTeam;
        addNotification({
          type: 'highlight',
          title: `🎯 ${scoringTeam.abbreviation} scores!`,
          message: `${scoringTeam.name} hits a ${maxScoreChange === 3 ? 'three-pointer' : 'big play'}! Score: ${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.abbreviation} ${game.homeTeam.score}`,
          sport: 'NBA',
        });
        state.bigPlayCount++;
      }

      // Close game in 4th quarter
      const scoreDiff = Math.abs(game.homeTeam.score - game.awayTeam.score);
      if (game.period === 4 && scoreDiff <= 5 && !state.notifiedCloseGame) {
        addNotification({
          type: 'alert',
          title: `🔥 Close game alert!`,
          message: `${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} is a nail-biter! ${game.awayTeam.score}-${game.homeTeam.score} with ${game.clock} left`,
          sport: 'NBA',
        });
        state.notifiedCloseGame = true;
      }
    }

    // Halftime
    if (game.status === 'halftime' && !state.notifiedHalftime) {
      addNotification({
        type: 'info',
        title: `⏸️ Halftime: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
        message: `${game.awayTeam.name} ${game.awayTeam.score} - ${game.homeTeam.name} ${game.homeTeam.score}`,
        sport: 'NBA',
      });
      state.notifiedHalftime = true;
    }

    // Game ended
    if (game.status === 'final' && !state.notifiedFinal) {
      const winner = game.homeTeam.score > game.awayTeam.score ? game.homeTeam : game.awayTeam;
      const loser = game.homeTeam.score > game.awayTeam.score ? game.awayTeam : game.homeTeam;
      
      addNotification({
        type: 'score',
        title: `🏆 ${winner.abbreviation} wins!`,
        message: `Final: ${winner.name} defeats ${loser.name} ${winner.score}-${loser.score}`,
        sport: 'NBA',
      });
      state.notifiedFinal = true;
    }

    // Update state
    state.lastScore = { home: game.homeTeam.score, away: game.awayTeam.score };
    state.lastPeriod = game.period;
    gameStatesRef.current.set(game.gameId, state);
  }, [addNotification]);

  // Poll for live data
  const pollForUpdates = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const response = await fetch('/api/live/nba');
      if (response.ok) {
        const data = await response.json();
        const games: LiveGame[] = data.games || [];
        
        games.forEach(game => {
          if (game.status === 'live' || game.status === 'halftime' || game.status === 'final') {
            checkForNotifications(game);
          }
        });
      }
    } catch (error) {
      console.error('Failed to poll for live updates:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [checkForNotifications]);

  // Set up polling
  useEffect(() => {
    // Initial poll
    pollForUpdates();

    // Set up interval
    const intervalId = setInterval(pollForUpdates, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [pollForUpdates, pollInterval]);

  return {
    // Manual trigger for testing
    triggerCheck: pollForUpdates,
  };
}

// Demo hook for testing notifications
export function useDemoNotifications() {
  const { addNotification } = useNotifications();

  const triggerScoreNotification = useCallback(() => {
    addNotification({
      type: 'score',
      title: '🏆 Lakers win!',
      message: 'Final: Los Angeles Lakers defeat Boston Celtics 115-110',
      sport: 'NBA',
    });
  }, [addNotification]);

  const triggerHighlightNotification = useCallback(() => {
    addNotification({
      type: 'highlight',
      title: '🎯 LeBron with the three!',
      message: 'LeBron James hits a clutch three-pointer with 30 seconds left!',
      sport: 'NBA',
    });
  }, [addNotification]);

  const triggerAlertNotification = useCallback(() => {
    addNotification({
      type: 'alert',
      title: '🔥 Close game alert!',
      message: 'LAL vs BOS is a nail-biter! 108-107 with 2:30 left in Q4',
      sport: 'NBA',
    });
  }, [addNotification]);

  const triggerInfoNotification = useCallback(() => {
    addNotification({
      type: 'info',
      title: '⏸️ Halftime: LAL @ BOS',
      message: 'Lakers 55 - Celtics 52. LeBron leads all scorers with 18 points.',
      sport: 'NBA',
    });
  }, [addNotification]);

  return {
    triggerScoreNotification,
    triggerHighlightNotification,
    triggerAlertNotification,
    triggerInfoNotification,
  };
}





