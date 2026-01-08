'use client';

// Live Game Header - Shows score with real-time updates
// Updates independently from the rest of the page

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import type { ESPNTeam } from '@/services/nba/espn-api';

interface LiveGameHeaderProps {
  gameId: string;
  initialHomeScore: number;
  initialAwayScore: number;
  initialStatus: 'scheduled' | 'live' | 'halftime' | 'final';
  initialPeriod: number;
  initialClock: string;
  homeTeam: ESPNTeam;
  awayTeam: ESPNTeam;
  venue?: string;
  broadcast?: string;
  date: string;
}

export function LiveGameHeader({
  gameId,
  initialHomeScore,
  initialAwayScore,
  initialStatus,
  initialPeriod,
  initialClock,
  homeTeam,
  awayTeam,
  venue,
  broadcast,
  date,
}: LiveGameHeaderProps) {
  const [homeScore, setHomeScore] = useState(initialHomeScore);
  const [awayScore, setAwayScore] = useState(initialAwayScore);
  const [status, setStatus] = useState(initialStatus);
  const [period, setPeriod] = useState(initialPeriod);
  const [clock, setClock] = useState(initialClock);
  const [homeScoreAnimating, setHomeScoreAnimating] = useState(false);
  const [awayScoreAnimating, setAwayScoreAnimating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Connect to SSE for real-time updates
  useEffect(() => {
    if (status === 'final' || status === 'scheduled') return;

    let eventSource: EventSource | null = null;
    
    const connect = () => {
      eventSource = new EventSource('/api/live/nba/stream');
      
      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('[LiveGameHeader] Connected to SSE');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'update' && data.games) {
            // Find our game in the update
            const gameUpdate = data.games.find((g: any) => g.gameId === gameId);
            
            if (gameUpdate) {
              // Update scores with animation
              if (gameUpdate.homeTeam.score !== homeScore) {
                if (gameUpdate.homeTeam.score > homeScore) {
                  setHomeScoreAnimating(true);
                  setTimeout(() => setHomeScoreAnimating(false), 1000);
                }
                setHomeScore(gameUpdate.homeTeam.score);
              }
              
              if (gameUpdate.awayTeam.score !== awayScore) {
                if (gameUpdate.awayTeam.score > awayScore) {
                  setAwayScoreAnimating(true);
                  setTimeout(() => setAwayScoreAnimating(false), 1000);
                }
                setAwayScore(gameUpdate.awayTeam.score);
              }
              
              // Update status
              setStatus(gameUpdate.status);
              setPeriod(gameUpdate.period);
              setClock(gameUpdate.clock);
            }
          }
        } catch (err) {
          console.error('[LiveGameHeader] Error parsing SSE:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, [gameId, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLive = status === 'live' || status === 'halftime';
  const isFinal = status === 'final';

  const getStatusBadge = () => {
    if (status === 'live') {
      return (
        <span className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-sm font-semibold flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Q{period} {clock}
          {isConnected && <span className="text-[10px] text-green-400 ml-1">● LIVE</span>}
        </span>
      );
    }
    
    if (status === 'halftime') {
      return (
        <span className="px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-semibold">
          HALFTIME
        </span>
      );
    }
    
    if (status === 'final') {
      return (
        <span className="px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-sm font-semibold">
          FINAL
        </span>
      );
    }
    
    return (
      <span className="px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-sm font-semibold">
        {new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </span>
    );
  };

  return (
    <div className="glass rounded-2xl p-8 mb-8 relative overflow-hidden">
      {/* Gradient overlay based on team colors */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(135deg, #${awayTeam.color || '333'} 0%, transparent 50%, #${homeTeam.color || '333'} 100%)`,
        }}
      />
      
      {/* Pulse animation for live games */}
      {isLive && (
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      
      <div className="relative z-10">
        {/* Status Badge */}
        <div className="flex justify-center mb-6">
          {getStatusBadge()}
        </div>

        {/* Teams and Score */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
          {/* Away Team */}
          <div className="text-center space-y-3">
            <Link 
              href={`/nba/teams/${awayTeam.id}`}
              className="block hover:scale-105 transition-transform"
            >
              <div className="w-28 h-28 mx-auto rounded-2xl flex items-center justify-center bg-white/5 backdrop-blur-sm">
                <Image
                  src={awayTeam.logo}
                  alt={awayTeam.displayName}
                  width={100}
                  height={100}
                  className="object-contain"
                  unoptimized
                />
              </div>
            </Link>
            <div>
              <p className="text-sm text-white/50">{awayTeam.name}</p>
              <p className="text-xl font-bold text-white">{awayTeam.displayName}</p>
              {awayTeam.record && (
                <p className="text-sm text-white/40">{awayTeam.record}</p>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="text-center">
            <div className="flex items-center gap-4 md:gap-8">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`away-${awayScore}`}
                  initial={awayScoreAnimating ? { scale: 1.3, color: '#22c55e' } : false}
                  animate={{ scale: 1, color: isFinal && awayScore > homeScore ? '#ffffff' : 'rgba(255,255,255,0.7)' }}
                  className={`text-6xl md:text-7xl font-bold tabular-nums ${
                    isFinal && awayScore > homeScore ? 'text-white' : 'text-white/70'
                  }`}
                >
                  {awayScore}
                </motion.span>
              </AnimatePresence>
              <span className="text-3xl text-white/30">-</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={`home-${homeScore}`}
                  initial={homeScoreAnimating ? { scale: 1.3, color: '#22c55e' } : false}
                  animate={{ scale: 1, color: isFinal && homeScore > awayScore ? '#ffffff' : 'rgba(255,255,255,0.7)' }}
                  className={`text-6xl md:text-7xl font-bold tabular-nums ${
                    isFinal && homeScore > awayScore ? 'text-white' : 'text-white/70'
                  }`}
                >
                  {homeScore}
                </motion.span>
              </AnimatePresence>
            </div>
            
            {venue && (
              <p className="text-sm text-white/40 mt-4">{venue}</p>
            )}
            {broadcast && (
              <p className="text-xs text-white/30 mt-1">📺 {broadcast}</p>
            )}
          </div>

          {/* Home Team */}
          <div className="text-center space-y-3">
            <Link 
              href={`/nba/teams/${homeTeam.id}`}
              className="block hover:scale-105 transition-transform"
            >
              <div className="w-28 h-28 mx-auto rounded-2xl flex items-center justify-center bg-white/5 backdrop-blur-sm">
                <Image
                  src={homeTeam.logo}
                  alt={homeTeam.displayName}
                  width={100}
                  height={100}
                  className="object-contain"
                  unoptimized
                />
              </div>
            </Link>
            <div>
              <p className="text-sm text-white/50">{homeTeam.name}</p>
              <p className="text-xl font-bold text-white">{homeTeam.displayName}</p>
              {homeTeam.record && (
                <p className="text-sm text-white/40">{homeTeam.record}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}





