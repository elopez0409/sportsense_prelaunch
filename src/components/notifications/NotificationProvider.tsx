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

// Fetch AI insight for a game
async function fetchAIInsight(gameId: string, type: 'halftime' | 'final'): Promise<string | null> {
  try {
    const response = await fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, type }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success) return null;

    return data.data.summary;
  } catch {
    return null;
  }
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
      });
    }
  }, []);

  // Monitor for live game updates with AI-enhanced notifications
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const gameStates = new Map<string, { 
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
          const state = gameStates.get(game.gameId) || {
            lastScore: { home: 0, away: 0 },
            notifiedFinal: false,
            notifiedHalftime: false,
            notifiedCloseGame: false,
            fetchingAI: false,
          };

          // Check for halftime with AI insight
          if (game.status === 'halftime' && !state.notifiedHalftime && !state.fetchingAI) {
            state.notifiedHalftime = true;
            state.fetchingAI = true;
            gameStates.set(game.gameId, state);

            // Fetch AI insight in the background
            fetchAIInsight(game.gameId, 'halftime').then((aiInsight) => {
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
                hasAIInsight: !!aiInsight,
                aiInsightPreview: aiInsight ? truncateForPreview(aiInsight) : undefined,
              });
            });
          }

          // Check for final with AI insight
          if (game.status === 'final' && !state.notifiedFinal && !state.fetchingAI) {
            state.notifiedFinal = true;
            state.fetchingAI = true;
            gameStates.set(game.gameId, state);

            const winner = game.homeTeam.score > game.awayTeam.score ? game.homeTeam : game.awayTeam;

            // Fetch AI insight in the background
            fetchAIInsight(game.gameId, 'final').then((aiInsight) => {
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
                hasAIInsight: true, // Can view live insights
              });
              state.notifiedCloseGame = true;
            }
          }

          // Update state
          state.lastScore = { home: game.homeTeam.score, away: game.awayTeam.score };
          gameStates.set(game.gameId, state);
        }
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
        />
      )}
    </NotificationContext.Provider>
  );
}
