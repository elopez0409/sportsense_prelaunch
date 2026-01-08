'use client';

// Play-by-Play feed component

import { Badge } from '@/components/ui/badge';
import { formatGameClock } from '@/lib/utils';
import type { PlayInfo } from '@/types/nba';

interface PlayByPlayProps {
  plays: PlayInfo[];
  homeAbbrev: string;
  awayAbbrev: string;
}

export function PlayByPlay({ plays, homeAbbrev, awayAbbrev }: PlayByPlayProps) {
  if (plays.length === 0) {
    return (
      <div className="text-center py-8 text-white/50">
        No plays available yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {plays.map((play) => (
        <PlayItem
          key={play.id}
          play={play}
          homeAbbrev={homeAbbrev}
          awayAbbrev={awayAbbrev}
        />
      ))}
    </div>
  );
}

interface PlayItemProps {
  play: PlayInfo;
  homeAbbrev: string;
  awayAbbrev: string;
}

function PlayItem({ play, homeAbbrev, awayAbbrev }: PlayItemProps) {
  const isScoringPlay = play.scoreChange > 0;
  
  return (
    <div
      className={`p-3 rounded-lg transition-colors ${
        play.isBigPlay
          ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30'
          : play.isClutch
          ? 'bg-yellow-500/10 border border-yellow-500/30'
          : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="text-xs text-white/50 w-16 flex-shrink-0">
          {formatGameClock(play.period, play.gameClock)}
        </div>

        {/* Play content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Badges */}
            {play.isBigPlay && (
              <Badge variant="warning" className="text-[10px]">
                🔥 BIG PLAY
              </Badge>
            )}
            {play.isClutch && (
              <Badge variant="warning" className="text-[10px]">
                ⚡ CLUTCH
              </Badge>
            )}
            {isScoringPlay && (
              <Badge
                variant={play.scoreChange === 3 ? 'success' : 'default'}
                className="text-[10px]"
              >
                +{play.scoreChange}
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-white/90 mt-1">{play.description}</p>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-white/50">
            {awayAbbrev} {play.awayScore}
          </p>
          <p className="text-xs text-white/50">
            {homeAbbrev} {play.homeScore}
          </p>
        </div>
      </div>
    </div>
  );
}





