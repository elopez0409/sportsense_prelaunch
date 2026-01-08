'use client';

import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { AIInsightModal } from '@/components/ai/AIInsightModal';

interface TeamData {
  name: string;
  abbreviation: string;
  record?: string;
  score: number;
}

export interface LiveGameData {
  gameId: string;
  gameDate?: string;
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  period: number;
  clock: string;
  homeTeam: TeamData;
  awayTeam: TeamData;
  venue?: string;
  broadcast?: string;
  leaders?: {
    home: { points?: string; rebounds?: string; assists?: string };
    away: { points?: string; rebounds?: string; assists?: string };
  };
}

interface LiveGameCardProps {
  game: LiveGameData;
  onScoreUpdate?: (team: 'home' | 'away', newScore: number, oldScore: number) => void;
}

// Basketball animation component
function BasketballAnimation({ show, side }: { show: boolean; side: 'left' | 'right' }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, y: -50, opacity: 0 }}
          animate={{ 
            scale: [0, 1.2, 1],
            y: [-50, 0, -20, 0],
            opacity: [0, 1, 1, 0],
            rotate: [0, 360, 720]
          }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={`absolute ${side === 'left' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-3xl z-20 pointer-events-none`}
        >
          🏀
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Score display with animation
function AnimatedScore({ 
  score, 
  isWinning, 
  isFinal,
  showAnimation 
}: { 
  score: number; 
  isWinning: boolean; 
  isFinal: boolean;
  showAnimation: boolean;
}) {
  return (
    <motion.span
      key={score}
      initial={showAnimation ? { scale: 1.5, color: '#22c55e' } : false}
      animate={{ scale: 1, color: isWinning ? '#ffffff' : 'rgba(255,255,255,0.6)' }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
      className={`text-2xl font-bold tabular-nums ${
        isFinal && isWinning ? 'text-white' : 'text-white/80'
      }`}
    >
      {score}
    </motion.span>
  );
}

// Live game clock that ticks
function LiveClock({ 
  initialClock, 
  period, 
  isPaused, 
  status 
}: { 
  initialClock: string; 
  period: number; 
  isPaused: boolean;
  status: string;
}) {
  const [displayClock, setDisplayClock] = useState(initialClock);
  const [clockSeconds, setClockSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Parse clock string to seconds
  const parseClockToSeconds = useCallback((clockStr: string): number => {
    if (!clockStr || clockStr === '0:00' || clockStr === 'END') return 0;
    
    const parts = clockStr.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return minutes * 60 + seconds;
    }
    return parseFloat(clockStr) || 0;
  }, []);

  // Format seconds back to clock string
  const formatSecondsToClockStr = useCallback((totalSeconds: number): string => {
    if (totalSeconds <= 0) return '0:00';
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (seconds < 10) {
      return `${minutes}:0${seconds.toFixed(seconds < 1 ? 1 : 0)}`;
    }
    return `${minutes}:${seconds.toFixed(seconds < 10 ? 1 : 0)}`;
  }, []);

  // Update when external clock changes
  useEffect(() => {
    const newSeconds = parseClockToSeconds(initialClock);
    setClockSeconds(newSeconds);
    setDisplayClock(initialClock);
  }, [initialClock, parseClockToSeconds]);

  // Tick the clock when game is live and not paused
  useEffect(() => {
    if (status !== 'live' || isPaused || clockSeconds <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setClockSeconds(prev => {
        const newSeconds = Math.max(0, prev - 1);
        setDisplayClock(formatSecondsToClockStr(newSeconds));
        return newSeconds;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, isPaused, clockSeconds, formatSecondsToClockStr]);

  if (status === 'halftime') {
    return (
      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs font-medium">
        HALFTIME
      </span>
    );
  }

  if (status === 'final') {
    return (
      <span className="bg-white/10 text-white/60 px-2 py-1 rounded-full text-xs font-medium">
        FINAL
      </span>
    );
  }

  if (status === 'scheduled') {
    return (
      <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium">
        {initialClock || 'Scheduled'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
      </span>
      <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-xs font-medium tabular-nums">
        Q{period} {displayClock}
      </span>
    </div>
  );
}

// Ripple effect component
function ScoreRipple({ show, color }: { show: boolean; color: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 3, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0 rounded-xl pointer-events-none z-10"
          style={{ backgroundColor: color }}
        />
      )}
    </AnimatePresence>
  );
}

export function LiveGameCard({ game, onScoreUpdate }: LiveGameCardProps) {
  const [homeScore, setHomeScore] = useState(game.homeTeam.score);
  const [awayScore, setAwayScore] = useState(game.awayTeam.score);
  const [homeScoreAnim, setHomeScoreAnim] = useState(false);
  const [awayScoreAnim, setAwayScoreAnim] = useState(false);
  const [homeBball, setHomeBball] = useState(false);
  const [awayBball, setAwayBball] = useState(false);
  const [homeRipple, setHomeRipple] = useState(false);
  const [awayRipple, setAwayRipple] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showInsightModal, setShowInsightModal] = useState(false);
  
  const isLive = game.status === 'live' || game.status === 'halftime';
  const isFinal = game.status === 'final';
  const showAIButton = isLive || isFinal;
  const aiStatus = game.status === 'live'
    ? 'LIVE'
    : game.status === 'halftime'
      ? 'HALFTIME'
      : game.status === 'final'
        ? 'FINAL'
        : 'SCHEDULED';

  // Detect score changes
  useEffect(() => {
    if (game.homeTeam.score !== homeScore) {
      const scoreDiff = game.homeTeam.score - homeScore;
      if (scoreDiff > 0 && homeScore > 0) {
        // Home team scored!
        setHomeScoreAnim(true);
        setHomeBball(true);
        setHomeRipple(true);
        onScoreUpdate?.('home', game.homeTeam.score, homeScore);
        
        setTimeout(() => setHomeScoreAnim(false), 500);
        setTimeout(() => setHomeBball(false), 1200);
        setTimeout(() => setHomeRipple(false), 800);
      }
      setHomeScore(game.homeTeam.score);
    }
  }, [game.homeTeam.score, homeScore, onScoreUpdate]);

  useEffect(() => {
    if (game.awayTeam.score !== awayScore) {
      const scoreDiff = game.awayTeam.score - awayScore;
      if (scoreDiff > 0 && awayScore > 0) {
        // Away team scored!
        setAwayScoreAnim(true);
        setAwayBball(true);
        setAwayRipple(true);
        onScoreUpdate?.('away', game.awayTeam.score, awayScore);
        
        setTimeout(() => setAwayScoreAnim(false), 500);
        setTimeout(() => setAwayBball(false), 1200);
        setTimeout(() => setAwayRipple(false), 800);
      }
      setAwayScore(game.awayTeam.score);
    }
  }, [game.awayTeam.score, awayScore, onScoreUpdate]);

  // Detect clock pause (when clock doesn't change for updates)
  useEffect(() => {
    if (game.clock === '0:00' || game.clock?.includes('END')) {
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  }, [game.clock]);

  const homeWinning = homeScore > awayScore;
  const awayWinning = awayScore > homeScore;

  const handleAIButtonClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowInsightModal(true);
  };

  return (
    <>
      <Link href={`/nba/games/${game.gameId}`}>
        <motion.div 
          className={`glass rounded-xl p-4 card-hover block transition-all hover:scale-[1.02] hover:shadow-xl relative overflow-hidden ${
            isLive ? 'ring-1 ring-red-500/30' : ''
          }`}
          whileHover={{ y: -2 }}
          layout
        >
        {/* Score ripple effects */}
        <ScoreRipple show={homeRipple} color="rgba(34, 197, 94, 0.2)" />
        <ScoreRipple show={awayRipple} color="rgba(34, 197, 94, 0.2)" />

        {/* Basketball animations */}
        <BasketballAnimation show={awayBball} side="left" />
        <BasketballAnimation show={homeBball} side="right" />

        {/* Glow effect for live games */}
        {isLive && (
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-orange-500/5 animate-pulse pointer-events-none" />
        )}

        {/* AI Insight Button - Only shown for LIVE, HALFTIME, or FINAL games */}
        {showAIButton && (
          <button
            onClick={handleAIButtonClick}
            className="absolute bottom-3 right-3 z-10 p-2 rounded-lg bg-gradient-to-br from-orange-500/30 to-purple-500/30 border border-orange-500/20 hover:from-orange-500/50 hover:to-purple-500/50 hover:border-orange-500/40 transition-all duration-300 hover:scale-110 shadow-lg shadow-orange-500/10"
            title={isFinal ? "View Game Recap" : "View Live Analysis"}
          >
            <Sparkles className="w-4 h-4 text-orange-300" />
          </button>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <LiveClock 
            initialClock={game.clock} 
            period={game.period} 
            isPaused={isPaused}
            status={game.status}
          />
          {game.broadcast && (
            <span className="text-xs text-white/40">{game.broadcast}</span>
          )}
        </div>

        {/* Away Team */}
        <motion.div 
          className={`flex items-center justify-between py-2 relative ${
            isFinal && awayWinning ? 'opacity-100' : isFinal ? 'opacity-60' : ''
          }`}
          animate={awayScoreAnim ? { x: [0, -5, 5, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <Image
              src={`https://a.espncdn.com/i/teamlogos/nba/500/${game.awayTeam.abbreviation.toLowerCase()}.png`}
              alt={game.awayTeam.name}
              width={40}
              height={40}
              className="object-contain"
              unoptimized
            />
            <div>
              <p className={`font-semibold ${awayWinning && isLive ? 'text-green-400' : 'text-white'}`}>
                {game.awayTeam.abbreviation}
              </p>
              <p className="text-xs text-white/40">{game.awayTeam.record}</p>
            </div>
          </div>
          <AnimatedScore 
            score={awayScore} 
            isWinning={awayWinning} 
            isFinal={isFinal}
            showAnimation={awayScoreAnim}
          />
        </motion.div>

        {/* Home Team */}
        <motion.div 
          className={`flex items-center justify-between py-2 relative ${
            isFinal && homeWinning ? 'opacity-100' : isFinal ? 'opacity-60' : ''
          }`}
          animate={homeScoreAnim ? { x: [0, -5, 5, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <Image
              src={`https://a.espncdn.com/i/teamlogos/nba/500/${game.homeTeam.abbreviation.toLowerCase()}.png`}
              alt={game.homeTeam.name}
              width={40}
              height={40}
              className="object-contain"
              unoptimized
            />
            <div>
              <p className={`font-semibold ${homeWinning && isLive ? 'text-green-400' : 'text-white'}`}>
                {game.homeTeam.abbreviation}
              </p>
              <p className="text-xs text-white/40">{game.homeTeam.record}</p>
            </div>
          </div>
          <AnimatedScore 
            score={homeScore} 
            isWinning={homeWinning} 
            isFinal={isFinal}
            showAnimation={homeScoreAnim}
          />
        </motion.div>

        {/* Venue */}
        {game.venue && (
          <p className="text-xs text-white/30 mt-2 text-center">{game.venue}</p>
        )}

        {/* Leaders for live games */}
        {isLive && game.leaders && (
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/50">
            {game.leaders.away.points && (
              <p>🏀 {game.leaders.away.points}</p>
            )}
            {game.leaders.home.points && (
              <p>🏀 {game.leaders.home.points}</p>
            )}
          </div>
        )}

        {/* View Details hint */}
        <div className="mt-3 pt-3 border-t border-white/10 text-center">
          <span className="text-xs text-white/40 hover:text-white/60 transition-colors">
            Click for full stats & analytics →
          </span>
        </div>
        </motion.div>
      </Link>

      <AIInsightModal
        isOpen={showInsightModal}
        onClose={() => setShowInsightModal(false)}
        gameId={game.gameId}
        gameStatus={aiStatus}
        homeTeam={game.homeTeam.abbreviation}
        awayTeam={game.awayTeam.abbreviation}
        homeScore={homeScore}
        awayScore={awayScore}
        gameDate={game.gameDate}
      />
    </>
  );
}

export default LiveGameCard;
