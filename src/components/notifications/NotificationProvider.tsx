'use client';

import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';
import { X, Zap, Trophy, AlertTriangle, Bell, Sparkles } from 'lucide-react';
import { AIInsightModal } from '@/components/ai/AIInsightModal';

export interface Notification {
  id: string;
  type: 'score' | 'highlight' | 'alert' | 'info';
  title: string;
  message: string;
  sport?: string;
  teamLogo?: string;
  timestamp: Date;
  read: boolean;
  sound?: boolean;
  // AI-enhanced notification fields
  gameId?: string;
  gameStatus?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  gameDate?: string;
  hasAIInsight?: boolean;
  aiInsightPreview?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
  onViewInsight?: () => void;
}

function NotificationToast({ notification, onClose, onViewInsight }: NotificationToastProps) {
  const iconMap = {
    score: Trophy,
    highlight: Zap,
    alert: AlertTriangle,
    info: Bell,
  };
  
  const colorMap = {
    score: 'from-green-500 to-emerald-600',
    highlight: 'from-orange-500 to-amber-600',
    alert: 'from-red-500 to-rose-600',
    info: 'from-blue-500 to-cyan-600',
  };

  const Icon = iconMap[notification.type];

  useEffect(() => {
    // Longer timeout for AI-enhanced notifications
    const timeout = notification.hasAIInsight ? 8000 : 5000;
    const timer = setTimeout(onClose, timeout);
    return () => clearTimeout(timer);
  }, [onClose, notification.hasAIInsight]);

  return (
    <div className="notification-toast glass-dark rounded-xl p-4 w-80 shadow-2xl border border-white/10">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colorMap[notification.type]}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-white text-sm truncate">{notification.title}</h4>
            {notification.sport && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">
                {notification.sport}
              </span>
            )}
          </div>
          <p className="text-white/70 text-xs mt-1 line-clamp-2">{notification.message}</p>
          
          {/* AI Insight Preview */}
          {notification.aiInsightPreview && (
            <p className="text-purple-300/80 text-xs mt-2 line-clamp-2 italic">
              ✨ {notification.aiInsightPreview}
            </p>
          )}
          
          {/* View AI Insight Button */}
          {notification.hasAIInsight && notification.gameId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewInsight?.();
              }}
              className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500/20 to-purple-500/20 border border-purple-500/30 hover:from-orange-500/30 hover:to-purple-500/30 transition-all text-xs text-purple-300"
            >
              <Sparkles className="w-3 h-3" />
              View Full AI Insight
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// AI INSIGHT QUEUE - Prevents burst requests
// ============================================
const aiRequestQueue: Array<{
  gameId: string;
  type: 'halftime' | 'final';
  options?: { homeTeamAbbr?: string; awayTeamAbbr?: string; gameDate?: string };
  resolve: (value: string | null) => void;
}> = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 3000; // 3 seconds between requests to avoid rate limits
let totalRequestsThisSession = 0;

async function processAIQueue() {
  if (isProcessingQueue || aiRequestQueue.length === 0) return;
  isProcessingQueue = true;

  while (aiRequestQueue.length > 0) {
    const request = aiRequestQueue.shift();
    if (!request) break;

    // Enforce minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
    }

    try {
      totalRequestsThisSession++;
      console.log(`[AI Queue] Processing request #${totalRequestsThisSession}: ${request.gameId} (${request.type})`);
      
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: request.gameId,
          type: request.type,
          homeTeamAbbr: request.options?.homeTeamAbbr,
          awayTeamAbbr: request.options?.awayTeamAbbr,
          gameDate: request.options?.gameDate,
        }),
      });

      lastRequestTime = Date.now();

      if (!response.ok) {
        // Check for rate limit
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
          console.warn(`[AI Queue] Rate limited, waiting ${waitTime}ms`);
          await new Promise(r => setTimeout(r, waitTime));
        }
        request.resolve(null);
        continue;
      }

      const data = await response.json();
      request.resolve(data.success ? data.data.summary : null);
    } catch (error) {
      console.error('[AI Queue] Request failed:', error);
      request.resolve(null);
    }
  }

  isProcessingQueue = false;
}

// Fetch AI insight for a game (queued to prevent bursts)
async function fetchAIInsight(
  gameId: string,
  type: 'halftime' | 'final',
  options?: {
    homeTeamAbbr?: string;
    awayTeamAbbr?: string;
    gameDate?: string;
  }
): Promise<string | null> {
  return new Promise((resolve) => {
    // Check if this game is already in the queue
    const existingRequest = aiRequestQueue.find(r => r.gameId === gameId && r.type === type);
    if (existingRequest) {
      console.log(`[AI Queue] Skipping duplicate request for ${gameId} (${type})`);
      resolve(null);
      return;
    }

    console.log(`[AI Queue] Queueing request for ${gameId} (${type}), queue size: ${aiRequestQueue.length + 1}`);
    aiRequestQueue.push({ gameId, type, options, resolve });
    processAIQueue();
  });
}

// Truncate text for preview
function truncateForPreview(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // AI Insight Modal state
  const [insightModal, setInsightModal] = useState<{
    isOpen: boolean;
    gameId: string;
    gameStatus: string;
    homeTeam: string;
    awayTeam: string;
    homeScore?: number;
    awayScore?: number;
    gameDate?: string;
  } | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const playSound = useCallback((type: Notification['type']) => {
    if (!soundEnabled) return;
    
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      const frequencies: Record<Notification['type'], number> = {
        score: 880,
        highlight: 660,
        alert: 440,
        info: 550,
      };
      
      const frequency = frequencies[type];
      if (frequency && isFinite(frequency)) {
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
      }
    } catch (e) {
      // Ignore audio errors (e.g., browser autoplay restrictions)
      console.warn('Audio playback failed:', e);
    }
  }, [soundEnabled]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
    setToasts(prev => [newNotification, ...prev].slice(0, 3));
    
    if (notification.sound !== false) {
      playSound(notification.type);
    }
  }, [playSound]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setToasts(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setToasts([]);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(n => n.id !== id));
  }, []);

  // Open AI insight modal for a notification
  const openInsightModal = useCallback((notification: Notification) => {
    if (notification.gameId) {
      setInsightModal({
        isOpen: true,
        gameId: notification.gameId,
        gameStatus: notification.gameStatus || 'FINAL',
        homeTeam: notification.homeTeam || '',
        awayTeam: notification.awayTeam || '',
        homeScore: notification.homeScore,
        awayScore: notification.awayScore,
        gameDate: notification.gameDate,
      });
    }
  }, []);

  // Monitor for live game updates with AI-enhanced notifications
  // LAZY LOADING: Only fetch AI insights when a game TRANSITIONS to final/halftime
  // NOT when page loads and games are already in that state
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let isFirstPoll = true; // Track first poll to skip already-finished games
    
    const gameStates = new Map<string, { 
      lastStatus: string;
      lastScore: { home: number; away: number };
      notifiedFinal: boolean;
      notifiedHalftime: boolean;
      notifiedCloseGame: boolean;
      fetchingAI: boolean;
    }>();

    const checkForGameUpdates = async () => {
      try {
        const response = await fetch('/api/live/nba');
        if (!response.ok) return;
        
        const data = await response.json();
        const games = data.games || [];

        for (const game of games) {
          const prevState = gameStates.get(game.gameId);
          const state = prevState || {
            lastStatus: game.status, // Initialize with current status
            lastScore: { home: game.homeTeam.score || 0, away: game.awayTeam.score || 0 },
            notifiedFinal: false,
            notifiedHalftime: false,
            notifiedCloseGame: false,
            fetchingAI: false,
          };

          // LAZY LOADING: Skip notifications on first poll if game is already final/halftime
          // This prevents burst API calls when page loads with many finished games
          if (isFirstPoll) {
            if (game.status === 'final') {
              state.notifiedFinal = true; // Mark as already notified
            }
            if (game.status === 'halftime') {
              state.notifiedHalftime = true;
            }
            gameStates.set(game.gameId, state);
            continue;
          }

          // Only trigger notifications when status CHANGES (not on first load)
          const statusChanged = prevState && prevState.lastStatus !== game.status;

          // Check for halftime with AI insight (only on status change)
          if (game.status === 'halftime' && statusChanged && !state.notifiedHalftime && !state.fetchingAI) {
            state.notifiedHalftime = true;
            state.fetchingAI = true;
            gameStates.set(game.gameId, state);

            // Fetch AI insight in the background
            fetchAIInsight(game.gameId, 'halftime', {
              homeTeamAbbr: game.homeTeam.abbreviation,
              awayTeamAbbr: game.awayTeam.abbreviation,
              gameDate: game.gameDate,
            }).then((aiInsight) => {
              state.fetchingAI = false;
              
              addNotification({
                type: 'info',
                title: `⏸️ Halftime: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
                message: `Score: ${game.awayTeam.score} - ${game.homeTeam.score}`,
                sport: 'NBA',
                gameId: game.gameId,
                gameStatus: 'HALFTIME',
                homeTeam: game.homeTeam.abbreviation,
                awayTeam: game.awayTeam.abbreviation,
                homeScore: game.homeTeam.score,
                awayScore: game.awayTeam.score,
                gameDate: game.gameDate,
                hasAIInsight: !!aiInsight,
                aiInsightPreview: aiInsight ? truncateForPreview(aiInsight) : undefined,
              });
            });
          }

          // Check for final with AI insight (only on status change)
          if (game.status === 'final' && statusChanged && !state.notifiedFinal && !state.fetchingAI) {
            state.notifiedFinal = true;
            state.fetchingAI = true;
            gameStates.set(game.gameId, state);

            const winner = game.homeTeam.score > game.awayTeam.score ? game.homeTeam : game.awayTeam;

            // Fetch AI insight in the background
            fetchAIInsight(game.gameId, 'final', {
              homeTeamAbbr: game.homeTeam.abbreviation,
              awayTeamAbbr: game.awayTeam.abbreviation,
              gameDate: game.gameDate,
            }).then((aiInsight) => {
              state.fetchingAI = false;
              
              addNotification({
                type: 'score',
                title: `🏆 ${winner.abbreviation} wins!`,
                message: `Final: ${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.abbreviation} ${game.homeTeam.score}`,
                sport: 'NBA',
                gameId: game.gameId,
                gameStatus: 'FINAL',
                homeTeam: game.homeTeam.abbreviation,
                awayTeam: game.awayTeam.abbreviation,
                homeScore: game.homeTeam.score,
                awayScore: game.awayTeam.score,
                gameDate: game.gameDate,
                hasAIInsight: !!aiInsight,
                aiInsightPreview: aiInsight ? truncateForPreview(aiInsight) : undefined,
              });
            });
          }

          // Check for close game in 4th quarter
          if (game.status === 'live' && game.period === 4 && !state.notifiedCloseGame) {
            const scoreDiff = Math.abs(game.homeTeam.score - game.awayTeam.score);
            if (scoreDiff <= 5) {
              addNotification({
                type: 'alert',
                title: `🔥 Close game!`,
                message: `${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.abbreviation} ${game.homeTeam.score} with ${game.clock} left!`,
                sport: 'NBA',
                gameId: game.gameId,
                gameStatus: 'LIVE',
                homeTeam: game.homeTeam.abbreviation,
                awayTeam: game.awayTeam.abbreviation,
                homeScore: game.homeTeam.score,
                awayScore: game.awayTeam.score,
                gameDate: game.gameDate,
                hasAIInsight: true, // Can view live insights on-demand
              });
              state.notifiedCloseGame = true;
            }
          }

          // Update state
          state.lastStatus = game.status;
          state.lastScore = { home: game.homeTeam.score, away: game.awayTeam.score };
          gameStates.set(game.gameId, state);
        }
        
        isFirstPoll = false; // After first poll, start tracking status changes
      } catch (error) {
        console.error('Failed to check for game updates:', error);
      }
    };

    // Start polling after a delay
    const startPolling = setTimeout(() => {
      checkForGameUpdates();
      intervalId = setInterval(checkForGameUpdates, 60000); // Poll every minute
    }, 5000);

    return () => {
      clearTimeout(startPolling);
      clearInterval(intervalId);
    };
  }, [addNotification]);

  // Welcome notification
  useEffect(() => {
    const timer = setTimeout(() => {
      addNotification({
        type: 'info',
        title: 'Welcome to SportSense!',
        message: 'Your AI sports companion is ready. You\'ll get AI-powered insights at halftime and game end!',
        sport: 'ALL',
        sound: false,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        soundEnabled,
        toggleSound,
      }}
    >
      {children}
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {toasts.map((toast) => (
          <NotificationToast
            key={toast.id}
            notification={toast}
            onClose={() => removeToast(toast.id)}
            onViewInsight={() => openInsightModal(toast)}
          />
        ))}
      </div>

      {/* AI Insight Modal */}
      {insightModal && (
        <AIInsightModal
          isOpen={insightModal.isOpen}
          onClose={() => setInsightModal(null)}
          gameId={insightModal.gameId}
          gameStatus={insightModal.gameStatus}
          homeTeam={insightModal.homeTeam}
          awayTeam={insightModal.awayTeam}
          homeScore={insightModal.homeScore}
          awayScore={insightModal.awayScore}
          gameDate={insightModal.gameDate}
        />
      )}
    </NotificationContext.Provider>
  );
}
