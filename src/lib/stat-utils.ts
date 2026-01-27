/**
 * stat-utils.ts
 * Pure utility functions for NBA stat calculations and formatting.
 * CRITICAL: All percentage calculations must be accurate (no hallucination).
 */

/**
 * Calculate shooting percentage from made/attempted
 * Returns percentage as a number (e.g., 33.3 for 33.3%)
 * Guard against divide-by-zero, returns 0 if no attempts
 */
export function calculateShootingPct(made: number, attempted: number): number {
  if (!attempted || attempted === 0) return 0;
  if (made < 0 || attempted < 0) return 0;
  if (made > attempted) return 100; // Cap at 100% if data is malformed
  const pct = (made / attempted) * 100;
  return Math.round(pct * 10) / 10; // Round to 1 decimal
}

/**
 * Format shooting stats as "M-A (PCT%)"
 * Example: "3-7 (42.9%)"
 */
export function formatShootingLine(made: number, attempted: number): string {
  const pct = calculateShootingPct(made, attempted);
  if (attempted === 0) {
    return '0-0 (—)';
  }
  return `${made}-${attempted} (${pct.toFixed(1)}%)`;
}

/**
 * Format percentage for display
 * Handles edge cases: undefined, NaN, negative values
 */
export function formatPercentage(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '—';
  }
  // Clamp between 0 and 100
  const clamped = Math.max(0, Math.min(100, value));
  return `${clamped.toFixed(1)}%`;
}

/**
 * Validate and clamp a stat value to reasonable NBA ranges
 * Returns the value if valid, or a fallback
 */
export function validateStat(
  value: number | undefined | null,
  min: number = 0,
  max: number = 100,
  fallback: string = '—'
): string | number {
  if (value === undefined || value === null || isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Format minutes played (handles various formats)
 * Input could be "32:15", "32", or a number
 */
export function formatMinutes(value: string | number | undefined): string {
  if (!value) return '—';
  if (typeof value === 'number') {
    return value.toString();
  }
  // Already formatted as MM:SS
  if (value.includes(':')) {
    return value;
  }
  return value;
}

/**
 * Parse shooting stats from ESPN format "M-A" to {made, attempted}
 * Example: "3-7" -> {made: 3, attempted: 7}
 */
export function parseShootingStats(value: string | undefined): { made: number; attempted: number } {
  if (!value || value === '--' || value === '-') {
    return { made: 0, attempted: 0 };
  }
  const parts = value.split('-');
  if (parts.length !== 2) {
    return { made: 0, attempted: 0 };
  }
  const made = parseInt(parts[0]) || 0;
  const attempted = parseInt(parts[1]) || 0;
  return { made: Math.max(0, made), attempted: Math.max(0, attempted) };
}

/**
 * Get top N players by a stat from a player array
 * Sorts descending by the specified stat
 */
export interface PlayerStatLine {
  playerId?: string;
  name: string;
  team: string;
  headshot?: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fg3m: number;
  fg3a: number;
  fgm: number;
  fga: number;
  plusMinus: string;
}

export function getTopPlayersByStat(
  players: PlayerStatLine[],
  stat: keyof Pick<PlayerStatLine, 'points' | 'rebounds' | 'assists'>,
  limit: number = 3
): PlayerStatLine[] {
  return [...players]
    .filter(p => p.minutes !== '0' && p.minutes !== '--' && p.minutes !== '0:00')
    .sort((a, b) => (b[stat] as number) - (a[stat] as number))
    .slice(0, limit);
}

/**
 * Format a player stat line for display
 * Returns a formatted object with all derived stats
 */
export interface FormattedPlayerStats {
  name: string;
  headshot: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  fg3Made: number;
  fg3Attempted: number;
  fg3Pct: string; // Formatted as "33.3%"
  fgMade: number;
  fgAttempted: number;
  fgPct: string;
  plusMinus: string;
}

export function formatPlayerStatsForDisplay(player: PlayerStatLine): FormattedPlayerStats {
  const fg3Pct = calculateShootingPct(player.fg3m, player.fg3a);
  const fgPct = calculateShootingPct(player.fgm, player.fga);
  
  return {
    name: player.name,
    headshot: player.headshot || `https://a.espncdn.com/i/headshots/nba/players/full/0.png`,
    minutes: formatMinutes(player.minutes),
    points: Math.max(0, player.points),
    rebounds: Math.max(0, player.rebounds),
    assists: Math.max(0, player.assists),
    fg3Made: Math.max(0, player.fg3m),
    fg3Attempted: Math.max(0, player.fg3a),
    fg3Pct: formatPercentage(fg3Pct),
    fgMade: Math.max(0, player.fgm),
    fgAttempted: Math.max(0, player.fga),
    fgPct: formatPercentage(fgPct),
    plusMinus: player.plusMinus || '—',
  };
}

/**
 * Type for top player comparison data (used in side-by-side view)
 */
export interface TopPlayerComparisonData {
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo: string;
    topPlayers: FormattedPlayerStats[];
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo: string;
    topPlayers: FormattedPlayerStats[];
  };
  status: string;
}
