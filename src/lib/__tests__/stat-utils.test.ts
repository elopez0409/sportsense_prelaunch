/**
 * Unit tests for stat-utils.ts
 * Run with: npx jest src/lib/__tests__/stat-utils.test.ts
 */

import {
  calculateShootingPct,
  formatShootingLine,
  formatPercentage,
  validateStat,
  formatMinutes,
  parseShootingStats,
  formatPlayerStatsForDisplay,
  type PlayerStatLine,
} from '../stat-utils';

describe('calculateShootingPct', () => {
  it('calculates correct percentage', () => {
    expect(calculateShootingPct(1, 3)).toBe(33.3);
    expect(calculateShootingPct(3, 3)).toBe(100);
    expect(calculateShootingPct(0, 5)).toBe(0);
    expect(calculateShootingPct(5, 10)).toBe(50);
  });

  it('handles divide by zero', () => {
    expect(calculateShootingPct(0, 0)).toBe(0);
    expect(calculateShootingPct(5, 0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(calculateShootingPct(-1, 3)).toBe(0);
    expect(calculateShootingPct(1, -3)).toBe(0);
  });

  it('caps at 100% for malformed data', () => {
    expect(calculateShootingPct(5, 3)).toBe(100);
  });

  it('rounds to 1 decimal place', () => {
    expect(calculateShootingPct(1, 7)).toBe(14.3);
    expect(calculateShootingPct(2, 7)).toBe(28.6);
  });
});

describe('formatShootingLine', () => {
  it('formats correctly with percentage', () => {
    expect(formatShootingLine(1, 3)).toBe('1-3 (33.3%)');
    expect(formatShootingLine(5, 10)).toBe('5-10 (50.0%)');
  });

  it('handles no attempts', () => {
    expect(formatShootingLine(0, 0)).toBe('0-0 (—)');
  });
});

describe('formatPercentage', () => {
  it('formats valid percentages', () => {
    expect(formatPercentage(50)).toBe('50.0%');
    expect(formatPercentage(33.333)).toBe('33.3%');
  });

  it('handles undefined/null', () => {
    expect(formatPercentage(undefined)).toBe('—');
    expect(formatPercentage(null)).toBe('—');
  });

  it('clamps to 0-100', () => {
    expect(formatPercentage(-5)).toBe('0.0%');
    expect(formatPercentage(105)).toBe('100.0%');
  });
});

describe('validateStat', () => {
  it('returns valid stats', () => {
    expect(validateStat(25)).toBe(25);
    expect(validateStat(0)).toBe(0);
  });

  it('returns fallback for invalid', () => {
    expect(validateStat(undefined)).toBe('—');
    expect(validateStat(null)).toBe('—');
    expect(validateStat(NaN)).toBe('—');
  });

  it('clamps to min/max', () => {
    expect(validateStat(-5, 0, 100)).toBe(0);
    expect(validateStat(150, 0, 100)).toBe(100);
  });
});

describe('formatMinutes', () => {
  it('handles various formats', () => {
    expect(formatMinutes('32:15')).toBe('32:15');
    expect(formatMinutes('32')).toBe('32');
    expect(formatMinutes(32)).toBe('32');
  });

  it('handles missing values', () => {
    expect(formatMinutes(undefined)).toBe('—');
    expect(formatMinutes('')).toBe('—');
  });
});

describe('parseShootingStats', () => {
  it('parses M-A format', () => {
    expect(parseShootingStats('3-7')).toEqual({ made: 3, attempted: 7 });
    expect(parseShootingStats('0-5')).toEqual({ made: 0, attempted: 5 });
  });

  it('handles invalid input', () => {
    expect(parseShootingStats(undefined)).toEqual({ made: 0, attempted: 0 });
    expect(parseShootingStats('--')).toEqual({ made: 0, attempted: 0 });
    expect(parseShootingStats('-')).toEqual({ made: 0, attempted: 0 });
  });
});

describe('formatPlayerStatsForDisplay', () => {
  const mockPlayer: PlayerStatLine = {
    name: 'Test Player',
    team: 'TEST',
    headshot: undefined,
    minutes: '32:15',
    points: 24,
    rebounds: 8,
    assists: 5,
    steals: 2,
    blocks: 1,
    fg3m: 3,
    fg3a: 7,
    fgm: 8,
    fga: 15,
    plusMinus: '+10',
  };

  it('calculates 3PT% correctly', () => {
    const result = formatPlayerStatsForDisplay(mockPlayer);
    // 3/7 = 42.857...% → rounds to 42.9%
    expect(result.fg3Pct).toBe('42.9%');
  });

  it('calculates FG% correctly', () => {
    const result = formatPlayerStatsForDisplay(mockPlayer);
    // 8/15 = 53.333...% → rounds to 53.3%
    expect(result.fgPct).toBe('53.3%');
  });

  it('preserves stat values', () => {
    const result = formatPlayerStatsForDisplay(mockPlayer);
    expect(result.name).toBe('Test Player');
    expect(result.points).toBe(24);
    expect(result.rebounds).toBe(8);
    expect(result.assists).toBe(5);
    expect(result.fg3Made).toBe(3);
    expect(result.fg3Attempted).toBe(7);
  });

  it('provides default headshot', () => {
    const result = formatPlayerStatsForDisplay(mockPlayer);
    expect(result.headshot).toContain('espncdn.com');
  });

  it('clamps negative values to 0', () => {
    const badPlayer: PlayerStatLine = {
      ...mockPlayer,
      points: -5,
      rebounds: -2,
    };
    const result = formatPlayerStatsForDisplay(badPlayer);
    expect(result.points).toBe(0);
    expect(result.rebounds).toBe(0);
  });
});

// Edge case: The mock shows "1/3 = 33%, not 76%"
// This test ensures we calculate correctly
describe('Real-world accuracy test', () => {
  it('Darius Garland 1-for-3 from three = 33.3%, not 76%', () => {
    const pct = calculateShootingPct(1, 3);
    expect(pct).toBe(33.3);
    expect(pct).not.toBe(76);
  });

  it('Evan Mobley scoring 24 points is shown as 24, not 0', () => {
    const player: PlayerStatLine = {
      name: 'Evan Mobley',
      team: 'CLE',
      minutes: '35',
      points: 24,
      rebounds: 10,
      assists: 3,
      steals: 1,
      blocks: 2,
      fg3m: 0,
      fg3a: 1,
      fgm: 10,
      fga: 15,
      plusMinus: '+8',
    };
    const result = formatPlayerStatsForDisplay(player);
    expect(result.points).toBe(24);
    expect(result.points).not.toBe(0);
  });

  it('Rudy Gobert with 0 3PM shows correct percentage', () => {
    const pct = calculateShootingPct(0, 2);
    expect(pct).toBe(0);
    // Should NOT say "did not make any 3s" when he didn't attempt any
    const pctNoAttempts = calculateShootingPct(0, 0);
    expect(pctNoAttempts).toBe(0);
  });
});
