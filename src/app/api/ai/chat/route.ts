// AI Chat API Route - Enhanced with live data, rich visuals, and player comparisons
// Uses Google Gemini with real-time ESPN data and generates structured visual responses

import { NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { logger } from '@/lib/logger';
import { fetchAllLiveData, buildAIContext, fetchStandings, fetchAllBoxscores, fetchScoresByDate, findGameByTeams, fetchGameBoxscore, LiveGameData } from '@/services/nba/live-data';
import { fetchPlayerStats, fetchGameDetail, fetchPlayerCareerStats, fetchPlayerStatsForSeason } from '@/services/nba/espn-api';
import { extractDateFromMessage, parseNaturalDate } from '@/lib/date-parser';

// ============================================
// DATA VALIDATION LAYER
// ============================================

/**
 * Validates and normalizes player statistics to ensure they're within reasonable ranges
 */
function validatePlayerStats(stats: ExtendedPlayerStats): ExtendedPlayerStats {
  return {
    ppg: Math.max(0, Math.min(100, stats.ppg || 0)), // Points per game: 0-100
    rpg: Math.max(0, Math.min(30, stats.rpg || 0)), // Rebounds per game: 0-30
    apg: Math.max(0, Math.min(20, stats.apg || 0)), // Assists per game: 0-20
    spg: Math.max(0, Math.min(5, stats.spg || 0)), // Steals per game: 0-5
    bpg: Math.max(0, Math.min(5, stats.bpg || 0)), // Blocks per game: 0-5
    mpg: Math.max(0, Math.min(48, stats.mpg || 0)), // Minutes per game: 0-48
    gamesPlayed: Math.max(0, Math.min(100, stats.gamesPlayed || 0)), // Games: 0-100
    // Percentages: ESPN returns as whole numbers (51.26 = 51.26%), clamp to 0-100
    fgPct: Math.max(0, Math.min(100, stats.fgPct || 0)),
    fg3Pct: Math.max(0, Math.min(100, stats.fg3Pct || 0)),
    ftPct: Math.max(0, Math.min(100, stats.ftPct || 0)),
  };
}

/**
 * Validates game stats to ensure they're within reasonable ranges
 */
function validateGameStats(stats: {
  points?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  fgm?: number;
  fga?: number;
  fg3m?: number;
  fg3a?: number;
}): typeof stats {
  return {
    points: Math.max(0, Math.min(150, stats.points || 0)), // Points: 0-150
    rebounds: Math.max(0, Math.min(50, stats.rebounds || 0)), // Rebounds: 0-50
    assists: Math.max(0, Math.min(50, stats.assists || 0)), // Assists: 0-50
    steals: Math.max(0, Math.min(15, stats.steals || 0)), // Steals: 0-15
    blocks: Math.max(0, Math.min(15, stats.blocks || 0)), // Blocks: 0-15
    fgm: Math.max(0, Math.min(50, stats.fgm || 0)), // Field goals made: 0-50
    fga: Math.max(0, Math.min(100, stats.fga || 0)), // Field goals attempted: 0-100
    fg3m: Math.max(0, Math.min(30, stats.fg3m || 0)), // 3-pointers made: 0-30
    fg3a: Math.max(0, Math.min(50, stats.fg3a || 0)), // 3-pointers attempted: 0-50
  };
}

// ============================================
// TYPE DEFINITIONS FOR VISUAL RESPONSES
// ============================================

interface VisualGameData {
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record?: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record?: string;
  };
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  period?: number;
  clock?: string;
  venue?: string;
  broadcast?: string;
}

interface VisualPlayerData {
  id: string;
  name: string;
  team: string;
  teamLogo: string;
  headshot: string;
  position: string;
  number?: string;
  stats: {
    ppg: number;
    rpg: number;
    apg: number;
    spg?: number;
    bpg?: number;
    fgPct?: number;
    fg3Pct?: number;
    ftPct?: number;
    mpg?: number;
    gp?: number;
    gamesPlayed?: number;
  };
  careerStats?: {
    ppg: number;
    rpg: number;
    apg: number;
    games: number;
  };
  gameStats?: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    minutes: string;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
  };
}

interface VisualStandingsData {
  conference: 'East' | 'West';
  teams: Array<{
    rank: number;
    name: string;
    abbreviation: string;
    logo: string;
    wins: number;
    losses: number;
    winPct: string;
    gamesBehind: string;
    streak?: string;
    isPlayoff?: boolean;
    isPlayIn?: boolean;
  }>;
}

interface VisualStatsTable {
  title: string;
  headers: string[];
  rows: Array<{
    label: string;
    values: (string | number)[];
    highlight?: 'home' | 'away' | 'none';
  }>;
  homeTeam?: string;
  awayTeam?: string;
}

interface VisualLeadersData {
  category: string;
  players: Array<{
    rank: number;
    name: string;
    team: string;
    teamLogo: string;
    headshot: string;
    value: number | string;
    trend?: 'up' | 'down' | 'same';
  }>;
}

interface PlayerComparisonVisual {
  player1: VisualPlayerData;
  player2: VisualPlayerData;
  verdict: string;
  categories: Array<{
    name: string;
    player1Value: number | string;
    player2Value: number | string;
    winner: 'player1' | 'player2' | 'tie';
  }>;
}

// Game recap player type for top player comparison
interface GameRecapTopPlayer {
  name: string;
  headshot?: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  fg3m: number;
  fg3a: number;
  fgm?: number;
  fga?: number;
  plusMinus?: string;
}

// Game recap visual with side-by-side top player comparison
interface GameRecapVisual {
  gameId: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record?: string;
    topPlayers: GameRecapTopPlayer[];
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record?: string;
    topPlayers: GameRecapTopPlayer[];
  };
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  venue?: string;
  broadcast?: string;
  date?: string;
}

type AIVisualResponse =
  | { type: 'games'; data: VisualGameData[]; dateDisplay?: string }
  | { type: 'game'; data: VisualGameData }
  | { type: 'gameRecap'; data: GameRecapVisual }
  | { type: 'player'; data: VisualPlayerData }
  | { type: 'players'; data: VisualPlayerData[] }
  | { type: 'standings'; data: VisualStandingsData[] }
  | { type: 'statsTable'; data: VisualStatsTable }
  | { type: 'leaders'; data: VisualLeadersData }
  | { type: 'comparison'; data: PlayerComparisonVisual };

// ============================================
// PLAYER NAME MAPPINGS
// ============================================

const PLAYER_NAME_MAP: Record<string, string> = {
  'lebron': 'LeBron James',
  'lebron james': 'LeBron James',
  'lbj': 'LeBron James',
  'curry': 'Stephen Curry',
  'steph': 'Stephen Curry',
  'steph curry': 'Stephen Curry',
  'stephen curry': 'Stephen Curry',
  'kd': 'Kevin Durant',
  'durant': 'Kevin Durant',
  'kevin durant': 'Kevin Durant',
  'giannis': 'Giannis Antetokounmpo',
  'greek freak': 'Giannis Antetokounmpo',
  'luka': 'Luka Dončić',
  'luka doncic': 'Luka Dončić',
  'jokic': 'Nikola Jokić',
  'nikola jokic': 'Nikola Jokić',
  'the joker': 'Nikola Jokić',
  'tatum': 'Jayson Tatum',
  'jayson tatum': 'Jayson Tatum',
  'embiid': 'Joel Embiid',
  'joel embiid': 'Joel Embiid',
  'ant': 'Anthony Edwards',
  'anthony edwards': 'Anthony Edwards',
  'sga': 'Shai Gilgeous-Alexander',
  'shai': 'Shai Gilgeous-Alexander',
  'booker': 'Devin Booker',
  'devin booker': 'Devin Booker',
  'morant': 'Ja Morant',
  'ja morant': 'Ja Morant',
  'ja': 'Ja Morant',
  'donovan mitchell': 'Donovan Mitchell',
  'spida': 'Donovan Mitchell',
  'brunson': 'Jalen Brunson',
  'jalen brunson': 'Jalen Brunson',
  'fox': 'De\'Aaron Fox',
  'deaaron fox': 'De\'Aaron Fox',
  'kawhi': 'Kawhi Leonard',
  'kawhi leonard': 'Kawhi Leonard',
  'pg': 'Paul George',
  'paul george': 'Paul George',
  'harden': 'James Harden',
  'james harden': 'James Harden',
  'dame': 'Damian Lillard',
  'damian lillard': 'Damian Lillard',
  'lillard': 'Damian Lillard',
  'bam': 'Bam Adebayo',
  'bam adebayo': 'Bam Adebayo',
  'jimmy butler': 'Jimmy Butler',
  'jimmy': 'Jimmy Butler',
  'wemby': 'Victor Wembanyama',
  'wembanyama': 'Victor Wembanyama',
  'victor wembanyama': 'Victor Wembanyama',
};

// ============================================
// TEAM MAPPINGS
// ============================================

const NBA_TEAMS: Record<string, { id: string; name: string; abbreviation: string; logo: string }> = {
  'lakers': { id: '13', name: 'Los Angeles Lakers', abbreviation: 'LAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' },
  'celtics': { id: '2', name: 'Boston Celtics', abbreviation: 'BOS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' },
  'warriors': { id: '9', name: 'Golden State Warriors', abbreviation: 'GSW', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png' },
  'bulls': { id: '4', name: 'Chicago Bulls', abbreviation: 'CHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png' },
  'heat': { id: '14', name: 'Miami Heat', abbreviation: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png' },
  'nets': { id: '17', name: 'Brooklyn Nets', abbreviation: 'BKN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png' },
  'knicks': { id: '18', name: 'New York Knicks', abbreviation: 'NYK', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png' },
  'nuggets': { id: '7', name: 'Denver Nuggets', abbreviation: 'DEN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png' },
  'suns': { id: '21', name: 'Phoenix Suns', abbreviation: 'PHX', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png' },
  'mavericks': { id: '6', name: 'Dallas Mavericks', abbreviation: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' },
  'mavs': { id: '6', name: 'Dallas Mavericks', abbreviation: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' },
  'bucks': { id: '15', name: 'Milwaukee Bucks', abbreviation: 'MIL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png' },
  '76ers': { id: '20', name: 'Philadelphia 76ers', abbreviation: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png' },
  'sixers': { id: '20', name: 'Philadelphia 76ers', abbreviation: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png' },
  'clippers': { id: '12', name: 'Los Angeles Clippers', abbreviation: 'LAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png' },
  'thunder': { id: '25', name: 'Oklahoma City Thunder', abbreviation: 'OKC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' },
  'okc': { id: '25', name: 'Oklahoma City Thunder', abbreviation: 'OKC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' },
  'cavaliers': { id: '5', name: 'Cleveland Cavaliers', abbreviation: 'CLE', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png' },
  'cavs': { id: '5', name: 'Cleveland Cavaliers', abbreviation: 'CLE', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png' },
  'timberwolves': { id: '16', name: 'Minnesota Timberwolves', abbreviation: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png' },
  'wolves': { id: '16', name: 'Minnesota Timberwolves', abbreviation: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png' },
  'kings': { id: '23', name: 'Sacramento Kings', abbreviation: 'SAC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png' },
  'hawks': { id: '1', name: 'Atlanta Hawks', abbreviation: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png' },
  'hornets': { id: '30', name: 'Charlotte Hornets', abbreviation: 'CHA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png' },
  'pistons': { id: '8', name: 'Detroit Pistons', abbreviation: 'DET', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png' },
  'pacers': { id: '11', name: 'Indiana Pacers', abbreviation: 'IND', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png' },
  'magic': { id: '19', name: 'Orlando Magic', abbreviation: 'ORL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png' },
  'raptors': { id: '28', name: 'Toronto Raptors', abbreviation: 'TOR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png' },
  'wizards': { id: '27', name: 'Washington Wizards', abbreviation: 'WAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png' },
  'grizzlies': { id: '29', name: 'Memphis Grizzlies', abbreviation: 'MEM', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png' },
  'pelicans': { id: '3', name: 'New Orleans Pelicans', abbreviation: 'NOP', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/no.png' },
  'spurs': { id: '24', name: 'San Antonio Spurs', abbreviation: 'SAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png' },
  'rockets': { id: '10', name: 'Houston Rockets', abbreviation: 'HOU', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png' },
  'jazz': { id: '26', name: 'Utah Jazz', abbreviation: 'UTA', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png' },
  'blazers': { id: '22', name: 'Portland Trail Blazers', abbreviation: 'POR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png' },
  'trailblazers': { id: '22', name: 'Portland Trail Blazers', abbreviation: 'POR', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png' },
};

// ============================================
// INTENT DETECTION
// ============================================

type UserIntent =
  | { type: 'games'; filter?: 'live' | 'today' | 'upcoming' | 'team' | 'date' | 'recentGames'; team?: string; date?: string; dateDisplay?: string; isRecap?: boolean }
  | { type: 'specificGame'; gameId: string } // New: for queries about specific game IDs
  | { type: 'standings'; conference?: 'east' | 'west' | 'both' }
  | { type: 'player'; name: string; season?: number; seasonDisplay?: string }
  | { type: 'comparison'; player1: string; player2: string; gameContext?: { team1?: string; team2?: string; date?: string; dateDisplay?: string } }
  | { type: 'team'; name: string }
  | { type: 'leaders'; category?: string }
  | { type: 'general' };

function detectUserIntent(message: string): UserIntent {
  const lowerMsg = message.toLowerCase();

  // Check for specific game ID first (format: 9-10 digit number, usually starts with 401)
  // Examples: "game 401810413", "game id 401810413", "401810413"
  const gameIdMatch = message.match(/\b(401\d{6,7})\b/);
  if (gameIdMatch) {
    console.log(`[Intent] Detected specific game ID: ${gameIdMatch[1]}`);
    return { type: 'specificGame', gameId: gameIdMatch[1] };
  }

  // Check for player comparison first
  // Also detect game context (e.g., "from the last warriors vs lakers game")
  const gameContextPattern = /(?:from|in|during|at)\s+(?:the\s+)?(?:last|previous|most recent|recent)\s+((?:\w+\s+)?(?:vs?\.?|versus)\s+(?:\w+\s+)?(?:game|matchup))/i;
  const gameContextMatch = lowerMsg.match(gameContextPattern);
  let gameContext: { team1?: string; team2?: string; date?: string; dateDisplay?: string } | undefined;

  if (gameContextMatch) {
    // Extract teams from game context
    const gameText = gameContextMatch[1];
    const teamMatch = gameText.match(/(\w+)\s+(?:vs?\.?|versus)\s+(\w+)/i);
    if (teamMatch) {
      const team1Name = teamMatch[1].toLowerCase();
      const team2Name = teamMatch[2].toLowerCase();
      const team1 = Object.values(NBA_TEAMS).find(t =>
        t.name.toLowerCase().includes(team1Name) ||
        t.abbreviation.toLowerCase() === team1Name ||
        team1Name.includes(t.name.toLowerCase().split(' ')[0])
      );
      const team2 = Object.values(NBA_TEAMS).find(t =>
        t.name.toLowerCase().includes(team2Name) ||
        t.abbreviation.toLowerCase() === team2Name ||
        team2Name.includes(t.name.toLowerCase().split(' ')[0])
      );

      if (team1 && team2) {
        gameContext = { team1: team1.abbreviation, team2: team2.abbreviation };
      }
    }

    // Check for date in the message
    const dateMatch = extractDateFromMessage(message);
    if (dateMatch) {
      gameContext = { ...gameContext, date: dateMatch.dateString, dateDisplay: dateMatch.displayString };
    }
  }

  const comparisonPatterns = [
    /compare\s+(.+?)\s+(?:vs?\.?|versus|and|to|with)\s+(.+)/i,
    /(.+?)\s+vs?\.?\s+(.+)/i,
    /who(?:'s| is)\s+better[,:]?\s+(.+?)\s+or\s+(.+)/i,
    /(.+?)\s+or\s+(.+?)\s+who(?:'s| is)\s+better/i,
    /between\s+(.+?)\s+and\s+(.+)/i,
  ];

  for (const pattern of comparisonPatterns) {
    const match = lowerMsg.match(pattern);
    if (match) {
      let player1 = match[1].trim().replace(/[?!.,]/g, '');
      let player2 = match[2].trim().replace(/[?!.,]/g, '');

      // Remove game context and extra phrases from player names
      player1 = player1
        .replace(/(?:from|in|during|at)\s+(?:the\s+)?(?:last|previous|most recent|recent).*$/i, '')
        .replace(/^(?:tell me about|show me|what about|who is|stats for|statistics for)\s+/i, '')
        .replace(/\s+(?:stats|statistics|performance|numbers|averages).*$/i, '')
        .trim();
      player2 = player2
        .replace(/(?:from|in|during|at)\s+(?:the\s+)?(?:last|previous|most recent|recent).*$/i, '')
        .replace(/^(?:tell me about|show me|what about|who is|stats for|statistics for)\s+/i, '')
        .replace(/\s+(?:stats|statistics|performance|numbers|averages).*$/i, '')
        .trim();

      // Clean up "vs" or "versus" if they got captured
      player1 = player1.replace(/\s+vs\.?\s*$/i, '').trim();
      player2 = player2.replace(/^\s*vs\.?\s+/i, '').trim();

      // Use player name map for common nicknames
      player1 = PLAYER_NAME_MAP[player1.toLowerCase()] || player1;
      player2 = PLAYER_NAME_MAP[player2.toLowerCase()] || player2;

      console.log(`[Intent] Parsed comparison: "${player1}" vs "${player2}"`);
      return { type: 'comparison', player1, player2, gameContext };
    }
  }

  // Check for standings
  if (lowerMsg.includes('standing') || lowerMsg.includes('rank') || lowerMsg.includes('playoff')) {
    if (lowerMsg.includes('east')) return { type: 'standings', conference: 'east' };
    if (lowerMsg.includes('west')) return { type: 'standings', conference: 'west' };
    return { type: 'standings', conference: 'both' };
  }

  // Extract season from message (e.g., "2007-2008", "07-08", "2007", "2008 season")
  const seasonMatch = message.match(/(?:season\s+)?(\d{4})(?:-(\d{2,4}))?/i) || message.match(/(\d{2})-(\d{2})\s+season/i);
  let extractedSeason: number | undefined;
  let seasonDisplay: string | undefined;

  if (seasonMatch) {
    const year1 = parseInt(seasonMatch[1]);
    const year2 = seasonMatch[2] ? parseInt(seasonMatch[2]) : null;

    if (year2) {
      // Format: "2007-2008" or "07-08"
      const seasonStartYear = year1 < 100 ? 2000 + year1 : year1;
      extractedSeason = seasonStartYear;
      seasonDisplay = `${seasonStartYear}-${String(seasonStartYear + 1).slice(-2)}`;
    } else if (year1 >= 1946 && year1 <= new Date().getFullYear() + 1) {
      // Single year format: "2007" or "2007 season"
      extractedSeason = year1;
      seasonDisplay = `${year1}-${String(year1 + 1).slice(-2)}`;
    }
  }

  // Check for specific player info BEFORE checking for games
  // This ensures player queries get player visuals even if they mention "game" or "today"
  const playerQueryPatterns = [
    /how (?:many|did|is|was|does|has)\s+(?:\w+\s+){0,3}(\w+(?:\s+\w+)?)\s+(?:score|play|do|perform|have)/i,
    /(?:tell me about|show me|what about|who is|stats for|statistics for|give me the stats of)\s+(.+?)(?:\s+in\s+\d{4}(?:-\d{2,4})?\s+season)?(?:\?|$)/i,
    /(\w+(?:\s+\w+)?(?:'s)?)\s+(?:stats|statistics|performance|numbers|averages)(?:\s+in\s+\d{4}(?:-\d{2,4})?\s+season)?/i,
    /how\s+(?:is|was|did)\s+(.+?)\s+(?:playing|doing|perform)/i,
  ];

  for (const pattern of playerQueryPatterns) {
    const match = lowerMsg.match(pattern);
    if (match) {
      let playerName = match[1].trim().replace(/[?!.,\'s]/g, '').trim();
      // Remove season info from player name if it was captured
      playerName = playerName.replace(/\s+in\s+\d{4}(?:-\d{2,4})?\s+season/i, '').trim();
      // Check if it's a known player
      const fullName = PLAYER_NAME_MAP[playerName.toLowerCase()];
      if (fullName) {
        return { type: 'player', name: fullName, season: extractedSeason, seasonDisplay };
      }
      // Check partial matches in player map
      for (const [nickname, full] of Object.entries(PLAYER_NAME_MAP)) {
        if (playerName.toLowerCase().includes(nickname) || nickname.includes(playerName.toLowerCase())) {
          return { type: 'player', name: full, season: extractedSeason, seasonDisplay };
        }
      }
    }
  }

  // Check for game recap queries FIRST - this must come BEFORE player name search
  // to prevent "recap of pistons game" from matching a player named "piston" or similar
  // Note: Patterns must handle "of the [team]" correctly - "the" should be optional, not captured as team
  const recapPatterns = [
    // "recap of the pistons game", "recap of pistons game", "tell me about the lakers game"
    /(?:recap|summary|summary of|recap of|tell me about|what happened in)\s+(?:the\s+)?(?:today'?s?\s+)?(\w+)\s+(?:game|match|matchup)(?:\s+(?:last|next|this)\s+(?:week|month|day|tuesday|monday|wednesday|thursday|friday|saturday|sunday))?/i,
    // "pistons game recap", "lakers game summary"
    /(\w+)\s+(?:game|match|matchup)\s+(?:recap|summary|from)\s*(?:last|next|this)?\s*(?:week|month|day)?/i,
    // "recap of the pistons game" - handle "of the" as a unit
    /(?:recap|summary)\s+of\s+(?:the\s+)?(?:today'?s?\s+)?(\w+)\s+(?:game|match)/i,
    // "give me a recap of the pistons game"
    /give\s+me\s+(?:a\s+)?(?:recap|summary)\s+of\s+(?:the\s+)?(?:today'?s?\s+)?(\w+)\s+(?:game|match)/i,
    // "recap of the cavs", "recap of the lakers" - without "game" word
    /(?:recap|summary)\s+(?:of\s+)?(?:the\s+)?(\w+)$/i,
  ];

  for (const pattern of recapPatterns) {
    const match = lowerMsg.match(pattern);
    if (match) {
      const teamName = match[1].toLowerCase();
      const team = Object.values(NBA_TEAMS).find(t =>
        t.name.toLowerCase().includes(teamName) ||
        t.abbreviation.toLowerCase() === teamName ||
        teamName.includes(t.name.toLowerCase().split(' ')[0])
      );

      if (team) {
        // Extract date from message, but ignore "today" if it appears as part of "today's" 
        // to avoid matching "recap of today's pistons game" as a today-only search
        const dateMatch = extractDateFromMessage(message);
        
        // Check if this is a "today's game" query - should still search recent if no game today
        const isTodaysQuery = /today'?s?\s+\w+\s+game/i.test(message);
        
        if (dateMatch && !isTodaysQuery) {
          console.log(`[Intent] Detected recap query for ${team.abbreviation} on ${dateMatch.displayString}`);
          return {
            type: 'games',
            filter: 'date',
            team: team.abbreviation,
            date: dateMatch.dateString,
            dateDisplay: dateMatch.displayString,
            isRecap: true,
          };
        }
        
        // For recap queries without a specific date (or "today's game" queries),
        // use recentGames filter to search the last 7 days and find the most recent game
        console.log(`[Intent] Detected recap query for ${team.abbreviation} (searching recent games)`);
        return {
          type: 'games',
          filter: 'recentGames',
          team: team.abbreviation,
          dateDisplay: 'Recent',
          isRecap: true,
        };
      }
    }
  }

  // Check for known player names directly
  // IMPORTANT: Skip this check if the message contains game-related keywords to prevent
  // player intent from overriding game recap queries (e.g., if a player nickname appears in team name)
  const isGameRelatedQuery = /\b(game|match|matchup|recap|summary|score|played|playing)\b/i.test(message);
  if (!isGameRelatedQuery) {
    for (const [nickname, fullName] of Object.entries(PLAYER_NAME_MAP)) {
      if (lowerMsg.includes(nickname)) {
        return { type: 'player', name: fullName, season: extractedSeason, seasonDisplay };
      }
    }
  }

  // Check for games/scores (after player check)
  // First check for date references
  const dateMatch = extractDateFromMessage(message);
  if (dateMatch) {
    // Check for specific team with date
    for (const [key, team] of Object.entries(NBA_TEAMS)) {
      if (lowerMsg.includes(key)) {
        return { type: 'games', filter: 'date', team: team.abbreviation, date: dateMatch.dateString, dateDisplay: dateMatch.displayString };
      }
    }

    return { type: 'games', filter: 'date', date: dateMatch.dateString, dateDisplay: dateMatch.displayString };
  }

  if (lowerMsg.includes('score') || lowerMsg.includes('game') || lowerMsg.includes('playing') ||
    lowerMsg.includes('tonight') || lowerMsg.includes('today') || lowerMsg.includes('tomorrow') ||
    lowerMsg.includes('yesterday') || lowerMsg.includes('live') || lowerMsg.includes('schedule')) {
    // Check for specific team
    for (const [key, team] of Object.entries(NBA_TEAMS)) {
      if (lowerMsg.includes(key)) {
        return { type: 'games', filter: 'team', team: team.abbreviation };
      }
    }

    if (lowerMsg.includes('live')) return { type: 'games', filter: 'live' };
    if (lowerMsg.includes('tomorrow')) {
      const tomorrowDate = parseNaturalDate('tomorrow');
      if (tomorrowDate) {
        return { type: 'games', filter: 'date', date: tomorrowDate.dateString, dateDisplay: tomorrowDate.displayString };
      }
    }
    if (lowerMsg.includes('yesterday')) {
      const yesterdayDate = parseNaturalDate('yesterday');
      if (yesterdayDate) {
        return { type: 'games', filter: 'date', date: yesterdayDate.dateString, dateDisplay: yesterdayDate.displayString };
      }
    }
    return { type: 'games', filter: 'today' };
  }

  // Check for team info
  for (const [key, team] of Object.entries(NBA_TEAMS)) {
    if (lowerMsg.includes(key)) {
      return { type: 'team', name: team.name };
    }
  }

  // Check for leaders/stats
  if (lowerMsg.includes('leader') || lowerMsg.includes('best') || lowerMsg.includes('top scorer') ||
    lowerMsg.includes('mvp') || lowerMsg.includes('who leads')) {
    return { type: 'leaders' };
  }

  return { type: 'general' };
}

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

async function searchPlayer(playerName: string): Promise<{ id: string; name: string; team: string; teamLogo: string; position: string } | null> {
  try {
    console.log(`[Player Search] Searching for: "${playerName}"`);
    const searchUrl = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(playerName)}&limit=10&type=player`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.log(`[Player Search] Search request failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    // ESPN API returns 'items' not 'results'
    const results = data.items || data.results || [];
    console.log(`[Player Search] Found ${results.length} total results`);

    // Log all results for debugging
    results.forEach((r: any, i: number) => {
      console.log(`[Player Search] Result ${i}: ${r.displayName} (type: ${r.type}, league: ${r.league}, sport: ${r.sport})`);
    });

    // First pass: exact NBA match (league can be string 'nba' or object)
    for (const result of results) {
      const isNBA = result.league === 'nba' ||
        result.league?.toLowerCase?.() === 'nba' ||
        result.league?.abbreviation === 'NBA' ||
        result.defaultLeagueSlug === 'nba';

      if (result.type === 'player' && isNBA) {
        // Get team info from teamRelationships
        const teamRel = result.teamRelationships?.[0]?.core || result.team;
        const teamName = teamRel?.displayName || result.teamRelationships?.[0]?.displayName || 'Unknown';
        const teamAbbr = teamRel?.abbreviation || 'nba';
        const teamLogo = teamRel?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${teamAbbr.toLowerCase()}.png`;

        console.log(`[Player Search] Found NBA player: ${result.displayName} (ID: ${result.id}, Team: ${teamName})`);
        return {
          id: result.id,
          name: result.displayName || playerName,
          team: teamName,
          teamLogo: teamLogo,
          position: result.position || 'N/A',
        };
      }
    }

    // Second pass: any basketball player
    for (const result of results) {
      if (result.type === 'player' && result.sport === 'basketball') {
        const teamRel = result.teamRelationships?.[0]?.core || result.team;
        const teamName = teamRel?.displayName || result.teamRelationships?.[0]?.displayName || 'Unknown';
        const teamAbbr = teamRel?.abbreviation || 'nba';
        const teamLogo = teamRel?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${teamAbbr.toLowerCase()}.png`;

        console.log(`[Player Search] Found basketball player (fallback): ${result.displayName} (ID: ${result.id})`);
        return {
          id: result.id,
          name: result.displayName || playerName,
          team: teamName,
          teamLogo: teamLogo,
          position: result.position || 'N/A',
        };
      }
    }

    console.log(`[Player Search] No NBA player found for "${playerName}"`);
    return null;
  } catch (error) {
    console.error('[Player Search] Error:', error);
    return null;
  }
}

type ExtendedPlayerStats = VisualPlayerData['stats'] & {
  gamesPlayed?: number;
  careerPpg?: number;
  careerRpg?: number;
  careerApg?: number;
  careerGames?: number;
};

async function fetchPlayerSeasonStats(playerId: string): Promise<ExtendedPlayerStats | null> {
  try {
    // Use the same function that the game analytics page uses
    const seasonStats = await fetchPlayerStats(playerId);

    if (!seasonStats) {
      console.log(`[Player Stats] No stats found for player ${playerId}`);
      return null;
    }

    console.log(`[Player Stats] Raw stats for ${playerId}:`, {
      pointsPerGame: seasonStats.pointsPerGame,
      reboundsPerGame: seasonStats.reboundsPerGame,
      assistsPerGame: seasonStats.assistsPerGame,
      fgPct: seasonStats.fgPct,
    });

    // Convert ESPNPlayerSeasonStats to ExtendedPlayerStats format
    // Note: ESPN returns percentages as whole numbers (e.g., 51.26 not 0.5126)
    const converted = {
      ppg: seasonStats.pointsPerGame || 0,
      rpg: seasonStats.reboundsPerGame || 0,
      apg: seasonStats.assistsPerGame || 0,
      spg: seasonStats.stealsPerGame || 0,
      bpg: seasonStats.blocksPerGame || 0,
      fgPct: seasonStats.fgPct || 0, // Already a percentage (51.26 = 51.26%)
      fg3Pct: seasonStats.fg3Pct || 0,
      ftPct: seasonStats.ftPct || 0,
      mpg: seasonStats.minutesPerGame || 0,
      gamesPlayed: seasonStats.gamesPlayed || 0,
    };

    // Validate and normalize stats
    const validated = validatePlayerStats(converted);

    console.log(`[Player Stats] Converted stats for ${playerId}:`, validated);

    return validated;
  } catch (error) {
    console.error('[Player Stats] Error:', error);
    return null;
  }
}

async function fetchFullPlayerData(
  playerName: string,
  season?: number
): Promise<VisualPlayerData | null> {
  console.log(`[Player Data] Fetching full data for: ${playerName}${season ? ` (season ${season})` : ' (current season)'}`);

  const playerInfo = await searchPlayer(playerName);
  if (!playerInfo) {
    console.log(`[Player Data] Player not found: ${playerName}`);
    return null;
  }

  console.log(`[Player Data] Found player: ${playerInfo.name} (${playerInfo.id})`);

  // Fetch player stats - use current season by default, or specified season
  const fullPlayerStats = await fetchPlayerStats(playerInfo.id, season);

  console.log(`[Player Data] Full player stats for ${playerInfo.name}:`, fullPlayerStats);

  if (!fullPlayerStats) {
    console.log(`[Player Data] WARNING: No stats found for ${playerInfo.name} (${playerInfo.id}), trying career stats as fallback`);
    // Try career stats as fallback
    const careerStats = await fetchPlayerCareerStats(playerInfo.id);
    if (careerStats) {
      console.log(`[Player Data] Using career stats as fallback for ${playerInfo.name}`);
      const rawStats: ExtendedPlayerStats = {
        ppg: careerStats.pointsPerGame || 0,
        rpg: careerStats.reboundsPerGame || 0,
        apg: careerStats.assistsPerGame || 0,
        spg: careerStats.stealsPerGame || 0,
        bpg: careerStats.blocksPerGame || 0,
        fgPct: careerStats.fgPct || 0,
        fg3Pct: careerStats.fg3Pct || 0,
        ftPct: careerStats.ftPct || 0,
        mpg: careerStats.minutesPerGame || 0,
        gamesPlayed: careerStats.gamesPlayed || 0,
      };
      const finalStats = validatePlayerStats(rawStats);

      return {
        id: playerInfo.id,
        name: playerInfo.name, // Use the properly formatted name from search
        team: playerInfo.team,
        teamLogo: playerInfo.teamLogo,
        headshot: careerStats.headshot || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${playerInfo.id}.png&w=350&h=254`,
        position: careerStats.position || playerInfo.position,
        number: careerStats.jersey || undefined,
        stats: finalStats,
      };
    }
  } else {
    console.log(`[Player Data] Stats found - PPG: ${fullPlayerStats.pointsPerGame}, RPG: ${fullPlayerStats.reboundsPerGame}, APG: ${fullPlayerStats.assistsPerGame}`);
  }

  // Convert ESPNPlayerSeasonStats to our format
  // Note: ESPN returns percentages as whole numbers (e.g., 51.26 not 0.5126)
  const rawStats: ExtendedPlayerStats = fullPlayerStats ? {
    ppg: fullPlayerStats.pointsPerGame || 0,
    rpg: fullPlayerStats.reboundsPerGame || 0,
    apg: fullPlayerStats.assistsPerGame || 0,
    spg: fullPlayerStats.stealsPerGame || 0,
    bpg: fullPlayerStats.blocksPerGame || 0,
    fgPct: fullPlayerStats.fgPct || 0, // Already a percentage (51.26 = 51.26%)
    fg3Pct: fullPlayerStats.fg3Pct || 0,
    ftPct: fullPlayerStats.ftPct || 0,
    mpg: fullPlayerStats.minutesPerGame || 0,
    gamesPlayed: fullPlayerStats.gamesPlayed || 0,
  } : { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0, mpg: 0, gamesPlayed: 0 };

  // Validate and normalize stats
  const finalStats = validatePlayerStats(rawStats);

  console.log(`[Player Data] Final converted stats for ${playerInfo.name}:`, finalStats);

  const result: VisualPlayerData = {
    id: playerInfo.id,
    name: playerInfo.name, // Use the properly formatted name from search
    team: playerInfo.team,
    teamLogo: playerInfo.teamLogo,
    headshot: fullPlayerStats?.headshot || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${playerInfo.id}.png&w=350&h=254`,
    position: fullPlayerStats?.position || playerInfo.position,
    number: fullPlayerStats?.jersey || undefined,
    stats: finalStats,
  };

  console.log(`[Player Data] Returning player data for ${playerInfo.name} with stats:`, result.stats);

  return result;
}

// Search for player stats in today's games boxscores
function findPlayerInBoxscores(playerName: string, liveContext: string): string | null {
  const normalizedName = playerName.toLowerCase();

  // Search through the context for player stats
  const lines = liveContext.split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check if this line contains the player's stats
    // Format: "    PlayerName: Xpts, Xreb, Xast, ..."
    const namePart = lowerLine.split(':')[0]?.trim();
    if (namePart && (
      namePart.includes(normalizedName) ||
      normalizedName.includes(namePart) ||
      levenshteinDistance(namePart, normalizedName) <= 3
    )) {
      return line.trim();
    }
  }

  return null;
}

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function convertGameToVisual(game: LiveGameData): VisualGameData {
  const getTeamLogo = (abbr: string) =>
    `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`;

  return {
    gameId: game.gameId,
    homeTeam: {
      name: game.homeTeam.name,
      abbreviation: game.homeTeam.abbreviation,
      logo: getTeamLogo(game.homeTeam.abbreviation),
      score: game.homeTeam.score,
      record: game.homeTeam.record,
    },
    awayTeam: {
      name: game.awayTeam.name,
      abbreviation: game.awayTeam.abbreviation,
      logo: getTeamLogo(game.awayTeam.abbreviation),
      score: game.awayTeam.score,
      record: game.awayTeam.record,
    },
    status: game.status,
    period: game.period,
    clock: game.clock,
    venue: game.venue,
    broadcast: game.broadcast,
  };
}

// ============================================
// VISUAL RESPONSE GENERATION
// ============================================

async function generateVisualResponse(intent: UserIntent, liveData: any): Promise<AIVisualResponse | null> {
  try {
    switch (intent.type) {
      case 'games': {
        let games = liveData.games as LiveGameData[];
        let dateDisplay: string | undefined;

        // Check if this is a future date query
        const isFutureDateQuery = intent.filter === 'date' && intent.dateDisplay &&
          (intent.dateDisplay === 'Tomorrow' || intent.dateDisplay?.toLowerCase().includes('next') ||
            (parseNaturalDate(intent.date || '')?.isFuture ?? false));

        if (intent.filter === 'live') {
          games = games.filter(g => g.status === 'live' || g.status === 'halftime');
          dateDisplay = 'Today';
        } else if (intent.filter === 'team' && intent.team) {
          games = games.filter(g =>
            g.homeTeam.abbreviation === intent.team ||
            g.awayTeam.abbreviation === intent.team
          );
          dateDisplay = 'Today';
        } else if (intent.filter === 'date' && intent.dateDisplay) {
          // Games are already filtered by date from the API call
          dateDisplay = intent.dateDisplay;
        } else if (intent.filter === 'recentGames' && intent.team) {
          // Games are already filtered by team and sorted by date from the API call
          dateDisplay = intent.isRecap ? `${intent.team} Recap` : 'Recent';
        } else {
          // Default to today
          dateDisplay = 'Today';
        }

        // For future dates, allow empty games array (Gemini will populate it)
        // For recentGames (recap) queries, allow empty if no games found - we'll show a message
        const isRecentGamesQuery = intent.filter === 'recentGames';
        if (games.length === 0 && !isFutureDateQuery && !isRecentGamesQuery) return null;

        // NEW: For recap queries with a completed game, return gameRecap with top player comparison
        if (intent.isRecap && games.length > 0 && games[0].status === 'final') {
          const game = games[0];
          // Fetch boxscore for the game to get top players
          const boxscore = await fetchGameBoxscore(game.gameId);
          
          if (boxscore) {
            // Get top 3 players by points from each team
            const sortByPoints = (players: any[]) => 
              [...players]
                .filter(p => p.minutes && p.minutes !== '0' && p.minutes !== '0:00')
                .sort((a, b) => b.points - a.points)
                .slice(0, 3);
            
            const homeTopPlayers = sortByPoints(boxscore.homePlayers).map(p => ({
              name: p.name,
              headshot: p.headshot || `https://a.espncdn.com/i/headshots/nba/players/full/${p.playerId || 0}.png`,
              minutes: p.minutes,
              points: Math.max(0, p.points),
              rebounds: Math.max(0, p.rebounds),
              assists: Math.max(0, p.assists),
              fg3m: Math.max(0, p.fg3m),
              fg3a: Math.max(0, p.fg3a),
              fgm: Math.max(0, p.fgm),
              fga: Math.max(0, p.fga),
              plusMinus: p.plusMinus,
            }));
            
            const awayTopPlayers = sortByPoints(boxscore.awayPlayers).map(p => ({
              name: p.name,
              headshot: p.headshot || `https://a.espncdn.com/i/headshots/nba/players/full/${p.playerId || 0}.png`,
              minutes: p.minutes,
              points: Math.max(0, p.points),
              rebounds: Math.max(0, p.rebounds),
              assists: Math.max(0, p.assists),
              fg3m: Math.max(0, p.fg3m),
              fg3a: Math.max(0, p.fg3a),
              fgm: Math.max(0, p.fgm),
              fga: Math.max(0, p.fga),
              plusMinus: p.plusMinus,
            }));
            
            return {
              type: 'gameRecap',
              data: {
                gameId: game.gameId,
                homeTeam: {
                  name: game.homeTeam.name,
                  abbreviation: game.homeTeam.abbreviation,
                  logo: `https://a.espncdn.com/i/teamlogos/nba/500/${game.homeTeam.abbreviation.toLowerCase()}.png`,
                  score: game.homeTeam.score,
                  record: game.homeTeam.record,
                  topPlayers: homeTopPlayers,
                },
                awayTeam: {
                  name: game.awayTeam.name,
                  abbreviation: game.awayTeam.abbreviation,
                  logo: `https://a.espncdn.com/i/teamlogos/nba/500/${game.awayTeam.abbreviation.toLowerCase()}.png`,
                  score: game.awayTeam.score,
                  record: game.awayTeam.record,
                  topPlayers: awayTopPlayers,
                },
                status: 'final',
                venue: game.venue,
                broadcast: game.broadcast,
                date: game.gameDate,
              },
            };
          }
        }

        const gamesResponse: AIVisualResponse = {
          type: 'games',
          data: games.map(convertGameToVisual),
          dateDisplay,
        };
        return gamesResponse;
      }

      case 'standings': {
        const standingsData = await fetchStandings();
        const result: VisualStandingsData[] = [];

        if (intent.conference !== 'west' && standingsData.east.length > 0) {
          result.push({
            conference: 'East',
            teams: standingsData.east.map((team, i) => ({
              rank: i + 1,
              name: team.name,
              abbreviation: team.abbreviation,
              logo: `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation.toLowerCase()}.png`,
              wins: team.wins,
              losses: team.losses,
              winPct: team.winPct,
              gamesBehind: team.gamesBehind,
              streak: team.streak,
              isPlayoff: i < 6,
              isPlayIn: i >= 6 && i < 10,
            })),
          });
        }

        if (intent.conference !== 'east' && standingsData.west.length > 0) {
          result.push({
            conference: 'West',
            teams: standingsData.west.map((team, i) => ({
              rank: i + 1,
              name: team.name,
              abbreviation: team.abbreviation,
              logo: `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation.toLowerCase()}.png`,
              wins: team.wins,
              losses: team.losses,
              winPct: team.winPct,
              gamesBehind: team.gamesBehind,
              streak: team.streak,
              isPlayoff: i < 6,
              isPlayIn: i >= 6 && i < 10,
            })),
          });
        }

        if (result.length === 0) return null;

        return { type: 'standings', data: result };
      }

      case 'player': {
        const player = await fetchFullPlayerData(intent.name, intent.season);
        if (!player) {
          // Always return a visual for player queries, even if data fetch fails
          // Return a minimal player object so the visual can still be shown
          return {
            type: 'player',
            data: {
              id: '',
              name: intent.name,
              team: 'Unknown',
              teamLogo: '',
              headshot: '',
              position: '',
              stats: { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0, mpg: 0 },
            },
          };
        }

        // Check if player has game stats from today
        const boxscores = await fetchAllBoxscores(liveData.games as LiveGameData[]);
        for (const game of boxscores) {
          const allPlayers = [...game.homePlayers, ...game.awayPlayers];
          const playerStats = allPlayers.find(p =>
            p.name.toLowerCase().includes(player.name.toLowerCase().split(' ')[1] || player.name.toLowerCase()) ||
            player.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[1] || p.name.toLowerCase())
          );

          if (playerStats) {
            const rawGameStats = {
              points: playerStats.points,
              rebounds: playerStats.rebounds,
              assists: playerStats.assists,
              steals: playerStats.steals,
              blocks: playerStats.blocks,
              minutes: playerStats.minutes,
              fgm: playerStats.fgm,
              fga: playerStats.fga,
              fg3m: playerStats.fg3m,
              fg3a: playerStats.fg3a,
            };
            player.gameStats = validateGameStats(rawGameStats) as typeof rawGameStats;
            break;
          }
        }

        return { type: 'player', data: player };
      }

      case 'comparison': {
        // Fetch player data
        const [player1, player2] = await Promise.all([
          fetchFullPlayerData(intent.player1),
          fetchFullPlayerData(intent.player2),
        ]);

        // If game context is provided, fetch game-specific stats
        if (intent.gameContext?.team1 && intent.gameContext?.team2) {
          console.log(`[Comparison] Fetching game stats for ${intent.gameContext.team1} vs ${intent.gameContext.team2}`);

          const gameMatch = await findGameByTeams(
            intent.gameContext.team1,
            intent.gameContext.team2,
            intent.gameContext.date
          );

          if (gameMatch) {
            console.log(`[Comparison] Found game: ${gameMatch.gameId}`);
            const gameDetail = await fetchGameDetail(gameMatch.gameId);

            if (gameDetail) {
              // Find player stats in the game
              const allGamePlayers = [...gameDetail.homeStats, ...gameDetail.awayStats];

              // Match player1
              if (player1) {
                const p1GameStats = allGamePlayers.find(p => {
                  const pName = (p.player?.displayName || p.player?.name || '').toLowerCase();
                  const searchName = player1.name.toLowerCase();
                  return pName === searchName ||
                    pName.includes(searchName.split(' ')[1] || searchName) ||
                    searchName.includes(pName.split(' ')[1] || pName);
                });

                if (p1GameStats) {
                  const rawGameStats = {
                    points: p1GameStats.points,
                    rebounds: p1GameStats.rebounds,
                    assists: p1GameStats.assists,
                    steals: p1GameStats.steals,
                    blocks: p1GameStats.blocks,
                    minutes: p1GameStats.minutes,
                    fgm: p1GameStats.fgm,
                    fga: p1GameStats.fga,
                    fg3m: p1GameStats.fg3m,
                    fg3a: p1GameStats.fg3a,
                  };
                  player1.gameStats = validateGameStats(rawGameStats) as typeof rawGameStats;
                  console.log(`[Comparison] Found game stats for ${player1.name}`);
                }
              }

              // Match player2
              if (player2) {
                const p2GameStats = allGamePlayers.find(p => {
                  const pName = (p.player?.displayName || p.player?.name || '').toLowerCase();
                  const searchName = player2.name.toLowerCase();
                  return pName === searchName ||
                    pName.includes(searchName.split(' ')[1] || searchName) ||
                    searchName.includes(pName.split(' ')[1] || pName);
                });

                if (p2GameStats) {
                  const rawGameStats = {
                    points: p2GameStats.points,
                    rebounds: p2GameStats.rebounds,
                    assists: p2GameStats.assists,
                    steals: p2GameStats.steals,
                    blocks: p2GameStats.blocks,
                    minutes: p2GameStats.minutes,
                    fgm: p2GameStats.fgm,
                    fga: p2GameStats.fga,
                    fg3m: p2GameStats.fg3m,
                    fg3a: p2GameStats.fg3a,
                  };
                  player2.gameStats = validateGameStats(rawGameStats) as typeof rawGameStats;
                  console.log(`[Comparison] Found game stats for ${player2.name}`);
                }
              }
            }
          }
        }

        // Always return a visual for comparison queries, even if data fetch fails
        // Use fetched data or create minimal placeholder objects
        // IMPORTANT: Use the properly formatted name from searchPlayer, not the raw intent
        // If player wasn't found, try to format the name properly
        const formatPlayerName = (name: string) => {
          // Remove common prefixes/suffixes
          let cleaned = name
            .replace(/^(?:tell me about|show me|what about|who is|stats for|statistics for)\s+/i, '')
            .replace(/\s+(?:stats|statistics|performance|numbers|averages).*$/i, '')
            .trim();
          // Capitalize properly
          return cleaned.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        };

        const p1 = player1 || {
          id: '',
          name: formatPlayerName(intent.player1),
          team: 'Unknown',
          teamLogo: '',
          headshot: '',
          position: '',
          stats: { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0, mpg: 0 },
        };

        const p2 = player2 || {
          id: '',
          name: formatPlayerName(intent.player2),
          team: 'Unknown',
          teamLogo: '',
          headshot: '',
          position: '',
          stats: { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, fg3Pct: 0, ftPct: 0, mpg: 0 },
        };

        // Format percentages correctly - stats come as percentages already (e.g., 51.26 not 0.5126)
        const formatPct = (val: number) => val > 1 ? val.toFixed(1) + '%' : (val * 100).toFixed(1) + '%';

        const categories: PlayerComparisonVisual['categories'] = [
          { name: 'PPG', player1Value: p1.stats.ppg?.toFixed(1) || '0.0', player2Value: p2.stats.ppg?.toFixed(1) || '0.0', winner: (p1.stats.ppg || 0) > (p2.stats.ppg || 0) ? 'player1' : (p2.stats.ppg || 0) > (p1.stats.ppg || 0) ? 'player2' : 'tie' },
          { name: 'RPG', player1Value: p1.stats.rpg?.toFixed(1) || '0.0', player2Value: p2.stats.rpg?.toFixed(1) || '0.0', winner: (p1.stats.rpg || 0) > (p2.stats.rpg || 0) ? 'player1' : (p2.stats.rpg || 0) > (p1.stats.rpg || 0) ? 'player2' : 'tie' },
          { name: 'APG', player1Value: p1.stats.apg?.toFixed(1) || '0.0', player2Value: p2.stats.apg?.toFixed(1) || '0.0', winner: (p1.stats.apg || 0) > (p2.stats.apg || 0) ? 'player1' : (p2.stats.apg || 0) > (p1.stats.apg || 0) ? 'player2' : 'tie' },
          { name: 'SPG', player1Value: p1.stats.spg?.toFixed(1) || '0.0', player2Value: p2.stats.spg?.toFixed(1) || '0.0', winner: (p1.stats.spg || 0) > (p2.stats.spg || 0) ? 'player1' : (p2.stats.spg || 0) > (p1.stats.spg || 0) ? 'player2' : 'tie' },
          { name: 'BPG', player1Value: p1.stats.bpg?.toFixed(1) || '0.0', player2Value: p2.stats.bpg?.toFixed(1) || '0.0', winner: (p1.stats.bpg || 0) > (p2.stats.bpg || 0) ? 'player1' : (p2.stats.bpg || 0) > (p1.stats.bpg || 0) ? 'player2' : 'tie' },
          { name: 'FG%', player1Value: formatPct(p1.stats.fgPct || 0), player2Value: formatPct(p2.stats.fgPct || 0), winner: (p1.stats.fgPct || 0) > (p2.stats.fgPct || 0) ? 'player1' : (p2.stats.fgPct || 0) > (p1.stats.fgPct || 0) ? 'player2' : 'tie' },
          { name: '3P%', player1Value: formatPct(p1.stats.fg3Pct || 0), player2Value: formatPct(p2.stats.fg3Pct || 0), winner: (p1.stats.fg3Pct || 0) > (p2.stats.fg3Pct || 0) ? 'player1' : (p2.stats.fg3Pct || 0) > (p1.stats.fg3Pct || 0) ? 'player2' : 'tie' },
          { name: 'FT%', player1Value: formatPct(p1.stats.ftPct || 0), player2Value: formatPct(p2.stats.ftPct || 0), winner: (p1.stats.ftPct || 0) > (p2.stats.ftPct || 0) ? 'player1' : (p2.stats.ftPct || 0) > (p1.stats.ftPct || 0) ? 'player2' : 'tie' },
        ];

        return {
          type: 'comparison',
          data: {
            player1: p1,
            player2: p2,
            verdict: '', // Will be filled by AI
            categories,
          },
        };
      }

      default:
        return null;
    }
  } catch (error) {
    console.error('[Visual Response] Error generating visual:', error);
    return null;
  }
}

// ============================================
// GEMINI AI CONFIGURATION
// ============================================

import { createHash } from 'crypto';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Log API key info at startup (for debugging quota issues)
function logApiKeyInfo() {
  if (!GEMINI_API_KEY) {
    console.warn('[AI Chat] ⚠️ GEMINI_API_KEY not set');
    return;
  }
  const keyHash = createHash('sha256').update(GEMINI_API_KEY).digest('hex').substring(0, 12);
  const keyPrefix = GEMINI_API_KEY.substring(0, 8);
  console.log(`[AI Chat] 🔑 API Key: ${keyPrefix}... (hash: ${keyHash}, len: ${GEMINI_API_KEY.length})`);
}

// Log API key status (without exposing the actual key)
console.log('[AI Module] GEMINI_API_KEY status:', GEMINI_API_KEY ? `Present (length: ${GEMINI_API_KEY.length})` : 'Missing');

let ai: GoogleGenAI | null = null;
try {
  logApiKeyInfo();
  // Try with explicit API key first, fallback to empty object (reads from env)
  ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : new GoogleGenAI({});
  console.log('[AI Module] GoogleGenAI initialized successfully');
} catch (e) {
  console.error('[AI Module] Failed to initialize GoogleGenAI:', e);
  ai = null;
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
];

let currentModelIndex = 0;

// ============================================
// OPTIMIZED PROMPT SYSTEM
// Static base prompt cached once, personality deltas added as needed
// This reduces input tokens by ~30-40% compared to sending full prompts
// ============================================

const STATIC_SYSTEM_PROMPT = `You are Playmaker AI - a concise, accurate sports assistant.

RULES:
- BE CONCISE. Users want quick info, not essays.
- Use EXACT numbers from provided data - never invent stats
- Lead with the score/result, then key performers
- Skip fluff words, headers, and repetition

FORMAT: Score first → top performers → one key insight. Done.`;

// Small personality deltas - only the style differences, not repeated core instructions
const PERSONALITY_DELTAS: Record<string, string> = {
  default: '', // Base personality, no delta needed
  
  hype: `STYLE: HIGH ENERGY! Use caps for KEY STATS, 🔥 emojis for hot streaks. Example: "Luka dropped 45 POINTS! That's INSANE!" Keep energy HIGH, numbers ACCURATE.`,
  
  drunk: `STYLE: Casual bar-talk delivery. "Oh Luka? Dude's averaging like 33 and 9, crazy right?" Use casual language, still accurate with numbers.`,
  
  announcer: `STYLE: Broadcaster drama like Mike Breen. "What a PERFORMANCE!" Use gravitas: "Forty-five points, twelve assists." Add phrases: "Down the stretch!", "He's on fire!"`,
  
  analyst: `STYLE: Advanced metrics focus. Lead with PER, BPM, TS%, eFG%. Explain what numbers MEAN: "His 28.4 PER ranks 4th, indicating elite impact." Reference pace, ratings, percentiles.`,
};

// Legacy full prompts for backwards compatibility (will be removed in future)
const PERSONALITY_PROMPTS: Record<string, string> = {
  default: STATIC_SYSTEM_PROMPT,
  hype: `${STATIC_SYSTEM_PROMPT}\n\n${PERSONALITY_DELTAS.hype}`,
  drunk: `${STATIC_SYSTEM_PROMPT}\n\n${PERSONALITY_DELTAS.drunk}`,
  announcer: `${STATIC_SYSTEM_PROMPT}\n\n${PERSONALITY_DELTAS.announcer}`,
  analyst: `${STATIC_SYSTEM_PROMPT}\n\n${PERSONALITY_DELTAS.analyst}`,
};

const LENGTH_CONFIG: Record<string, { maxTokens: number; instruction: string }> = {
  short: { 
    maxTokens: 80, 
    instruction: 'STRICT: 1-2 sentences ONLY. Example: "Mavs 138, Jazz 120. Klay Thompson led with 23 points as Dallas dominated at home." NO headers, NO bullets, NO paragraphs.' 
  },
  medium: { 
    maxTokens: 200, 
    instruction: 'STRICT: 3-5 sentences MAX. Lead with score, add 1-2 key performers, one insight. NO headers, NO sections, NO essays. Keep it scannable.' 
  },
  long: { 
    maxTokens: 400, 
    instruction: 'Detailed but focused. Use bullet points for stats. Max 2-3 short paragraphs. Still prioritize readability over completeness.' 
  },
};

// ============================================
// API REQUEST HANDLER
// ============================================

interface ChatRequest {
  message: string;
  personality?: 'default' | 'hype' | 'drunk' | 'announcer' | 'analyst';
  length?: 'short' | 'medium' | 'long';
  type?: 'general' | 'game' | 'team';
  requestVisuals?: boolean;
  gameId?: string; // Specific game ID for fetching that game's boxscore
  gameContext?: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    period: number | null;
    gameClock: string | null;
    status: string;
  };
  teamContext?: {
    teamName: string;
    teamAbbreviation: string;
    record: string;
    stats: {
      ppg: string;
      oppg: string;
      rpg: string;
      apg: string;
      fgPct: string;
      fg3Pct: string;
      ftPct: string;
    };
  };
}

export async function POST(request: Request) {
  console.log('[AI Chat] Received request');

  let parsedMessage = '';

  try {
    let body: ChatRequest;
    try {
      body = await request.json();
      parsedMessage = body.message || '';
    } catch (parseError) {
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        response: "I couldn't understand your request. Please try again!"
      }, { status: 400 });
    }

    const {
      message,
      personality = 'default',
      length = 'medium',
      type = 'general',
      requestVisuals = true,
      gameId: requestGameId, // Game ID passed from the game page
      gameContext,
      teamContext
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Detect user intent - but override with specific game if gameId is provided
    let intent = detectUserIntent(message);
    console.log('[AI Chat] Detected intent:', intent.type);
    
    // If a specific gameId is provided from the game page, use it to ensure we fetch that game's data
    // This overrides the intent to ensure we always have the correct game's boxscore
    if (requestGameId && type === 'game') {
      console.log(`[AI Chat] Game page provided gameId: ${requestGameId}, overriding to fetch specific game`);
      intent = { type: 'specificGame', gameId: requestGameId };
    }

    // Reinitialize ai if needed
    let chatAI = ai;
    if (!chatAI) {
      try {
        console.log('[AI Chat] Reinitializing GoogleGenAI...');
        chatAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : new GoogleGenAI({});
        console.log('[AI Chat] GoogleGenAI reinitialized successfully');
      } catch (initError) {
        console.error('[AI Chat] Failed to reinitialize ai:', initError);
        console.error('[AI Chat] Init error details:', initError instanceof Error ? initError.stack : initError);
      }
    }

    if (!chatAI) {
      console.error('[AI Chat] No AI client available. API key:', GEMINI_API_KEY ? 'Present but failed to initialize' : 'Missing');
    }

    // Fetch data based on intent - handle date-specific queries
    console.log('[AI Chat] Detected intent:', intent.type);
    let liveData;
    let liveContext;
    let dateContext = '';

    try {
      // Handle specific game ID queries (for historical games)
      if (intent.type === 'specificGame') {
        const gameId = intent.gameId;
        console.log(`[AI Chat] Fetching specific game: ${gameId}`);
        
        // Fetch the specific game's boxscore directly
        const boxscore = await fetchGameBoxscore(gameId);
        
        if (boxscore) {
          // Create a game data structure from the boxscore
          const gameData: LiveGameData = {
            gameId: boxscore.gameId,
            homeTeam: {
              name: boxscore.homeTeam,
              abbreviation: boxscore.homeTeam,
              score: boxscore.homeScore,
            },
            awayTeam: {
              name: boxscore.awayTeam,
              abbreviation: boxscore.awayTeam,
              score: boxscore.awayScore,
            },
            status: boxscore.status.toLowerCase().includes('final') ? 'final' : 
                    boxscore.status.toLowerCase().includes('progress') ? 'live' : 'scheduled',
            period: 0,
            clock: '',
          };
          
          liveData = {
            games: [gameData],
            lastUpdated: new Date().toISOString(),
            source: 'ESPN API',
            sourceUrl: `https://www.espn.com/nba/game/_/gameId/${gameId}`,
          };
          
          liveContext = buildAIContext(liveData, [boxscore]);
          dateContext = `\n\nGAME CONTEXT: User is asking about a specific game (ID: ${gameId}). The boxscore data with individual player statistics is provided below.\n`;
          
          console.log(`[AI Chat] Loaded boxscore for game ${gameId}: ${boxscore.awayTeam} ${boxscore.awayScore} @ ${boxscore.homeTeam} ${boxscore.homeScore}`);
          console.log(`[AI Chat] Players loaded: ${boxscore.awayPlayers.length + boxscore.homePlayers.length}`);
        } else {
          console.log(`[AI Chat] Could not fetch boxscore for game ${gameId}`);
          liveData = { games: [], lastUpdated: new Date().toISOString(), source: 'ESPN API', sourceUrl: 'https://www.espn.com/nba/' };
          liveContext = `Could not fetch data for game ${gameId}. The game may not exist or data is unavailable.`;
        }
      }
      // Handle date-specific game queries
      else if (intent.type === 'games' && intent.filter === 'date' && intent.date) {
        console.log(`[AI Chat] Fetching games for date: ${intent.dateDisplay || intent.date}`);

        // If "last week" or similar, search a range of dates (7 days back)
        let gamesToSearch: string[] = [intent.date];
        if (intent.dateDisplay?.toLowerCase().includes('last week') || intent.dateDisplay?.toLowerCase().includes('week')) {
          // Search the entire week (7 days)
          const baseDate = new Date(intent.date.substring(0, 4) + '-' + intent.date.substring(4, 6) + '-' + intent.date.substring(6, 8));
          for (let i = 0; i < 7; i++) {
            const searchDate = new Date(baseDate);
            searchDate.setDate(searchDate.getDate() - i);
            const dateStr = searchDate.toISOString().split('T')[0].replace(/-/g, '');
            gamesToSearch.push(dateStr);
          }
        }

        // Fetch games from all dates in the range
        const allGames: LiveGameData[] = [];
        for (const dateStr of gamesToSearch) {
          try {
            const dateData = await fetchScoresByDate(dateStr);
            allGames.push(...dateData.games);
          } catch (error) {
            // Continue if one date fails
            continue;
          }
        }

        // Filter by team if specified
        let filteredGames = allGames;
        if (intent.team) {
          filteredGames = allGames.filter(g =>
            g.homeTeam.abbreviation === intent.team ||
            g.awayTeam.abbreviation === intent.team
          );
        }

        liveData = {
          games: filteredGames,
          lastUpdated: new Date().toISOString(),
          source: 'ESPN API',
          sourceUrl: 'https://www.espn.com/nba/',
        };
        // Check if this is a future date
        const parsedDate = parseNaturalDate(intent.date || '');
        const isFutureDate = parsedDate?.isFuture || intent.dateDisplay === 'Tomorrow' || intent.dateDisplay?.toLowerCase().includes('next');

        dateContext = `\n\nDATE CONTEXT: User is asking about games ${intent.team ? `involving ${intent.team} ` : ''}on ${intent.dateDisplay || intent.date}. This is ${intent.dateDisplay === 'Today' ? 'today' : intent.dateDisplay === 'Tomorrow' ? 'tomorrow' : intent.dateDisplay === 'Yesterday' ? 'yesterday' : intent.dateDisplay?.toLowerCase().includes('last week') ? 'from last week' : `on ${intent.dateDisplay}`}.\n`;

        // For future dates, explicitly tell AI to use its knowledge of NBA schedules
        if (isFutureDate && filteredGames.length === 0) {
          dateContext += `\n**CRITICAL FOR FUTURE DATE QUERIES:** This is a FUTURE date. The API may not have schedule data yet, but YOU HAVE KNOWLEDGE of NBA schedules. Use your extensive knowledge base to answer about scheduled games for this date. NBA games typically occur daily during the regular season (mid-October to mid-April). Even if the API shows 0 games, you can provide schedule information based on:\n`;
          dateContext += `- Team schedules and typical NBA schedule patterns\n`;
          dateContext += `- Regular season game frequency (NBA plays most days)\n`;
          dateContext += `- Your knowledge of announced schedules, fixtures, and typical league patterns\n`;
          dateContext += `- If you know specific games are scheduled for this date, list them with teams, times, and venues\n`;
          dateContext += `- DO NOT say "no games scheduled" unless you're certain - NBA plays almost daily during the regular season\n`;
        }

        console.log(`[AI Chat] Found ${filteredGames.length} games ${intent.team ? `for ${intent.team} ` : ''}${intent.dateDisplay ? `on ${intent.dateDisplay}` : ''} (Future date: ${isFutureDate})`);

        // Fetch boxscores for completed games
        const completedGames = filteredGames.filter(g => g.status === 'final');
        if (completedGames.length > 0) {
          console.log(`[AI Chat] Fetching boxscores for ${completedGames.length} completed games`);
          const boxscores = await fetchAllBoxscores(completedGames);
          liveContext = buildAIContext(liveData, boxscores);
        } else {
          console.log(`[AI Chat] No completed games found, building context without boxscores`);
          liveContext = buildAIContext(liveData, []);
        }
      }
      // Handle recap queries - search recent games (last 7 days) for the team
      else if (intent.type === 'games' && intent.filter === 'recentGames' && intent.team) {
        console.log(`[AI Chat] Searching recent games for ${intent.team} (last 7 days)`);

        // Search the last 7 days for games involving this team
        const today = new Date();
        const allGames: LiveGameData[] = [];
        
        for (let i = 0; i < 7; i++) {
          const searchDate = new Date(today);
          searchDate.setDate(searchDate.getDate() - i);
          const dateStr = searchDate.toISOString().split('T')[0].replace(/-/g, '');
          
          try {
            const dateData = await fetchScoresByDate(dateStr);
            // Filter to only include games for the specified team
            const teamGames = dateData.games.filter(g =>
              g.homeTeam.abbreviation === intent.team ||
              g.awayTeam.abbreviation === intent.team
            );
            allGames.push(...teamGames);
          } catch (error) {
            // Continue if one date fails
            continue;
          }
        }

        // Sort games by date (most recent first) and find completed games
        const completedGames = allGames.filter(g => g.status === 'final');
        
        if (completedGames.length > 0) {
          // Use the most recent completed game for recap
          const mostRecentGame = completedGames[0]; // Already sorted by date (most recent first)
          console.log(`[AI Chat] Found ${completedGames.length} completed games for ${intent.team}, using most recent: ${mostRecentGame.gameId}`);
          
          liveData = {
            games: [mostRecentGame],
            lastUpdated: new Date().toISOString(),
            source: 'ESPN API',
            sourceUrl: 'https://www.espn.com/nba/',
          };
          
          // Fetch boxscore for the most recent game
          const boxscores = await fetchAllBoxscores([mostRecentGame]);
          liveContext = buildAIContext(liveData, boxscores);
          
          dateContext = `\n\nRECAP CONTEXT: User asked for a recap of ${intent.team}'s game. Found their most recent completed game. Provide a detailed recap with key moments, top performers, and analysis.\n`;
        } else if (allGames.length > 0) {
          // Found scheduled/live games but no completed ones
          console.log(`[AI Chat] Found ${allGames.length} games for ${intent.team}, but none completed yet`);
          liveData = {
            games: allGames,
            lastUpdated: new Date().toISOString(),
            source: 'ESPN API',
            sourceUrl: 'https://www.espn.com/nba/',
          };
          liveContext = buildAIContext(liveData, []);
          dateContext = `\n\nRECAP CONTEXT: User asked for a recap of ${intent.team}'s game, but their recent games haven't finished yet. Show them the current status of their upcoming/live games.\n`;
        } else {
          // No games found in last 7 days
          console.log(`[AI Chat] No games found for ${intent.team} in the last 7 days`);
          liveData = {
            games: [],
            lastUpdated: new Date().toISOString(),
            source: 'ESPN API',
            sourceUrl: 'https://www.espn.com/nba/',
          };
          liveContext = `No ${intent.team} games found in the last 7 days.`;
          dateContext = `\n\nRECAP CONTEXT: User asked for a recap of ${intent.team}'s game, but no games were found in the last 7 days. Let the user know and suggest checking the team's schedule.\n`;
        }
      } else {
        // Default: fetch today's live data
        console.log('[AI Chat] Fetching live NBA data and boxscores...');
        liveData = await fetchAllLiveData();

        // Fetch detailed boxscores for live/final games to get individual player stats
        const boxscores = await fetchAllBoxscores(liveData.games);
        console.log(`[AI Chat] Fetched ${boxscores.length} game boxscores with individual player stats`);

        liveContext = buildAIContext(liveData, boxscores);
      }
    } catch (dataError) {
      console.error('[AI Chat] Failed to fetch data:', dataError);
      liveData = { games: [], lastUpdated: new Date().toISOString(), source: 'ESPN (unavailable)', sourceUrl: 'https://www.espn.com/nba/' };
      liveContext = 'Data unavailable.';
    }

    // Generate visual response based on intent
    let visualResponse: AIVisualResponse | null = null;
    if (requestVisuals && intent.type !== 'general') {
      console.log('[AI Chat] Generating visual response for intent:', intent.type);
      visualResponse = await generateVisualResponse(intent, liveData);
      console.log('[AI Chat] Visual response generated:', !!visualResponse);
    }

    // Build context for AI based on visual data
    let visualContext = '';
    if (visualResponse) {
      switch (visualResponse.type) {
        case 'games':
          // Check if this is a future date query with 0 games from API
          const isFutureQuery = intent.type === 'games' && intent.filter === 'date' &&
            (intent.dateDisplay === 'Tomorrow' || intent.dateDisplay?.toLowerCase().includes('next') ||
              (parseNaturalDate(intent.date || '')?.isFuture ?? false));

          if (visualResponse.data.length === 0 && isFutureQuery) {
            const dateDisplayValue = intent.type === 'games' ? (intent.dateDisplay || intent.date) : '';
            visualContext = `\n\nVISUAL DATA BEING SHOWN TO USER:\nThe API returned 0 games for this future date (${dateDisplayValue}), but the user will see a games grid.\n\n`;
            visualContext += `**CRITICAL: This is a FUTURE DATE query. The user asked about games on ${dateDisplayValue}.\n`;
            visualContext += `You MUST use your knowledge of NBA schedules to answer. The NBA plays games almost daily during the regular season.\n`;
            visualContext += `Even if the API shows 0 games, you have knowledge of scheduled games, fixtures, and typical NBA schedule patterns.\n\n`;
            visualContext += `**YOU MUST PROVIDE THE GAME DATA IN JSON FORMAT** so the visual can be updated correctly.\n`;
            visualContext += `At the very end of your response, include a JSON block with the scheduled games you know for this date:\n\n`;
            visualContext += `\`\`\`json\n{"scheduledGames": [\n`;
            visualContext += `  {"awayTeam": "DET", "homeTeam": "NYK", "awayRecord": "28-9", "homeRecord": "24-13", "venue": "Madison Square Garden", "broadcast": "ESPN", "status": "scheduled"},\n`;
            visualContext += `  {"awayTeam": "OKC", "homeTeam": "LAL", "awayRecord": "30-7", "homeRecord": "22-15", "venue": "Crypto.com Arena", "broadcast": "NBA TV", "status": "scheduled"}\n`;
            visualContext += `]}\n\`\`\`\n\n`;
            visualContext += `IMPORTANT: Use official team abbreviations (e.g., DET, NYK, LAL, OKC, BOS, PHI, etc.). Include records if you know them. `;
            visualContext += `Status should be "scheduled" for future games. `;
            visualContext += `List ALL games you know are scheduled for this date. `;
            visualContext += `DO NOT say "no games scheduled" unless you're absolutely certain (e.g., All-Star break, league-wide off days).**\n`;
          } else {
            visualContext = `\n\nVISUAL DATA BEING SHOWN TO USER:\nThe user will see a visual grid of ${visualResponse.data.length} games. Here are the games:\n`;
            visualResponse.data.forEach(g => {
              visualContext += `- ${g.awayTeam.abbreviation} ${g.awayTeam.score} @ ${g.homeTeam.abbreviation} ${g.homeTeam.score} (${g.status})\n`;
            });
          }

          // If user asked for a recap, provide detailed game recap
          const isRecapQuery = message.toLowerCase().includes('recap') || message.toLowerCase().includes('summary');
          if (isRecapQuery && visualResponse.data.length > 0) {
            visualContext += '\n\nCRITICAL: The user asked for a RECAP. Provide a detailed, engaging recap of the game(s) shown above. Include:\n';
            visualContext += '- Key moments and turning points\n';
            visualContext += '- Top performers and their stats\n';
            visualContext += '- Game flow and momentum shifts\n';
            visualContext += '- Final score and outcome\n';
            visualContext += '- Analysis of what decided the game\n';
            visualContext += 'DO NOT just list scores - provide narrative and analysis.';
          } else {
            visualContext += '\nProvide commentary on these games. DO NOT list the scores again - the user can see them in the visual.';
          }
          break;
        case 'standings':
          visualContext = `\n\nVISUAL DATA BEING SHOWN TO USER:\nThe user will see standings tables. Provide analysis and insights about the standings. DO NOT list the rankings again.`;
          break;
        case 'player':
          const p = visualResponse.data;
          const requestedSeason = (intent as any).seasonDisplay || (intent as any).season
            ? `the ${(intent as any).seasonDisplay || `${(intent as any).season}-${String((intent as any).season! + 1).slice(-2)}`} season`
            : 'the current 2025-26 season';
          visualContext = `\n\nVISUAL DATA BEING SHOWN TO USER:\nThe user will see a player card for ${p.name} (${p.team}) with the following ESPN stats:\n`;
          visualContext += `- PPG: ${p.stats.ppg}, RPG: ${p.stats.rpg}, APG: ${p.stats.apg}\n`;
          visualContext += `- SPG: ${p.stats.spg}, BPG: ${p.stats.bpg}, MPG: ${p.stats.mpg}\n`;
          visualContext += `- FG%: ${p.stats.fgPct}%, 3P%: ${p.stats.fg3Pct}%, FT%: ${p.stats.ftPct}%\n`;
          visualContext += `- Games Played: ${p.stats.gamesPlayed}\n\n`;
          visualContext += `CRITICAL: The user is asking about ${requestedSeason}. These ESPN stats may be incorrect, outdated, or from the wrong season. `;
          visualContext += `Use your extensive knowledge base to provide the CORRECT stats for ${p.name} for ${requestedSeason}. `;
          visualContext += `You MUST include the accurate stats at the very end of your response in this exact JSON format (no other text after the JSON):\n\n`;
          // Use the player's actual name and current team as a template to avoid AI copying wrong example data
          visualContext += `\`\`\`json\n{"correctedStats": {"ppg": <correct_ppg>, "rpg": <correct_rpg>, "apg": <correct_apg>, "spg": <correct_spg>, "bpg": <correct_bpg>, "mpg": <correct_mpg>, "fgPct": <correct_fg_pct>, "fg3Pct": <correct_3pt_pct>, "ftPct": <correct_ft_pct>, "gamesPlayed": <games_played>}, "team": "<correct_team_for_${requestedSeason}>"}\n\`\`\`\n\n`;
          visualContext += `IMPORTANT: Replace all <placeholders> with actual numeric values for ${p.name}. `;
          visualContext += `Include the "team" field with ${p.name}'s CORRECT team for ${requestedSeason} (NOT a placeholder). `;
          visualContext += `ALWAYS provide correctedStats JSON - use your knowledge base to provide accurate stats for the requested season. `;
          visualContext += `The corrected stats and team will automatically update the player card if provided.`;
          break;
        case 'comparison':
          const { player1, player2, categories } = visualResponse.data;
          const p1Wins = categories.filter(c => c.winner === 'player1').length;
          const p2Wins = categories.filter(c => c.winner === 'player2').length;
          visualContext = `\n\nVISUAL DATA BEING SHOWN TO USER:\nThe user will see a comparison card between ${player1.name} and ${player2.name}.\n`;
          visualContext += `${player1.name} wins ${p1Wins} categories, ${player2.name} wins ${p2Wins} categories.\n`;
          visualContext += 'Provide your VERDICT on who is better overall and WHY. Be specific about strengths/weaknesses. The user can see the raw numbers.';
          break;
      }
    }

    // If no AI configured, return visual-only response
    if (!chatAI) {
      return NextResponse.json({
        response: visualResponse ? "Here's what I found! Check out the data above. 📊" : "I'm having trouble connecting to my brain right now!",
        visual: visualResponse,
        model: 'none',
      });
    }

    // Get personality and length settings
    const personalityPrompt = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.default;
    const lengthSettings = LENGTH_CONFIG[length] || LENGTH_CONFIG.medium;

    // Build game-specific context if provided
    let gameSpecificContext = '';
    if (type === 'game' && gameContext) {
      gameSpecificContext = `\nSPECIFIC GAME FOCUS:\n${gameContext.awayTeam} @ ${gameContext.homeTeam}\nScore: ${gameContext.awayScore ?? 0} - ${gameContext.homeScore ?? 0}\nStatus: ${gameContext.status}`;
    }

    // Build team-specific context if provided
    let teamSpecificContext = '';
    if ((type === 'team' || teamContext) && teamContext) {
      teamSpecificContext = `\nTEAM: ${teamContext.teamName} (${teamContext.teamAbbreviation}) | Record: ${teamContext.record} | PPG: ${teamContext.stats.ppg} | OppPPG: ${teamContext.stats.oppg} | FG%: ${teamContext.stats.fgPct}`;
    }

    // Build the full prompt - OPTIMIZED for lower latency
    // Uses compact system prompt + personality delta instead of massive inline instructions
    // Reduces input tokens by ~60% compared to previous version
    const fullPrompt = `${STATIC_SYSTEM_PROMPT}
${PERSONALITY_DELTAS[personality] || ''}

${lengthSettings.instruction}
${dateContext ? `\nDATE CONTEXT: ${dateContext}` : ''}

CRITICAL ACCURACY RULE: For live/today's games, use ONLY exact numbers from data below. Never invent stats.
${visualContext ? '\nVISUAL NOTE: User sees rich visuals. Add analysis, not repetition.' : ''}

===== DATA =====
${liveContext}
===== END DATA =====
${gameSpecificContext}${teamSpecificContext}

USER: ${message}

Be concise. No essays.`;

    // Try models in order until one works
    let result;
    let usedModel = '';
    let lastError: Error | null = null;

    for (let i = currentModelIndex; i < GEMINI_MODELS.length; i++) {
      const modelName = GEMINI_MODELS[i];

      try {
        if (!chatAI) throw new Error('AI not initialized');

        console.log(`[AI Chat] Calling generateContent with model: ${modelName}`);
        console.log(`[AI Chat] Prompt length: ${fullPrompt.length} characters`);

        // Build request object - check if config is supported
        const requestParams: any = {
          model: modelName,
          contents: fullPrompt,
        };

        // Add optimized generation config
        // - topK: Limits sampling to top K tokens (reduces computation)
        // - topP: Nucleus sampling for quality (0.9 = top 90% probability mass)
        // - Temperature tuned per personality for speed vs creativity tradeoff
        requestParams.generationConfig = {
          maxOutputTokens: lengthSettings.maxTokens,
          temperature: personality === 'hype' ? 0.8 : personality === 'analyst' ? 0.2 : personality === 'drunk' ? 0.7 : 0.5,
          topK: 40,      // Faster sampling by limiting token choices
          topP: 0.9,     // Nucleus sampling for quality
        };

        console.log('[AI Chat] Request params:', JSON.stringify({
          model: requestParams.model,
          contentsLength: requestParams.contents?.length,
          hasGenerationConfig: !!requestParams.generationConfig,
        }));

        const response = await chatAI.models.generateContent(requestParams);

        console.log('[AI Chat] Response received:', {
          hasText: !!response.text,
          responseKeys: Object.keys(response || {}),
          responseType: typeof response,
        });

        // Handle different possible response structures
        let responseText = '';
        if (response && typeof response === 'object') {
          const responseAny = response as any;
          responseText = responseAny.text || responseAny.response?.text || responseAny.content || '';

          if (!responseText) {
            console.error('[AI Chat] No text found in response:', JSON.stringify(response, null, 2));
            throw new Error(`Invalid response from ${modelName}: no text content found`);
          }
        }

        // Create a response-like object with text property
        result = { text: responseText };
        usedModel = modelName;
        currentModelIndex = i;
        break;
      } catch (genError: any) {
        console.error(`[AI Chat] Model ${modelName} failed:`, genError?.message);
        console.error('[AI Chat] Full error object:', genError);
        if (genError?.stack) {
          console.error('[AI Chat] Error stack:', genError.stack);
        }
        lastError = genError;
      }
    }

    if (!result) {
      const errorDetails = lastError ? `${lastError.message || 'Unknown error'}. ${lastError.stack || ''}` : 'Unknown error';
      console.error('[AI Chat] All models failed. Last error details:', errorDetails);
      throw new Error(`All AI models failed. Last error: ${errorDetails}`);
    }

    const responseText = result.text || '';

    if (!responseText) {
      throw new Error('Received empty response from AI model');
    }

    let response = responseText;

    // If games visual response for future date with 0 games, check for scheduled games from Gemini
    if (visualResponse?.type === 'games' && visualResponse.data.length === 0) {
      const isFutureQuery = intent.type === 'games' && intent.filter === 'date' &&
        (intent.dateDisplay === 'Tomorrow' || intent.dateDisplay?.toLowerCase().includes('next') ||
          (parseNaturalDate(intent.date || '')?.isFuture ?? false));

      if (isFutureQuery) {
        // Try to extract scheduled games from Gemini's response
        const jsonBlockMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        const inlineJsonMatch = response.match(/\{"scheduledGames":\s*\[[\s\S]*?\]\}/);

        const jsonStr = jsonBlockMatch?.[1] || inlineJsonMatch?.[0];

        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.scheduledGames && Array.isArray(parsed.scheduledGames) && parsed.scheduledGames.length > 0) {
              console.log(`[AI Chat] Gemini provided ${parsed.scheduledGames.length} scheduled games for future date`);

              // Convert Gemini's scheduled games to visual format
              const scheduledGames: VisualGameData[] = parsed.scheduledGames.map((game: any) => {
                // Get team info from NBA_TEAMS
                const awayTeamData = Object.values(NBA_TEAMS).find(t =>
                  t.abbreviation.toUpperCase() === game.awayTeam?.toUpperCase()
                );
                const homeTeamData = Object.values(NBA_TEAMS).find(t =>
                  t.abbreviation.toUpperCase() === game.homeTeam?.toUpperCase()
                );

                if (!awayTeamData || !homeTeamData) {
                  console.warn(`[AI Chat] Could not find team data for ${game.awayTeam} or ${game.homeTeam}`);
                  return null;
                }

                // Parse records
                const awayRecord = game.awayRecord || '0-0';
                const homeRecord = game.homeRecord || '0-0';
                const [awayWins, awayLosses] = awayRecord.split('-').map((n: string) => parseInt(n) || 0);
                const [homeWins, homeLosses] = homeRecord.split('-').map((n: string) => parseInt(n) || 0);

                return {
                  gameId: `${game.awayTeam}-${game.homeTeam}-${intent.type === 'games' ? intent.date || '' : ''}`,
                  awayTeam: {
                    name: awayTeamData.name,
                    abbreviation: awayTeamData.abbreviation,
                    logo: `https://a.espncdn.com/i/teamlogos/nba/500/${awayTeamData.abbreviation.toLowerCase()}.png`,
                    score: 0,
                    record: awayRecord,
                  },
                  homeTeam: {
                    name: homeTeamData.name,
                    abbreviation: homeTeamData.abbreviation,
                    logo: `https://a.espncdn.com/i/teamlogos/nba/500/${homeTeamData.abbreviation.toLowerCase()}.png`,
                    score: 0,
                    record: homeRecord,
                  },
                  status: game.status || 'scheduled',
                  venue: game.venue || undefined,
                  broadcast: game.broadcast || undefined,
                };
              }).filter((game: VisualGameData | null): game is VisualGameData => game !== null);

              if (scheduledGames.length > 0) {
                // Update visual response with Gemini's scheduled games
                visualResponse.data = scheduledGames;
                visualResponse.dateDisplay = intent.type === 'games' ? intent.dateDisplay : undefined;

                console.log(`[AI Chat] Updated visual with ${scheduledGames.length} games from Gemini's knowledge:`,
                  scheduledGames.map(g => `${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation}`)
                );

                // Remove the JSON block from the response text so it doesn't show to user
                response = response.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '').replace(/\{"scheduledGames":\s*\[[\s\S]*?\]\}/g, '').trim();
              }
            }
          } catch (parseError) {
            console.error('[AI Chat] Failed to parse scheduled games from Gemini:', parseError);
            console.error('[AI Chat] JSON string attempted:', jsonStr);
          }
        } else {
          console.log(`[AI Chat] No scheduled games JSON found in Gemini response for future date`);
        }
      }
    }

    // If player visual response, check for corrected stats from Gemini
    if (visualResponse?.type === 'player') {
      // Try to extract corrected stats from Gemini's response
      // Match JSON code blocks or inline JSON
      const jsonBlockMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      const inlineJsonMatch = response.match(/\{"correctedStats":\s*\{[\s\S]*?\}(?:,\s*"team":\s*"[^"]*")?\}/);

      const jsonStr = jsonBlockMatch?.[1] || inlineJsonMatch?.[0];

      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.correctedStats && typeof parsed.correctedStats === 'object') {
            const corrected = parsed.correctedStats;
            const originalStats = { ...visualResponse.data.stats }; // Save original for logging
            const originalTeam = visualResponse.data.team;
            console.log(`[AI Chat] Gemini provided corrected stats:`, corrected);
            console.log(`[AI Chat] Original ESPN stats:`, originalStats);
            console.log(`[AI Chat] Original team:`, originalTeam);

            // Update visual response with corrected stats - ALWAYS use Gemini's values if provided
            const updatedStats: ExtendedPlayerStats = {
              ppg: corrected.ppg !== undefined ? corrected.ppg : originalStats.ppg,
              rpg: corrected.rpg !== undefined ? corrected.rpg : originalStats.rpg,
              apg: corrected.apg !== undefined ? corrected.apg : originalStats.apg,
              spg: corrected.spg !== undefined ? corrected.spg : originalStats.spg,
              bpg: corrected.bpg !== undefined ? corrected.bpg : originalStats.bpg,
              mpg: corrected.mpg !== undefined ? corrected.mpg : originalStats.mpg,
              fgPct: corrected.fgPct !== undefined ? corrected.fgPct : originalStats.fgPct,
              fg3Pct: corrected.fg3Pct !== undefined ? corrected.fg3Pct : originalStats.fg3Pct,
              ftPct: corrected.ftPct !== undefined ? corrected.ftPct : originalStats.ftPct,
              gamesPlayed: corrected.gamesPlayed !== undefined ? corrected.gamesPlayed : originalStats.gamesPlayed,
            };

            // Validate corrected stats
            const validatedStats = validatePlayerStats(updatedStats);
            visualResponse.data.stats = validatedStats;

            // Update team if provided by Gemini
            if (parsed.team && typeof parsed.team === 'string') {
              // Find the team logo for the corrected team
              const teamNameLower = parsed.team.toLowerCase();
              let team = Object.values(NBA_TEAMS).find(t =>
                t.name.toLowerCase() === teamNameLower ||
                t.abbreviation.toLowerCase() === teamNameLower
              );

              // Try partial matching if exact match failed
              if (!team) {
                for (const key of Object.keys(NBA_TEAMS)) {
                  const teamData = NBA_TEAMS[key];
                  if (teamNameLower.includes(key) || key.includes(teamNameLower.split(' ')[0]) ||
                    teamData.name.toLowerCase().includes(teamNameLower.split(' ')[0]) ||
                    teamNameLower.includes(teamData.name.toLowerCase().split(' ')[0])) {
                    team = teamData;
                    break;
                  }
                }
              }

              if (team) {
                visualResponse.data.team = team.name;
                visualResponse.data.teamLogo = `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation.toLowerCase()}.png`;
                console.log(`[AI Chat] Updated team from "${originalTeam}" to "${team.name}" (${team.abbreviation})`);
              } else {
                visualResponse.data.team = parsed.team;
                console.log(`[AI Chat] Updated team from "${originalTeam}" to "${parsed.team}" (exact match not found, using as-is)`);
              }
            }

            console.log(`[AI Chat] Updated player card with Gemini-corrected stats:`, {
              before: originalStats,
              after: validatedStats,
              teamBefore: originalTeam,
              teamAfter: visualResponse.data.team,
              changes: {
                ppg: originalStats.ppg !== validatedStats.ppg ? `${originalStats.ppg} → ${validatedStats.ppg}` : 'unchanged',
                rpg: originalStats.rpg !== validatedStats.rpg ? `${originalStats.rpg} → ${validatedStats.rpg}` : 'unchanged',
                apg: originalStats.apg !== validatedStats.apg ? `${originalStats.apg} → ${validatedStats.apg}` : 'unchanged',
                fgPct: originalStats.fgPct !== validatedStats.fgPct ? `${originalStats.fgPct}% → ${validatedStats.fgPct}%` : 'unchanged',
                fg3Pct: originalStats.fg3Pct !== validatedStats.fg3Pct ? `${originalStats.fg3Pct}% → ${validatedStats.fg3Pct}%` : 'unchanged',
                gamesPlayed: originalStats.gamesPlayed !== validatedStats.gamesPlayed ? `${originalStats.gamesPlayed} → ${validatedStats.gamesPlayed}` : 'unchanged',
              },
            });

            // Remove the JSON block from the response text so it doesn't show to user
            response = response.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '').replace(/\{"correctedStats":\s*\{[\s\S]*?\}(?:,\s*"team":\s*"[^"]*")?\}/g, '').trim();
          }
        } catch (parseError) {
          console.error('[AI Chat] Failed to parse corrected stats from Gemini:', parseError);
          console.error('[AI Chat] JSON string attempted:', jsonStr);
        }
      } else {
        console.log(`[AI Chat] No corrected stats JSON found in Gemini response for player`);
      }
    }

    // If comparison, add verdict to visual
    if (visualResponse?.type === 'comparison') {
      const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
      visualResponse.data.verdict = sentences.slice(-2).join('. ').trim() + '.';
    }

    return NextResponse.json({
      response,
      visual: visualResponse,
      model: usedModel,
      personality,
      length,
      intent: intent.type,
      dataSource: liveData.source,
      dataTimestamp: liveData.lastUpdated,
      gamesCount: liveData.games.length,
    });

  } catch (error) {
    const errorMsg = (error as Error).message;
    const errorStack = (error as Error).stack;
    console.error('[AI Chat Error] Full error:', errorMsg);
    console.error('[AI Chat Error] Stack trace:', errorStack);
    console.error('[AI Chat Error] Error object:', error);
    logger.error('AI chat error', { error: errorMsg, stack: errorStack });

    // Provide more helpful error message
    let userMessage = "I hit a snag! 🏀 Check ESPN.com for the latest: https://www.espn.com/nba/";
    if (errorMsg.includes('API key') || errorMsg.includes('GEMINI')) {
      userMessage = "I'm having trouble connecting to the AI service. Please check your API key configuration.";
    } else if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
      userMessage = "I'm having trouble fetching live data. Please try again in a moment.";
    }

    return NextResponse.json({
      response: userMessage,
      error: errorMsg,
      sourceUrl: 'https://www.espn.com/nba/',
    }, { status: 200 });
  }
}
