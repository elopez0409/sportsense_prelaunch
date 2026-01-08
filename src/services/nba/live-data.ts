// NBA Live Data Service - Fetches real-time data from public APIs
// Sources: ESPN API, NBA.com API, Basketball Reference

import { logger } from '@/lib/logger';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface GameLeaderStat {
  playerName: string;
  value: string;
  stat: string;
}

export interface LiveGameData {
  gameId: string;
  gameDate?: string;
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
    record?: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
    record?: string;
  };
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  period: number;
  clock: string;
  venue?: string;
  broadcast?: string;
  leaders?: {
    home: { points?: string; rebounds?: string; assists?: string };
    away: { points?: string; rebounds?: string; assists?: string };
  };
  // Enhanced stats for AI context
  teamStats?: {
    home: {
      rebounds?: number;
      assists?: number;
      steals?: number;
      blocks?: number;
      turnovers?: number;
      fgPct?: string;
      fg3Pct?: string;
      ftPct?: string;
    };
    away: {
      rebounds?: number;
      assists?: number;
      steals?: number;
      blocks?: number;
      turnovers?: number;
      fgPct?: string;
      fg3Pct?: string;
      ftPct?: string;
    };
  };
  topPerformers?: {
    home: GameLeaderStat[];
    away: GameLeaderStat[];
  };
}

export interface TeamStanding {
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  winPct: string;
  gamesBehind: string;
  streak?: string;
  lastTen?: string;
}

export interface PlayerStats {
  name: string;
  team: string;
  ppg: number;
  rpg: number;
  apg: number;
  gamesPlayed: number;
}

export interface LiveDataResponse {
  games: LiveGameData[];
  standings?: { east: TeamStanding[]; west: TeamStanding[] };
  leaders?: { points: PlayerStats[]; rebounds: PlayerStats[]; assists: PlayerStats[] };
  lastUpdated: string;
  source: string;
  sourceUrl: string;
}

// ============================================
// ESPN API CLIENT
// ============================================

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Playmaker/1.0 (Sports Analytics App)',
        'Accept': 'application/json',
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    logger.error('Fetch timeout or error', { url, error: (error as Error).message });
    return null;
  }
}

export async function fetchLiveScores(): Promise<LiveDataResponse> {
  const url = `${ESPN_BASE_URL}/scoreboard`;
  
  try {
    const response = await fetchWithTimeout(url, 10000);
    
    if (!response || !response.ok) {
      throw new Error(`ESPN API returned ${response?.status || 'no response'}`);
    }

    const data = await response.json();
    const games: LiveGameData[] = [];

    logger.info('ESPN scoreboard response', { 
      eventsCount: data.events?.length || 0,
      day: data.day?.date 
    });

    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        // ESPN returns competitions as an array
        const competition = event.competitions?.[0];
        
        // Parse team info from competition OR from event name
        let homeTeamData: LiveGameData['homeTeam'];
        let awayTeamData: LiveGameData['awayTeam'];
        let gameStatus: LiveGameData['status'] = 'scheduled';
        let period = 0;
        let clock = '';
        let venue = '';
        let broadcast = '';
        let teamStats: LiveGameData['teamStats'];
        let topPerformers: LiveGameData['topPerformers'];
        
        if (competition && competition.competitors) {
          // Full competition data available
          const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
          const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');

          homeTeamData = {
            name: homeComp?.team?.displayName || homeComp?.team?.name || 'Unknown',
            abbreviation: homeComp?.team?.abbreviation || '???',
            score: parseInt(homeComp?.score || '0'),
            record: homeComp?.records?.[0]?.summary,
          };

          awayTeamData = {
            name: awayComp?.team?.displayName || awayComp?.team?.name || 'Unknown',
            abbreviation: awayComp?.team?.abbreviation || '???',
            score: parseInt(awayComp?.score || '0'),
            record: awayComp?.records?.[0]?.summary,
          };

          const statusType = (competition.status?.type?.name || event.status?.type?.name || '').toLowerCase();
          const statusState = (competition.status?.type?.state || event.status?.type?.state || '').toLowerCase();
          const statusId = competition.status?.type?.id || event.status?.type?.id;
          
          // Debug logging for status
          console.log('[LiveData] Game status:', { 
            gameId: event.id,
            statusType, 
            statusState, 
            statusId,
            rawStatus: competition.status?.type
          });
          
          // Check multiple indicators for live games
          if (statusType === 'in_progress' || statusType === 'in progress' || statusType === 'inprogress' ||
              statusType === 'in_progress' || statusState === 'in' || statusId === '2') {
            gameStatus = 'live';
          } else if (statusType === 'halftime' || statusState === 'halftime') {
            gameStatus = 'halftime';
          } else if (statusType === 'final' || statusType === 'final/ot' || statusType?.includes('final') || 
                     statusState === 'post' || statusId === '3') {
            gameStatus = 'final';
          }

          period = competition.status?.period || event.status?.period || 0;
          clock = competition.status?.displayClock || event.status?.displayClock || '';
          venue = competition.venue?.fullName || '';
          broadcast = competition.broadcasts?.[0]?.names?.join(', ') || '';
          
          // Extract team stats if available
          const parseCompetitorStats = (comp: any) => {
            const stats: any = {};
            if (comp?.statistics) {
              for (const stat of comp.statistics) {
                const name = stat.name?.toLowerCase();
                if (name === 'rebounds') stats.rebounds = parseInt(stat.displayValue || '0');
                else if (name === 'assists') stats.assists = parseInt(stat.displayValue || '0');
                else if (name === 'fieldgoalpct') stats.fgPct = stat.displayValue;
                else if (name === 'threepointpct') stats.fg3Pct = stat.displayValue;
                else if (name === 'freethrowpct') stats.ftPct = stat.displayValue;
              }
            }
            return stats;
          };
          
          teamStats = {
            home: parseCompetitorStats(homeComp),
            away: parseCompetitorStats(awayComp),
          };
          
          // Extract top performers
          topPerformers = { home: [], away: [] };
          if (competition?.leaders) {
            for (const leaderCat of competition.leaders) {
              const category = leaderCat.name || leaderCat.displayName || '';
              if (!leaderCat.leaders) continue;
              
              for (const leader of leaderCat.leaders) {
                const isHome = leader.team?.id === homeComp?.team?.id;
                const performer: GameLeaderStat = {
                  playerName: leader.athlete?.displayName || 'Unknown',
                  value: leader.displayValue || '0',
                  stat: category,
                };
                
                if (isHome) {
                  topPerformers.home.push(performer);
                } else {
                  topPerformers.away.push(performer);
                }
              }
            }
          }
        } else {
          // Parse from event shortName (e.g., "CLE @ IND")
          const shortName = event.shortName || '';
          const [away, home] = shortName.split(' @ ');
          
          homeTeamData = {
            name: home || 'Unknown',
            abbreviation: home || '???',
            score: 0,
          };

          awayTeamData = {
            name: away || 'Unknown',
            abbreviation: away || '???',
            score: 0,
          };

          // Parse status from event
          const statusType = (event.status?.type?.name || '').toLowerCase();
          const statusState = (event.status?.type?.state || '').toLowerCase();
          const statusId = event.status?.type?.id;
          
          if (statusType === 'in_progress' || statusType === 'in progress' || statusType === 'inprogress' ||
              statusState === 'in' || statusId === '2') {
            gameStatus = 'live';
          } else if (statusType === 'halftime' || statusState === 'halftime') {
            gameStatus = 'halftime';
          } else if (statusType === 'final' || statusType?.includes('final') || 
                     statusState === 'post' || statusId === '3') {
            gameStatus = 'final';
          }

          period = event.status?.period || 0;
          clock = event.status?.displayClock || new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) || '';
        }

        // Extract leaders if available (different format)
        const leaders: LiveGameData['leaders'] = { home: {}, away: {} };
        if (competition?.leaders) {
          for (const leaderCat of competition.leaders) {
            const category = leaderCat.name?.toLowerCase();
            if (!leaderCat.leaders?.[0]) continue;
            
            const leader = leaderCat.leaders[0];
            const leaderStr = `${leader.athlete?.displayName} (${leader.displayValue})`;
            
            if (category === 'points' || category === 'pointsleader') {
              leaders.home.points = leaderStr;
            } else if (category === 'rebounds' || category === 'reboundsleader') {
              leaders.home.rebounds = leaderStr;
            } else if (category === 'assists' || category === 'assistsleader') {
              leaders.home.assists = leaderStr;
            }
          }
        }

        games.push({
          gameId: event.id,
          gameDate: event.date || competition?.date || data.day?.date,
          homeTeam: homeTeamData,
          awayTeam: awayTeamData,
          status: gameStatus,
          period,
          clock,
          venue,
          broadcast,
          leaders,
          teamStats,
          topPerformers,
        });
      }
    }

    logger.info('Parsed ESPN games', { gamesCount: games.length });

    return {
      games,
      lastUpdated: new Date().toISOString(),
      source: 'ESPN',
      sourceUrl: 'https://www.espn.com/nba/scoreboard',
    };

  } catch (error) {
    logger.error('Failed to fetch live scores from ESPN', { error: (error as Error).message });
    return {
      games: [],
      lastUpdated: new Date().toISOString(),
      source: 'ESPN (Error)',
      sourceUrl: 'https://www.espn.com/nba/scoreboard',
    };
  }
}

// Fetch games for a specific date (format: YYYYMMDD)
export async function fetchScoresByDate(dateStr: string): Promise<LiveDataResponse> {
  const url = `${ESPN_BASE_URL}/scoreboard?dates=${dateStr}`;
  
  try {
    const response = await fetchWithTimeout(url, 10000);
    
    if (!response || !response.ok) {
      throw new Error(`ESPN API returned ${response?.status || 'no response'}`);
    }

    const data = await response.json();
    const games: LiveGameData[] = [];

    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;
        
        const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');
        if (!homeComp || !awayComp) continue;

        const statusType = (competition.status?.type?.name || '').toLowerCase();
        const statusState = (competition.status?.type?.state || '').toLowerCase();
        const statusId = competition.status?.type?.id;
        
        let gameStatus: LiveGameData['status'] = 'scheduled';
        if (statusType.includes('in_progress') || statusType === 'in progress' || statusType === 'inprogress' ||
            statusState === 'in' || statusId === '2') {
          gameStatus = 'live';
        } else if (statusType === 'halftime' || statusState === 'halftime') {
          gameStatus = 'halftime';
        } else if (statusType.includes('final') || statusState === 'post' || statusId === '3') {
          gameStatus = 'final';
        }

        games.push({
          gameId: event.id,
          gameDate: event.date || data.day?.date,
          homeTeam: {
            name: homeComp?.team?.displayName || 'Unknown',
            abbreviation: homeComp?.team?.abbreviation || '???',
            score: parseInt(homeComp?.score || '0'),
            record: homeComp?.records?.[0]?.summary,
          },
          awayTeam: {
            name: awayComp?.team?.displayName || 'Unknown',
            abbreviation: awayComp?.team?.abbreviation || '???',
            score: parseInt(awayComp?.score || '0'),
            record: awayComp?.records?.[0]?.summary,
          },
          status: gameStatus,
          period: competition.status?.period || 0,
          clock: competition.status?.displayClock || '',
          venue: competition.venue?.fullName || '',
          broadcast: competition.broadcasts?.[0]?.names?.join(', ') || '',
        });
      }
    }

    return {
      games,
      lastUpdated: new Date().toISOString(),
      source: 'ESPN',
      sourceUrl: `https://www.espn.com/nba/schedule/_/date/${dateStr}`,
    };

  } catch (error) {
    logger.error('Failed to fetch scores by date', { dateStr, error: (error as Error).message });
    return {
      games: [],
      lastUpdated: new Date().toISOString(),
      source: 'ESPN (Error)',
      sourceUrl: 'https://www.espn.com/nba/schedule',
    };
  }
}

// Fetch games for a date range (useful for calendar month view)
export async function fetchScoresForDateRange(startDate: Date, endDate: Date): Promise<LiveGameData[]> {
  const allGames: LiveGameData[] = [];
  const currentDate = new Date(startDate);
  
  // Fetch games for each day in the range (max 31 days)
  const maxDays = 31;
  let dayCount = 0;
  
  while (currentDate <= endDate && dayCount < maxDays) {
    const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
    const { games } = await fetchScoresByDate(dateStr);
    
    // Add date info to each game
    games.forEach(game => {
      (game as any).date = currentDate.toISOString().split('T')[0];
    });
    
    allGames.push(...games);
    currentDate.setDate(currentDate.getDate() + 1);
    dayCount++;
  }
  
  return allGames;
}

export async function fetchStandings(): Promise<{ east: TeamStanding[]; west: TeamStanding[]; source: string; sourceUrl: string }> {
  // Use the v2 API endpoint which returns full standings data
  const url = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
  
  try {
    logger.info('Fetching NBA standings', { url });
    const response = await fetchWithTimeout(url, 10000); // Increased timeout for standings
    
    if (!response || !response.ok) {
      throw new Error(`ESPN API returned ${response?.status || 'no response'}`);
    }

    const data = await response.json();
    const east: TeamStanding[] = [];
    const west: TeamStanding[] = [];

    logger.info('ESPN standings response', { 
      hasChildren: !!data.children, 
      childrenCount: data.children?.length || 0 
    });

    if (data.children && Array.isArray(data.children)) {
      for (const conference of data.children) {
        const confName = conference.name?.toLowerCase() || '';
        const isEast = confName.includes('east');
        const targetArray = isEast ? east : west;

        logger.info('Processing conference', { 
          confName, 
          isEast,
          hasStandings: !!conference.standings,
          entriesCount: conference.standings?.entries?.length || 0 
        });

        if (conference.standings?.entries) {
          for (const entry of conference.standings.entries) {
            const team = entry.team;
            const stats = entry.stats || [];
            
            // Helper to find stat by name
            const findStat = (name: string) => {
              const stat = stats.find((s: any) => s.name === name);
              return stat?.displayValue || stat?.value?.toString() || '0';
            };
            
            const wins = parseInt(findStat('wins')) || 0;
            const losses = parseInt(findStat('losses')) || 0;
            
            targetArray.push({
              name: team?.displayName || team?.name || 'Unknown',
              abbreviation: team?.abbreviation || '???',
              conference: isEast ? 'East' : 'West',
              division: team?.standingSummary?.split(' - ')?.[1] || '',
              wins,
              losses,
              winPct: findStat('winPercent'),
              gamesBehind: findStat('gamesBehind'),
              streak: findStat('streak'),
              lastTen: findStat('Last Ten Games'),
            });
          }
        }
      }
    }

    // Sort by wins descending, then by win percentage for tiebreaker
    const sortStandings = (teams: TeamStanding[]) => {
      return teams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const pctA = parseFloat(a.winPct?.replace('.', '0.') || '0');
        const pctB = parseFloat(b.winPct?.replace('.', '0.') || '0');
        return pctB - pctA;
      });
    };

    sortStandings(east);
    sortStandings(west);

    logger.info('Standings parsed successfully', { eastTeams: east.length, westTeams: west.length });

    return {
      east,
      west,
      source: 'ESPN',
      sourceUrl: 'https://www.espn.com/nba/standings',
    };

  } catch (error) {
    logger.error('Failed to fetch standings from ESPN', { error: (error as Error).message });
    return {
      east: [],
      west: [],
      source: 'ESPN (Error)',
      sourceUrl: 'https://www.espn.com/nba/standings',
    };
  }
}

export async function fetchLeagueLeaders(): Promise<{ 
  points: PlayerStats[]; 
  rebounds: PlayerStats[]; 
  assists: PlayerStats[];
  source: string;
  sourceUrl: string;
}> {
  // ESPN doesn't have a great public leaders endpoint, so we'll return cached/mock for now
  // In production, this would scrape from Basketball Reference or use NBA.com API
  
  return {
    points: [],
    rebounds: [],
    assists: [],
    source: 'ESPN',
    sourceUrl: 'https://www.espn.com/nba/stats',
  };
}

// ============================================
// COMBINED DATA FETCHER
// ============================================

export async function fetchAllLiveData(): Promise<LiveDataResponse> {
  const [scoresData, standingsData] = await Promise.all([
    fetchLiveScores(),
    fetchStandings(),
  ]);

  return {
    games: scoresData.games,
    standings: {
      east: standingsData.east,
      west: standingsData.west,
    },
    lastUpdated: new Date().toISOString(),
    source: 'ESPN',
    sourceUrl: 'https://www.espn.com/nba/',
  };
}

// ============================================
// DETAILED BOXSCORE FETCHER FOR AI
// ============================================

export interface PlayerBoxscoreStats {
  name: string;
  team: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  plusMinus: string;
}

export interface GameBoxscore {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  homePlayers: PlayerBoxscoreStats[];
  awayPlayers: PlayerBoxscoreStats[];
}

// Fetch detailed boxscore for a specific game
async function fetchGameBoxscore(gameId: string): Promise<GameBoxscore | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
  
  try {
    const response = await fetchWithTimeout(url, 8000);
    if (!response || !response.ok) return null;
    
    const data = await response.json();
    const competition = data.header?.competitions?.[0];
    const boxscore = data.boxscore;
    
    if (!competition || !boxscore) return null;
    
    const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');
    
    const parsePlayerStats = (players: any[], teamAbbr: string): PlayerBoxscoreStats[] => {
      if (!players || !Array.isArray(players)) return [];
      
      return players.filter(p => !p.didNotPlay).map(p => {
        const stats = p.stats || [];
        const parseShooting = (str: string): [number, number] => {
          if (!str || str === '--' || str === '-') return [0, 0];
          const parts = String(str).split('-');
          return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0];
        };
        
        const getStatByIndex = (idx: number): string => {
          if (!Array.isArray(stats) || idx >= stats.length) return '0';
          return String(stats[idx] ?? '0');
        };
        
        const [fgm, fga] = parseShooting(getStatByIndex(1));
        const [fg3m, fg3a] = parseShooting(getStatByIndex(2));
        const [ftm, fta] = parseShooting(getStatByIndex(3));
        
        return {
          name: p.athlete?.displayName || 'Unknown',
          team: teamAbbr,
          minutes: getStatByIndex(0),
          points: parseInt(getStatByIndex(13)) || 0,
          rebounds: parseInt(getStatByIndex(6)) || 0,
          assists: parseInt(getStatByIndex(7)) || 0,
          steals: parseInt(getStatByIndex(8)) || 0,
          blocks: parseInt(getStatByIndex(9)) || 0,
          turnovers: parseInt(getStatByIndex(10)) || 0,
          fgm, fga, fg3m, fg3a, ftm, fta,
          plusMinus: getStatByIndex(12),
        };
      }).filter(p => p.minutes !== '0' && p.minutes !== '--');
    };
    
    let homePlayers: PlayerBoxscoreStats[] = [];
    let awayPlayers: PlayerBoxscoreStats[] = [];
    
    // Find player statistics from boxscore.players
    if (boxscore.players) {
      for (const teamData of boxscore.players) {
        const teamId = teamData.team?.id;
        const teamAbbr = teamData.team?.abbreviation || '???';
        const playerStats = teamData.statistics?.[0]?.athletes || [];
        
        if (teamId === homeComp?.id) {
          homePlayers = parsePlayerStats(playerStats, teamAbbr);
        } else {
          awayPlayers = parsePlayerStats(playerStats, teamAbbr);
        }
      }
    }
    
    return {
      gameId,
      homeTeam: homeComp?.team?.abbreviation || '???',
      awayTeam: awayComp?.team?.abbreviation || '???',
      homeScore: parseInt(homeComp?.score || '0'),
      awayScore: parseInt(awayComp?.score || '0'),
      status: competition.status?.type?.name || 'scheduled',
      homePlayers,
      awayPlayers,
    };
  } catch (error) {
    logger.error('Failed to fetch game boxscore', { gameId, error: (error as Error).message });
    return null;
  }
}

// Fetch boxscores for all live/final games
export async function fetchAllBoxscores(games: LiveGameData[]): Promise<GameBoxscore[]> {
  const relevantGames = games.filter(g => g.status === 'live' || g.status === 'halftime' || g.status === 'final');
  
  // Fetch in parallel with concurrency limit
  const boxscores: GameBoxscore[] = [];
  const batchSize = 3;
  
  for (let i = 0; i < relevantGames.length; i += batchSize) {
    const batch = relevantGames.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(g => fetchGameBoxscore(g.gameId)));
    results.forEach(r => { if (r) boxscores.push(r); });
  }
  
  return boxscores;
}

// ============================================
// CONTEXT BUILDER FOR AI
// ============================================

export function buildAIContext(data: LiveDataResponse, boxscores?: GameBoxscore[]): string {
  const lines: string[] = [
    '===== LIVE NBA DATA =====',
    `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`,
    `Source: ${data.source}`,
    `Source URL: ${data.sourceUrl}`,
    '',
  ];

  if (data.games.length > 0) {
    lines.push("TODAY'S GAMES:");
    for (const game of data.games) {
      const statusStr = game.status === 'live' 
        ? `🔴 LIVE Q${game.period} ${game.clock}`
        : game.status === 'halftime'
          ? '⏸️ HALFTIME'
          : game.status === 'final'
            ? '✅ FINAL'
            : `⏰ ${game.clock || 'Scheduled'}`;

      lines.push(`\n${game.awayTeam.name} (${game.awayTeam.record || '0-0'}) @ ${game.homeTeam.name} (${game.homeTeam.record || '0-0'})`);
      lines.push(`  Score: ${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.abbreviation} ${game.homeTeam.score}`);
      lines.push(`  Status: ${statusStr}`);
      
      // Add team stats if available
      if (game.teamStats) {
        if (game.teamStats.away.rebounds || game.teamStats.home.rebounds) {
          lines.push(`  Team Rebounds: ${game.awayTeam.abbreviation} ${game.teamStats.away.rebounds || 0} - ${game.homeTeam.abbreviation} ${game.teamStats.home.rebounds || 0}`);
        }
        if (game.teamStats.away.assists || game.teamStats.home.assists) {
          lines.push(`  Team Assists: ${game.awayTeam.abbreviation} ${game.teamStats.away.assists || 0} - ${game.homeTeam.abbreviation} ${game.teamStats.home.assists || 0}`);
        }
        if (game.teamStats.away.fgPct || game.teamStats.home.fgPct) {
          lines.push(`  FG%: ${game.awayTeam.abbreviation} ${game.teamStats.away.fgPct || 'N/A'} - ${game.homeTeam.abbreviation} ${game.teamStats.home.fgPct || 'N/A'}`);
        }
      }
      
      // Add top performers if available
      if (game.topPerformers) {
        if (game.topPerformers.away.length > 0) {
          lines.push(`  ${game.awayTeam.abbreviation} Top Performers:`);
          game.topPerformers.away.slice(0, 3).forEach(p => {
            lines.push(`    - ${p.playerName}: ${p.value} ${p.stat}`);
          });
        }
        if (game.topPerformers.home.length > 0) {
          lines.push(`  ${game.homeTeam.abbreviation} Top Performers:`);
          game.topPerformers.home.slice(0, 3).forEach(p => {
            lines.push(`    - ${p.playerName}: ${p.value} ${p.stat}`);
          });
        }
      }
      
      // Fallback to leaders format
      if (game.leaders && !game.topPerformers) {
        if (game.leaders.home.points) lines.push(`  ${game.homeTeam.abbreviation} Leading Scorer: ${game.leaders.home.points}`);
        if (game.leaders.away.points) lines.push(`  ${game.awayTeam.abbreviation} Leading Scorer: ${game.leaders.away.points}`);
        if (game.leaders.home.rebounds) lines.push(`  ${game.homeTeam.abbreviation} Leading Rebounder: ${game.leaders.home.rebounds}`);
        if (game.leaders.away.rebounds) lines.push(`  ${game.awayTeam.abbreviation} Leading Rebounder: ${game.leaders.away.rebounds}`);
        if (game.leaders.home.assists) lines.push(`  ${game.homeTeam.abbreviation} Assists Leader: ${game.leaders.home.assists}`);
        if (game.leaders.away.assists) lines.push(`  ${game.awayTeam.abbreviation} Assists Leader: ${game.leaders.away.assists}`);
      }
      
      // Add detailed boxscore player stats if available
      const gameBoxscore = boxscores?.find(b => b.gameId === game.gameId);
      if (gameBoxscore) {
        lines.push(`\n  === ${game.awayTeam.abbreviation} INDIVIDUAL PLAYER STATS ===`);
        gameBoxscore.awayPlayers.slice(0, 8).forEach(p => {
          lines.push(`    ${p.name}: ${p.points}pts, ${p.rebounds}reb, ${p.assists}ast, ${p.steals}stl, ${p.blocks}blk, ${p.fgm}/${p.fga} FG, ${p.fg3m}/${p.fg3a} 3PT, ${p.minutes} min, +/- ${p.plusMinus}`);
        });
        
        lines.push(`\n  === ${game.homeTeam.abbreviation} INDIVIDUAL PLAYER STATS ===`);
        gameBoxscore.homePlayers.slice(0, 8).forEach(p => {
          lines.push(`    ${p.name}: ${p.points}pts, ${p.rebounds}reb, ${p.assists}ast, ${p.steals}stl, ${p.blocks}blk, ${p.fgm}/${p.fga} FG, ${p.fg3m}/${p.fg3a} 3PT, ${p.minutes} min, +/- ${p.plusMinus}`);
        });
      }
      
      if (game.venue) lines.push(`  Venue: ${game.venue}`);
      if (game.broadcast) lines.push(`  TV: ${game.broadcast}`);
    }
  } else {
    lines.push('No NBA games scheduled for today.');
  }

  if (data.standings) {
    lines.push('\n===== STANDINGS SUMMARY =====');
    
    if (data.standings.east.length > 0) {
      lines.push('\nEASTERN CONFERENCE (Top 8):');
      data.standings.east.slice(0, 8).forEach((team, i) => {
        lines.push(`  ${i + 1}. ${team.name} (${team.wins}-${team.losses}) ${team.winPct}`);
      });
    }
    
    if (data.standings.west.length > 0) {
      lines.push('\nWESTERN CONFERENCE (Top 8):');
      data.standings.west.slice(0, 8).forEach((team, i) => {
        lines.push(`  ${i + 1}. ${team.name} (${team.wins}-${team.losses}) ${team.winPct}`);
      });
    }
  }

  lines.push('\n===== END OF DATA =====');
  lines.push(`\nALWAYS cite the source URL (${data.sourceUrl}) when sharing this information.`);
  lines.push('If asked about specific player stats for a game, you have the data above. Provide specific numbers when available.');

  return lines.join('\n');
}
