// Test utilities for simulating game states and notifications

export interface MockGame {
  gameId: string;
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  period: number;
  clock: string;
  homeTeam: { abbreviation: string; name: string; score: number };
  awayTeam: { abbreviation: string; name: string; score: number };
}

// Sample mock games for testing
export const mockGames: MockGame[] = [
  {
    gameId: 'test-game-1',
    status: 'halftime',
    period: 2,
    clock: '0:00',
    homeTeam: { abbreviation: 'LAL', name: 'Lakers', score: 58 },
    awayTeam: { abbreviation: 'BOS', name: 'Celtics', score: 54 },
  },
  {
    gameId: 'test-game-2',
    status: 'final',
    period: 4,
    clock: '0:00',
    homeTeam: { abbreviation: 'GSW', name: 'Warriors', score: 112 },
    awayTeam: { abbreviation: 'PHX', name: 'Suns', score: 108 },
  },
  {
    gameId: 'test-game-3',
    status: 'live',
    period: 4,
    clock: '2:30',
    homeTeam: { abbreviation: 'MIA', name: 'Heat', score: 98 },
    awayTeam: { abbreviation: 'NYK', name: 'Knicks', score: 96 },
  },
];

// NBA team data for generating random games
const NBA_TEAMS = [
  { abbreviation: 'LAL', name: 'Lakers' },
  { abbreviation: 'BOS', name: 'Celtics' },
  { abbreviation: 'GSW', name: 'Warriors' },
  { abbreviation: 'MIA', name: 'Heat' },
  { abbreviation: 'NYK', name: 'Knicks' },
  { abbreviation: 'CHI', name: 'Bulls' },
  { abbreviation: 'PHX', name: 'Suns' },
  { abbreviation: 'DEN', name: 'Nuggets' },
  { abbreviation: 'MIL', name: 'Bucks' },
  { abbreviation: 'PHI', name: '76ers' },
  { abbreviation: 'DAL', name: 'Mavericks' },
  { abbreviation: 'BKN', name: 'Nets' },
];

// Generate random scores for variety
export function generateRandomGame(status: MockGame['status']): MockGame {
  const homeIdx = Math.floor(Math.random() * NBA_TEAMS.length);
  let awayIdx = Math.floor(Math.random() * NBA_TEAMS.length);
  while (awayIdx === homeIdx) {
    awayIdx = Math.floor(Math.random() * NBA_TEAMS.length);
  }

  const baseScore = status === 'halftime' ? 50 : status === 'final' ? 105 : 90;
  const variance = 15;

  return {
    gameId: `test-${Date.now()}`,
    status,
    period: status === 'halftime' ? 2 : 4,
    clock: status === 'live' ? `${Math.floor(Math.random() * 5)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}` : '0:00',
    homeTeam: {
      ...NBA_TEAMS[homeIdx],
      score: baseScore + Math.floor(Math.random() * variance),
    },
    awayTeam: {
      ...NBA_TEAMS[awayIdx],
      score: baseScore + Math.floor(Math.random() * variance),
    },
  };
}

// Create a close game (score within 5 points)
export function generateCloseGame(): MockGame {
  const game = generateRandomGame('live');
  // Ensure scores are within 5 points
  const baseScore = 95 + Math.floor(Math.random() * 10);
  const diff = Math.floor(Math.random() * 5); // 0-4 point difference
  
  game.homeTeam.score = baseScore;
  game.awayTeam.score = baseScore + (Math.random() > 0.5 ? diff : -diff);
  game.period = 4;
  game.clock = `${Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
  
  return game;
}

// Mock AI insight responses for testing
export const mockAIInsights = {
  halftime: "At halftime, it's been a closely contested battle with both teams trading baskets. The home team has shown strong perimeter shooting while the visitors are dominating the paint. Key players have been making their presence felt, and the second half promises to be exciting.",
  final: "What a game! The home team emerged victorious in a thrilling contest that came down to the final minutes. Outstanding performances on both ends of the court made this one for the highlight reels. The winning team's defensive adjustments in the fourth quarter proved to be the difference-maker.",
  closeGame: "We're in crunch time! Both teams are locked in a defensive struggle with every possession crucial. The intensity has ramped up significantly, and the crowd is on their feet for what promises to be a dramatic finish.",
};

// Truncate text for preview
export function truncateForPreview(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}


