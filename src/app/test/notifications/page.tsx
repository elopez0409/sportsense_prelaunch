'use client';

// Test Page for Notification Features
// Simulates halftime, game end, and close game notifications

import { useState } from 'react';
import { 
  Clock, Trophy, Flame, Trash2, Bell, Sparkles, 
  CheckCircle, AlertCircle, ToggleLeft, ToggleRight,
  Zap, RefreshCw
} from 'lucide-react';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { 
  generateRandomGame, 
  generateCloseGame, 
  mockAIInsights, 
  truncateForPreview,
  type MockGame 
} from '@/lib/test-utils';

export default function NotificationTestPage() {
  const { notifications, addNotification, clearAll } = useNotifications();
  const [includeAI, setIncludeAI] = useState(true);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [lastGame, setLastGame] = useState<MockGame | null>(null);

  // Add to test log
  const log = (message: string) => {
    setTestLog(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 20));
  };

  // Simulate Halftime Notification
  const simulateHalftime = () => {
    const game = generateRandomGame('halftime');
    setLastGame(game);
    
    log(`Simulating halftime: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
    
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
      hasAIInsight: includeAI,
      aiInsightPreview: includeAI ? truncateForPreview(mockAIInsights.halftime) : undefined,
    });

    log('✅ Halftime notification triggered');
  };

  // Simulate Game End Notification
  const simulateGameEnd = () => {
    const game = generateRandomGame('final');
    setLastGame(game);
    
    const winner = game.homeTeam.score > game.awayTeam.score 
      ? game.homeTeam 
      : game.awayTeam;
    
    log(`Simulating game end: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
    
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
      hasAIInsight: includeAI,
      aiInsightPreview: includeAI ? truncateForPreview(mockAIInsights.final) : undefined,
    });

    log(`✅ Game end notification triggered - ${winner.abbreviation} wins!`);
  };

  // Simulate Close Game Alert
  const simulateCloseGame = () => {
    const game = generateCloseGame();
    setLastGame(game);
    
    const scoreDiff = Math.abs(game.homeTeam.score - game.awayTeam.score);
    
    log(`Simulating close game: ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation} (${scoreDiff} pt diff)`);
    
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
      hasAIInsight: includeAI,
    });

    log('✅ Close game alert triggered');
  };

  // Clear everything
  const handleClearAll = () => {
    clearAll();
    setTestLog([]);
    setLastGame(null);
    log('🗑️ All notifications cleared');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
            <Bell className="w-8 h-8 text-orange-400" />
            Notification Test Page
          </h1>
          <p className="text-white/60">
            Test halftime, game end, and close game notifications
          </p>
        </div>

        {/* AI Toggle */}
        <div className="glass-dark rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-white font-medium">Include AI Insights</p>
              <p className="text-white/50 text-sm">Add AI-generated preview to notifications</p>
            </div>
          </div>
          <button
            onClick={() => setIncludeAI(!includeAI)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {includeAI ? (
              <ToggleRight className="w-8 h-8 text-green-400" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-white/40" />
            )}
          </button>
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Halftime Button */}
          <button
            onClick={simulateHalftime}
            className="glass-dark rounded-xl p-6 hover:border-blue-500/50 border border-transparent transition-all group"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 group-hover:scale-110 transition-transform">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-bold text-lg">Simulate Halftime</h3>
              <p className="text-white/50 text-sm text-center">
                Triggers halftime notification with score update
              </p>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs">
                info type
              </span>
            </div>
          </button>

          {/* Game End Button */}
          <button
            onClick={simulateGameEnd}
            className="glass-dark rounded-xl p-6 hover:border-green-500/50 border border-transparent transition-all group"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 group-hover:scale-110 transition-transform">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-bold text-lg">Simulate Game End</h3>
              <p className="text-white/50 text-sm text-center">
                Triggers final score notification with winner
              </p>
              <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-xs">
                score type
              </span>
            </div>
          </button>

          {/* Close Game Button */}
          <button
            onClick={simulateCloseGame}
            className="glass-dark rounded-xl p-6 hover:border-orange-500/50 border border-transparent transition-all group"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-gradient-to-br from-orange-500 to-red-600 group-hover:scale-110 transition-transform">
                <Flame className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-bold text-lg">Simulate Close Game</h3>
              <p className="text-white/50 text-sm text-center">
                Triggers 4th quarter close game alert
              </p>
              <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs">
                alert type
              </span>
            </div>
          </button>
        </div>

        {/* Clear All Button */}
        <div className="flex justify-center">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Clear All Notifications
          </button>
        </div>

        {/* Last Generated Game */}
        {lastGame && (
          <div className="glass-dark rounded-xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Last Generated Game
            </h3>
            <div className="bg-white/5 rounded-lg p-4 font-mono text-sm">
              <pre className="text-white/80 overflow-x-auto">
                {JSON.stringify(lastGame, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="glass-dark rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-400" />
              Notification History ({notifications.length})
            </h3>
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Refresh page"
            >
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
          </div>
          
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No notifications yet. Click a button above to test!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-lg border ${
                    notif.type === 'score' 
                      ? 'bg-green-500/10 border-green-500/20' 
                      : notif.type === 'alert'
                      ? 'bg-orange-500/10 border-orange-500/20'
                      : 'bg-blue-500/10 border-blue-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {notif.type === 'score' && <Trophy className="w-4 h-4 text-green-400" />}
                        {notif.type === 'alert' && <AlertCircle className="w-4 h-4 text-orange-400" />}
                        {notif.type === 'info' && <Bell className="w-4 h-4 text-blue-400" />}
                        <span className="text-white font-medium text-sm">{notif.title}</span>
                      </div>
                      <p className="text-white/60 text-xs">{notif.message}</p>
                      {notif.aiInsightPreview && (
                        <p className="text-purple-300/80 text-xs mt-2 italic">
                          ✨ {notif.aiInsightPreview}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-white/40">
                        {notif.timestamp.toLocaleTimeString()}
                      </span>
                      {notif.hasAIInsight && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                          AI
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Log */}
        <div className="glass-dark rounded-xl p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Test Log
          </h3>
          {testLog.length === 0 ? (
            <p className="text-white/40 text-sm">No actions yet...</p>
          ) : (
            <div className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
              {testLog.map((entry, i) => (
                <div key={i} className="text-white/70">
                  {entry}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Checklist */}
        <div className="glass-dark rounded-xl p-6">
          <h3 className="text-white font-bold mb-4">Test Checklist</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              'Halftime notification appears with score',
              'Halftime notification shows AI preview (when enabled)',
              'Game end notification shows winner',
              'Game end notification includes AI recap preview',
              '"View Full AI Insight" button appears on toast',
              'Close game alert shows remaining time',
              'Notifications appear in history list',
              'Clear All removes all notifications',
            ].map((item, i) => (
              <label key={i} className="flex items-center gap-2 text-white/70 cursor-pointer hover:text-white">
                <input type="checkbox" className="rounded" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


