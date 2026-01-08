// ESPN API Service - Comprehensive NBA data fetching
// Provides detailed game data, player stats, team info, and injury reports

import { logger } from '@/lib/logger';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ESPNTeam {
  id: string;
  name: string;
  displayName: string;
  abbreviation: string;
  logo: string;
  color?: string;
  record?: string;
}

export interface ESPNPlayer {
  id: string;
  name: string;
  displayName: string;
  shortName: string;
  jersey: string;
  position: string;
  headshot?: string;
  team?: ESPNTeam;
}

export interface ESPNPlayerStats {
  player: ESPNPlayer;
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
  fgPct: string;
  fg3Pct: string;
  ftPct: string;
  starter: boolean;
}

export interface ESPNPlay {
  id: string;
  sequenceNumber: number;
  period: number;
  clock: string;
  description: string;
  type: string;
  team?: ESPNTeam;
  player?: ESPNPlayer;
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
}

export interface ESPNInjury {
  player: ESPNPlayer;
  status: 'Out' | 'Questionable' | 'Probable' | 'Day-To-Day';
  description: string;
  date: string;
}

export interface ESPNGameDetail {
  id: string;
  date: string;
  status: 'scheduled' | 'live' | 'halftime' | 'final';
  period: number;
  clock: string;
  venue: string;
  attendance?: number;
  homeTeam: ESPNTeam;
  awayTeam: ESPNTeam;
  homeScore: number;
  awayScore: number;
  homeStats: ESPNPlayerStats[];
  awayStats: ESPNPlayerStats[];
  homeTotals?: {
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
  };
  awayTotals?: {
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
  };
  plays: ESPNPlay[];
  leaders: {
    home: { points?: string; rebounds?: string; assists?: string };
    away: { points?: string; rebounds?: string; assists?: string };
  };
  odds?: {
    spread: string;
    overUnder: string;
  };
  broadcast?: string;
}

export interface ESPNTeamDetail {
  id: string;
  name: string;
  displayName: string;
  abbreviation: string;
  logo: string;
  color: string;
  alternateColor?: string;
  record: { wins: number; losses: number; winPct: string };
  standing: { conference: string; division: string; rank: number };
  roster: ESPNPlayer[];
  injuries: ESPNInjury[];
  stats: {
    ppg: number;
    oppg: number;
    rpg: number;
    apg: number;
    fgPct: number;
    fg3Pct: number;
    ftPct: number;
  };
  schedule: {
    next: { opponent: string; date: string; home: boolean }[];
    recent: { opponent: string; result: string; score: string }[];
  };
}

// ============================================
// ESPN API CLIENT
// ============================================

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_CORE_URL = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';

async function fetchJSON<T>(url: string, timeout = 10000): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Playmaker/1.0 (Sports Analytics App)',
        'Accept': 'application/json',
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });
    clearTimeout(id);
    
    if (!response.ok) {
      logger.error('ESPN API error', { url, status: response.status });
      return null;
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(id);
    logger.error('ESPN fetch error', { url, error: (error as Error).message });
    return null;
  }
}

// ============================================
// GAME DETAIL FETCHER
// ============================================

export interface TeamTotals {
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
}

export async function fetchGameDetail(gameId: string): Promise<ESPNGameDetail | null> {
  // Fetch summary data
  const summaryUrl = `${ESPN_BASE_URL}/summary?event=${gameId}`;
  const data = await fetchJSON<any>(summaryUrl);
  
  if (!data) {
    logger.error('Failed to fetch game detail', { gameId });
    return null;
  }

  try {
    const competition = data.header?.competitions?.[0];
    const boxscore = data.boxscore;
    const plays = data.plays || [];
    
    if (!competition) {
      return null;
    }

    // Parse teams
    const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');

    const homeTeam: ESPNTeam = {
      id: homeComp?.id || '',
      name: homeComp?.team?.name || 'Unknown',
      displayName: homeComp?.team?.displayName || 'Unknown',
      abbreviation: homeComp?.team?.abbreviation || '???',
      logo: homeComp?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${homeComp?.team?.abbreviation?.toLowerCase()}.png`,
      color: homeComp?.team?.color,
      record: homeComp?.record?.[0]?.displayValue,
    };

    const awayTeam: ESPNTeam = {
      id: awayComp?.id || '',
      name: awayComp?.team?.name || 'Unknown',
      displayName: awayComp?.team?.displayName || 'Unknown',
      abbreviation: awayComp?.team?.abbreviation || '???',
      logo: awayComp?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${awayComp?.team?.abbreviation?.toLowerCase()}.png`,
      color: awayComp?.team?.color,
      record: awayComp?.record?.[0]?.displayValue,
    };

    // Parse status
    const statusType = competition.status?.type?.name?.toLowerCase() || '';
    let status: ESPNGameDetail['status'] = 'scheduled';
    if (statusType.includes('in_progress') || statusType === 'in progress') status = 'live';
    else if (statusType === 'halftime') status = 'halftime';
    else if (statusType.includes('final')) status = 'final';

    // Parse team totals from boxscore.teams (ESPN provides aggregated team stats)
    const parseTeamTotals = (teamData: any, teamName: string): TeamTotals => {
      const totals: TeamTotals = {
        points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
        fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
      };
      
      logger.info('Parsing team totals', { 
        teamName,
        hasStatistics: !!teamData?.statistics,
        hasStats: !!teamData?.stats,
        statisticsLength: teamData?.statistics?.length || 0,
        teamDataKeys: Object.keys(teamData || {}),
      });
      
      // Try multiple paths ESPN might use for team stats
      const statistics = teamData?.statistics || teamData?.stats || [];
      
      if (Array.isArray(statistics) && statistics.length > 0) {
        // Log first stat group for debugging
        logger.info('Team statistics first item', {
          teamName,
          firstItemKeys: Object.keys(statistics[0] || {}),
          firstItemSample: statistics[0],
        });
        
        for (const statGroup of statistics) {
          // ESPN may structure stats differently - check for name/displayValue pairs
          if (statGroup.name && (statGroup.displayValue !== undefined || statGroup.value !== undefined)) {
            const name = statGroup.name.toLowerCase();
            const value = statGroup.displayValue ?? statGroup.value ?? '0';
            
            // Handle shooting stats (format: "made-attempted")
            const parseShooting = (str: string): [number, number] => {
              if (!str || str === '--') return [0, 0];
              const parts = String(str).split('-');
              return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0];
            };
            
            if (name === 'fieldgoalsmade-fieldgoalsattempted' || name === 'fg') {
              const [made, att] = parseShooting(value);
              totals.fgm = made;
              totals.fga = att;
            } else if (name === 'threepointfieldgoalsmade-threepointfieldgoalsattempted' || name === '3pt' || name === 'threepointers') {
              const [made, att] = parseShooting(value);
              totals.fg3m = made;
              totals.fg3a = att;
            } else if (name === 'freethrowsmade-freethrowsattempted' || name === 'ft') {
              const [made, att] = parseShooting(value);
              totals.ftm = made;
              totals.fta = att;
            } else if (name === 'totalrebounds' || name === 'rebounds') {
              totals.rebounds = parseInt(value) || 0;
            } else if (name === 'assists') {
              totals.assists = parseInt(value) || 0;
            } else if (name === 'steals') {
              totals.steals = parseInt(value) || 0;
            } else if (name === 'blocks') {
              totals.blocks = parseInt(value) || 0;
            } else if (name === 'turnovers') {
              totals.turnovers = parseInt(value) || 0;
            } else if (name === 'points') {
              totals.points = parseInt(value) || 0;
            }
          } else {
            // Try traditional labels/totals structure
            const labels = statGroup.labels || statGroup.keys || [];
            const stats = statGroup.totals || statGroup.values || statGroup.stats || [];
            
            if (labels.length > 0 && stats.length > 0) {
              labels.forEach((label: string, idx: number) => {
                const value = String(stats[idx] || '0');
                const lowerLabel = label.toLowerCase().trim();
                
                const parseShooting = (str: string): [number, number] => {
                  if (!str || str === '--') return [0, 0];
                  const parts = str.split('-');
                  return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0];
                };
                
                if (lowerLabel === 'pts' || lowerLabel === 'points') totals.points = parseInt(value) || 0;
                else if (lowerLabel === 'reb' || lowerLabel === 'rebounds' || lowerLabel === 'totalrebounds') totals.rebounds = parseInt(value) || 0;
                else if (lowerLabel === 'ast' || lowerLabel === 'assists') totals.assists = parseInt(value) || 0;
                else if (lowerLabel === 'stl' || lowerLabel === 'steals') totals.steals = parseInt(value) || 0;
                else if (lowerLabel === 'blk' || lowerLabel === 'blocks') totals.blocks = parseInt(value) || 0;
                else if (lowerLabel === 'to' || lowerLabel === 'turnovers' || lowerLabel === 'tov') totals.turnovers = parseInt(value) || 0;
                else if (lowerLabel === 'fg' || lowerLabel === 'fieldgoals') {
                  const [made, att] = parseShooting(value);
                  totals.fgm = made;
                  totals.fga = att;
                }
                else if (lowerLabel === '3pt' || lowerLabel === 'threepointers') {
                  const [made, att] = parseShooting(value);
                  totals.fg3m = made;
                  totals.fg3a = att;
                }
                else if (lowerLabel === 'ft' || lowerLabel === 'freethrows') {
                  const [made, att] = parseShooting(value);
                  totals.ftm = made;
                  totals.fta = att;
                }
              });
            }
          }
        }
      }
      
      // Also try to extract from displayStats if available
      if (teamData?.displayStats) {
        for (const stat of teamData.displayStats) {
          const name = stat.name?.toLowerCase() || '';
          const value = stat.displayValue || stat.value || '0';
          
          if (name.includes('rebound')) totals.rebounds = parseInt(value) || totals.rebounds;
          if (name.includes('assist')) totals.assists = parseInt(value) || totals.assists;
          if (name.includes('steal')) totals.steals = parseInt(value) || totals.steals;
          if (name.includes('block')) totals.blocks = parseInt(value) || totals.blocks;
          if (name.includes('turnover')) totals.turnovers = parseInt(value) || totals.turnovers;
        }
      }
      
      logger.info('Team totals parsed', { teamName, totals });
      
      return totals;
    };

    // Get team totals from boxscore
    let homeTotals: TeamTotals = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 };
    let awayTotals: TeamTotals = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 };

    logger.info('Parsing boxscore teams', { 
      hasBoxscore: !!boxscore, 
      teamsCount: boxscore?.teams?.length,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id 
    });

    if (boxscore?.teams) {
      for (const team of boxscore.teams) {
        const teamId = team.team?.id;
        const teamName = team.team?.displayName || team.team?.abbreviation || 'Unknown';
        logger.info('Processing team boxscore', { 
          teamId, 
          teamName,
          hasStatistics: !!team.statistics 
        });
        
        if (teamId === homeTeam.id || team.team?.abbreviation === homeTeam.abbreviation) {
          homeTotals = parseTeamTotals(team, `${teamName} (Home)`);
          logger.info('Home team totals parsed', { homeTotals });
        } else {
          awayTotals = parseTeamTotals(team, `${teamName} (Away)`);
          logger.info('Away team totals parsed', { awayTotals });
        }
      }
    }

    // Parse player stats - handles ESPN's nested boxscore structure
    const parsePlayerStats = (players: any[], teamId: string): ESPNPlayerStats[] => {
      if (!players || !Array.isArray(players)) {
        logger.info('No players array to parse', { teamId });
        return [];
      }
      
      logger.info('Parsing player stats', { teamId, playerCount: players.length });
      
      // Log first player's complete structure for debugging
      if (players.length > 0) {
        const firstPlayer = players[0];
        logger.info('First player raw structure', { 
          athleteName: firstPlayer.athlete?.displayName,
          playerKeys: Object.keys(firstPlayer),
          hasStats: !!firstPlayer.stats,
          statsType: typeof firstPlayer.stats,
          statsIsArray: Array.isArray(firstPlayer.stats),
          statsContent: Array.isArray(firstPlayer.stats) ? firstPlayer.stats.slice(0, 5) : firstPlayer.stats,
        });
      }
      
      const parsed = players.map((p: any) => {
        // ESPN boxscore structure: stats are directly on the player object as an array
        // The labels come from the parent statistics object
        const stats = p.stats || p.statistics?.[0]?.stats || [];
        
        // Log raw stats for first player
        if (players.indexOf(p) === 0) {
          logger.info('Player stats raw', { 
            athleteName: p.athlete?.displayName,
            statsRaw: stats,
            didPlay: p.didNotPlay !== true,
          });
        }
        
        // ESPN standard order for boxscore stats:
        // [MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS]
        // Index: 0=MIN, 1=FG, 2=3PT, 3=FT, 4=OREB, 5=DREB, 6=REB, 7=AST, 8=STL, 9=BLK, 10=TO, 11=PF, 12=+/-, 13=PTS
        
        const getStatByIndex = (idx: number, defaultVal = '0'): string => {
          if (!Array.isArray(stats) || idx >= stats.length) return defaultVal;
          return String(stats[idx] ?? defaultVal);
        };
        
        const parseShooting = (str: string): [number, number] => {
          if (!str || str === '--' || str === '-') return [0, 0];
          const parts = str.split('-');
          return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0];
        };
        
        const minutes = getStatByIndex(0);
        const [fgm, fga] = parseShooting(getStatByIndex(1));
        const [fg3m, fg3a] = parseShooting(getStatByIndex(2));
        const [ftm, fta] = parseShooting(getStatByIndex(3));
        const rebounds = parseInt(getStatByIndex(6)) || 0;
        const assists = parseInt(getStatByIndex(7)) || 0;
        const steals = parseInt(getStatByIndex(8)) || 0;
        const blocks = parseInt(getStatByIndex(9)) || 0;
        const turnovers = parseInt(getStatByIndex(10)) || 0;
        const plusMinus = getStatByIndex(12);
        const points = parseInt(getStatByIndex(13)) || 0;
        
        // Calculate percentages
        const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0.0';
        const fg3Pct = fg3a > 0 ? ((fg3m / fg3a) * 100).toFixed(1) : '0.0';
        const ftPct = fta > 0 ? ((ftm / fta) * 100).toFixed(1) : '0.0';

        return {
          player: {
            id: p.athlete?.id || p.id || '',
            name: p.athlete?.displayName || p.displayName || 'Unknown',
            displayName: p.athlete?.displayName || p.displayName || 'Unknown',
            shortName: p.athlete?.shortName || p.shortName || 'Unknown',
            jersey: p.athlete?.jersey || p.jersey || '0',
            position: p.athlete?.position?.abbreviation || p.position || '',
            headshot: p.athlete?.headshot?.href || p.headshot,
          },
          minutes,
          points,
          rebounds,
          assists,
          steals,
          blocks,
          turnovers,
          fgm,
          fga,
          fg3m,
          fg3a,
          ftm,
          fta,
          plusMinus,
          fgPct,
          fg3Pct,
          ftPct,
          starter: p.starter || false,
        };
      });
      
      // Filter out players who didn't play
      const filtered = parsed.filter(p => {
        // Check if player has any meaningful stats
        const minVal = parseInt(p.minutes) || 0;
        const hasPlayed = minVal > 0 || p.points > 0 || p.rebounds > 0 || p.assists > 0;
        return hasPlayed;
      });
      
      logger.info('Parsed player stats result', { 
        teamId, 
        totalPlayers: players.length, 
        playersWithStats: filtered.length,
        sampleStats: filtered.slice(0, 2).map(p => ({ 
          name: p.player.shortName, 
          min: p.minutes,
          pts: p.points, 
          reb: p.rebounds, 
          ast: p.assists 
        }))
      });
      
      return filtered;
    };

    // Parse boxscore players
    let homeStats: ESPNPlayerStats[] = [];
    let awayStats: ESPNPlayerStats[] = [];

    logger.info('Parsing boxscore players', {
      hasBoxscorePlayers: !!boxscore?.players,
      playersTeamsCount: boxscore?.players?.length || 0,
    });

    if (boxscore?.players) {
      for (const team of boxscore.players) {
        const teamId = team.team?.id;
        const teamAbbrev = team.team?.abbreviation;
        const teamName = team.team?.displayName;
        
        // Try multiple paths to get athletes
        const athletes = team.statistics?.[0]?.athletes || team.athletes || [];
        
        logger.info('Processing boxscore players for team', { 
          teamId, 
          teamAbbrev,
          teamName,
          athletesCount: athletes.length,
          hasStatistics: !!team.statistics,
          statisticsLength: team.statistics?.length || 0,
        });
        
        const isHomeTeam = teamId === homeTeam.id || teamAbbrev === homeTeam.abbreviation;
        
        if (isHomeTeam) {
          homeStats = parsePlayerStats(athletes, teamId);
          logger.info('Home team player stats parsed', { 
            teamName,
            playerCount: homeStats.length,
            topScorer: homeStats[0] ? `${homeStats[0].player.shortName} (${homeStats[0].points} pts)` : 'none'
          });
        } else {
          awayStats = parsePlayerStats(athletes, teamId);
          logger.info('Away team player stats parsed', { 
            teamName,
            playerCount: awayStats.length,
            topScorer: awayStats[0] ? `${awayStats[0].player.shortName} (${awayStats[0].points} pts)` : 'none'
          });
        }
      }
    } else {
      logger.warn('No boxscore.players found', { gameId });
    }

    // Helper to calculate totals from player stats
    const calculateFromPlayers = (players: typeof homeStats): TeamTotals => {
      return players.reduce((acc, p) => ({
        points: acc.points + p.points,
        rebounds: acc.rebounds + p.rebounds,
        assists: acc.assists + p.assists,
        steals: acc.steals + p.steals,
        blocks: acc.blocks + p.blocks,
        turnovers: acc.turnovers + p.turnovers,
        fgm: acc.fgm + p.fgm,
        fga: acc.fga + p.fga,
        fg3m: acc.fg3m + p.fg3m,
        fg3a: acc.fg3a + p.fg3a,
        ftm: acc.ftm + p.ftm,
        fta: acc.fta + p.fta,
      }), { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 });
    };

    // ALWAYS calculate from player stats if we have player data
    // This ensures we get accurate totals even if ESPN boxscore structure changes
    if (homeStats.length > 0) {
      const calculatedHome = calculateFromPlayers(homeStats);
      logger.info('Calculated home totals from players', { calculatedHome, playerCount: homeStats.length });
      
      // Use calculated values, preferring them if boxscore parsing failed
      if (homeTotals.rebounds === 0 || homeTotals.assists === 0) {
        homeTotals = calculatedHome;
      }
    }

    if (awayStats.length > 0) {
      const calculatedAway = calculateFromPlayers(awayStats);
      logger.info('Calculated away totals from players', { calculatedAway, playerCount: awayStats.length });
      
      // Use calculated values, preferring them if boxscore parsing failed
      if (awayTotals.rebounds === 0 || awayTotals.assists === 0) {
        awayTotals = calculatedAway;
      }
    }

    // Parse plays
    const parsedPlays: ESPNPlay[] = [];
    if (plays && Array.isArray(plays)) {
      for (const playGroup of plays) {
        if (playGroup.plays && Array.isArray(playGroup.plays)) {
          for (const play of playGroup.plays) {
            parsedPlays.push({
              id: play.id || '',
              sequenceNumber: play.sequenceNumber || 0,
              period: play.period?.number || 1,
              clock: play.clock?.displayValue || '',
              description: play.text || '',
              type: play.type?.text || '',
              homeScore: play.homeScore || 0,
              awayScore: play.awayScore || 0,
              scoringPlay: play.scoringPlay || false,
            });
          }
        }
      }
    }

    // Sort plays by sequence
    parsedPlays.sort((a, b) => b.sequenceNumber - a.sequenceNumber);

    // Parse leaders
    const leaders = {
      home: {} as ESPNGameDetail['leaders']['home'],
      away: {} as ESPNGameDetail['leaders']['away'],
    };

    if (data.leaders) {
      for (const leaderGroup of data.leaders) {
        const isHome = leaderGroup.team?.id === homeTeam.id;
        const target = isHome ? leaders.home : leaders.away;
        
        for (const leader of leaderGroup.leaders || []) {
          const category = leader.name?.toLowerCase();
          const athlete = leader.leaders?.[0];
          if (!athlete) continue;
          
          const statStr = `${athlete.athlete?.displayName} (${athlete.displayValue})`;
          
          if (category === 'points') target.points = statStr;
          else if (category === 'rebounds') target.rebounds = statStr;
          else if (category === 'assists') target.assists = statStr;
        }
      }
    }

    const result: ESPNGameDetail = {
      id: gameId,
      date: competition.date || new Date().toISOString(),
      status,
      period: competition.status?.period || 0,
      clock: competition.status?.displayClock || '',
      venue: data.gameInfo?.venue?.fullName || '',
      attendance: data.gameInfo?.attendance,
      homeTeam,
      awayTeam,
      homeScore: parseInt(homeComp?.score || '0'),
      awayScore: parseInt(awayComp?.score || '0'),
      homeStats,
      awayStats,
      plays: parsedPlays,
      leaders,
      broadcast: competition.broadcasts?.[0]?.names?.join(', '),
      homeTotals,
      awayTotals,
    };

    return result;

  } catch (error) {
    logger.error('Error parsing game detail', { gameId, error: (error as Error).message });
    return null;
  }
}

// ============================================
// TEAM DETAIL FETCHER
// ============================================

export async function fetchTeamDetail(teamId: string): Promise<ESPNTeamDetail | null> {
  const teamUrl = `${ESPN_BASE_URL}/teams/${teamId}`;
  const data = await fetchJSON<any>(teamUrl);
  
  if (!data?.team) {
    logger.error('Failed to fetch team detail', { teamId });
    return null;
  }

  try {
    const team = data.team;
    const record = team.record?.items?.[0];
    const stats = record?.stats || [];

    // Parse stats
    const getStatValue = (name: string) => {
      const stat = stats.find((s: any) => s.name === name);
      return parseFloat(stat?.value || '0');
    };

    // Parse roster (basic info)
    const roster: ESPNPlayer[] = (team.athletes || []).map((a: any) => ({
      id: a.id,
      name: a.displayName,
      displayName: a.displayName,
      shortName: a.shortName,
      jersey: a.jersey || '',
      position: a.position?.abbreviation || '',
      headshot: a.headshot?.href,
    }));

    // Fetch injuries separately
    const injuriesUrl = `${ESPN_BASE_URL}/teams/${teamId}/injuries`;
    const injuriesData = await fetchJSON<any>(injuriesUrl);
    
    const injuries: ESPNInjury[] = [];
    if (injuriesData?.injuries) {
      for (const injury of injuriesData.injuries) {
        injuries.push({
          player: {
            id: injury.athlete?.id || '',
            name: injury.athlete?.displayName || 'Unknown',
            displayName: injury.athlete?.displayName || 'Unknown',
            shortName: injury.athlete?.shortName || 'Unknown',
            jersey: injury.athlete?.jersey || '',
            position: injury.athlete?.position?.abbreviation || '',
            headshot: injury.athlete?.headshot?.href,
          },
          status: injury.status || 'Questionable',
          description: injury.longComment || injury.shortComment || '',
          date: injury.date || '',
        });
      }
    }

    return {
      id: team.id,
      name: team.name,
      displayName: team.displayName,
      abbreviation: team.abbreviation,
      logo: team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation?.toLowerCase()}.png`,
      color: team.color || '#333',
      alternateColor: team.alternateColor,
      record: {
        wins: getStatValue('wins'),
        losses: getStatValue('losses'),
        winPct: (getStatValue('winPercent') * 100).toFixed(1),
      },
      standing: {
        conference: team.groups?.parent?.name || '',
        division: team.groups?.name || '',
        rank: team.standingSummary?.match(/\d+/)?.[0] || '0',
      },
      roster,
      injuries,
      stats: {
        ppg: getStatValue('avgPointsFor'),
        oppg: getStatValue('avgPointsAgainst'),
        rpg: getStatValue('avgRebounds') || 0,
        apg: getStatValue('avgAssists') || 0,
        fgPct: getStatValue('fieldGoalPct') * 100,
        fg3Pct: getStatValue('threePointFieldGoalPct') * 100,
        ftPct: getStatValue('freeThrowPct') * 100,
      },
      schedule: {
        next: [],
        recent: [],
      },
    };

  } catch (error) {
    logger.error('Error parsing team detail', { teamId, error: (error as Error).message });
    return null;
  }
}

// ============================================
// ALL TEAMS FETCHER
// ============================================

export async function fetchAllTeams(): Promise<ESPNTeam[]> {
  const url = `${ESPN_BASE_URL}/teams`;
  const data = await fetchJSON<any>(url);
  
  if (!data?.sports?.[0]?.leagues?.[0]?.teams) {
    return [];
  }

  const teams: ESPNTeam[] = [];
  
  for (const teamWrapper of data.sports[0].leagues[0].teams) {
    const team = teamWrapper.team;
    teams.push({
      id: team.id,
      name: team.name,
      displayName: team.displayName,
      abbreviation: team.abbreviation,
      logo: team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation?.toLowerCase()}.png`,
      color: team.color,
    });
  }

  return teams;
}

// ============================================
// TEAM ROSTER WITH STATS
// ============================================

export async function fetchTeamRoster(teamId: string): Promise<ESPNPlayer[]> {
  const url = `${ESPN_BASE_URL}/teams/${teamId}/roster`;
  const data = await fetchJSON<any>(url);
  
  if (!data?.athletes) {
    return [];
  }

  const players: ESPNPlayer[] = [];
  
  for (const group of data.athletes) {
    for (const athlete of group.items || []) {
      players.push({
        id: athlete.id,
        name: athlete.displayName,
        displayName: athlete.displayName,
        shortName: athlete.shortName,
        jersey: athlete.jersey || '',
        position: athlete.position?.abbreviation || group.position || '',
        headshot: athlete.headshot?.href,
      });
    }
  }

  return players;
}

// ============================================
// PLAYER SEASON STATS
// ============================================

export interface ESPNPlayerSeasonStats {
  id: string;
  name: string;
  position: string;
  jersey: string;
  headshot?: string;
  gamesPlayed: number;
  gamesStarted: number;
  minutesPerGame: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  turnoversPerGame: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  plusMinus: number;
}

export async function fetchPlayerStats(playerId: string): Promise<ESPNPlayerSeasonStats | null> {
  logger.info(`[fetchPlayerStats] Fetching stats for player ${playerId}`);
  
  // Try the core API endpoint first - it has more reliable season stats
  const coreUrl = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2025/types/2/athletes/${playerId}/statistics`;
  
  try {
    const coreResponse = await fetch(coreUrl);
    if (coreResponse.ok) {
      const coreData = await coreResponse.json();
      logger.info(`[fetchPlayerStats] Core API response for ${playerId}`);
      
      // Parse core API stats
      const splits = coreData.splits?.categories || [];
      const statMap: Record<string, number> = {};
      
      for (const category of splits) {
        const categoryStats = category.stats || [];
        for (const stat of categoryStats) {
          if (stat.name && stat.value !== undefined) {
            statMap[stat.name] = parseFloat(stat.value);
          }
        }
      }
      
      logger.info(`[fetchPlayerStats] Core API stat keys: ${Object.keys(statMap).slice(0, 10).join(', ')}`);
      
      if (Object.keys(statMap).length > 0) {
        // Also fetch athlete info for name/position/headshot
        const athleteUrl = `${ESPN_BASE_URL}/athletes/${playerId}`;
        const athleteData = await fetchJSON<any>(athleteUrl);
        const athlete = athleteData?.athlete || athleteData || {};
        
        return {
          id: playerId,
          name: athlete.displayName || athlete.fullName || '',
          position: athlete.position?.abbreviation || '',
          jersey: athlete.jersey || '',
          headshot: athlete.headshot?.href || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${playerId}.png&w=350&h=254`,
          gamesPlayed: statMap['gamesPlayed'] || statMap['GP'] || 0,
          gamesStarted: statMap['gamesStarted'] || statMap['GS'] || 0,
          minutesPerGame: statMap['avgMinutes'] || statMap['minutes'] || 0,
          pointsPerGame: statMap['avgPoints'] || statMap['points'] || 0,
          reboundsPerGame: statMap['avgRebounds'] || statMap['rebounds'] || 0,
          assistsPerGame: statMap['avgAssists'] || statMap['assists'] || 0,
          stealsPerGame: statMap['avgSteals'] || statMap['steals'] || 0,
          blocksPerGame: statMap['avgBlocks'] || statMap['blocks'] || 0,
          turnoversPerGame: statMap['avgTurnovers'] || statMap['turnovers'] || 0,
          // ESPN returns percentages as whole numbers (51.26 = 51.26%), NOT decimals
          fgPct: statMap['fieldGoalPct'] || 0,
          fg3Pct: statMap['threePointFieldGoalPct'] || 0,
          ftPct: statMap['freeThrowPct'] || 0,
          plusMinus: statMap['plusMinus'] || 0,
        };
      }
    }
  } catch (e) {
    logger.info(`[fetchPlayerStats] Core API failed for ${playerId}, trying fallback`);
  }
  
  // Fallback to athlete endpoint
  const url = `${ESPN_BASE_URL}/athletes/${playerId}`;
  logger.info(`[fetchPlayerStats] Trying athlete endpoint: ${url}`);
  
  const data = await fetchJSON<any>(url);
  
  if (!data) {
    logger.info(`[fetchPlayerStats] No data returned for player ${playerId}`);
    return null;
  }
  
  // Handle both possible response structures
  const athlete = data.athlete || data;
  
  if (!athlete || (!athlete.id && !athlete.displayName)) {
    logger.info(`[fetchPlayerStats] Invalid athlete data for player ${playerId}`);
    return null;
  }
  
  logger.info(`[fetchPlayerStats] Found athlete: ${athlete.displayName || athlete.fullName}`);
  
  // Try multiple paths to find stats
  let stats: any[] = [];
  
  // Path 1: statistics[0].splits.categories[0].stats
  if (athlete.statistics?.[0]?.splits?.categories?.[0]?.stats) {
    stats = athlete.statistics[0].splits.categories[0].stats;
    logger.info(`[fetchPlayerStats] Found stats via splits.categories`);
  }
  // Path 2: statistics[0].stats
  else if (athlete.statistics?.[0]?.stats) {
    stats = athlete.statistics[0].stats;
    logger.info(`[fetchPlayerStats] Found stats via statistics.stats`);
  }
  // Path 3: statsSummary
  else if (athlete.statsSummary) {
    stats = athlete.statsSummary;
    logger.info(`[fetchPlayerStats] Found stats via statsSummary`);
  }
  
  logger.info(`[fetchPlayerStats] Stats array length: ${stats.length}`);
  
  // Convert stats array to map
  const statMap: Record<string, number> = {};
  for (const stat of stats) {
    if (stat.name && stat.value !== undefined) {
      statMap[stat.name] = parseFloat(stat.value);
    } else if (stat.abbreviation && stat.value !== undefined) {
      statMap[stat.abbreviation] = parseFloat(stat.value);
    } else if (stat.displayName && stat.displayValue !== undefined) {
      statMap[stat.displayName] = parseFloat(stat.displayValue);
    }
  }
  
  logger.info(`[fetchPlayerStats] Fallback stat map keys: ${Object.keys(statMap).join(', ')}`);

  return {
    id: athlete.id || playerId,
    name: athlete.displayName || athlete.fullName || '',
    position: athlete.position?.abbreviation || athlete.position?.name || '',
    jersey: athlete.jersey || '',
    headshot: athlete.headshot?.href || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${playerId}.png&w=350&h=254`,
    gamesPlayed: statMap['gamesPlayed'] || statMap['GP'] || 0,
    gamesStarted: statMap['gamesStarted'] || statMap['GS'] || 0,
    minutesPerGame: statMap['avgMinutes'] || statMap['MIN'] || 0,
    pointsPerGame: statMap['avgPoints'] || statMap['PTS'] || 0,
    reboundsPerGame: statMap['avgRebounds'] || statMap['REB'] || 0,
    assistsPerGame: statMap['avgAssists'] || statMap['AST'] || 0,
    stealsPerGame: statMap['avgSteals'] || statMap['STL'] || 0,
    blocksPerGame: statMap['avgBlocks'] || statMap['BLK'] || 0,
    turnoversPerGame: statMap['avgTurnovers'] || statMap['TO'] || 0,
    // ESPN returns percentages as whole numbers (51.26 = 51.26%), NOT decimals
    fgPct: statMap['fieldGoalPct'] || 0,
    fg3Pct: statMap['threePointFieldGoalPct'] || 0,
    ftPct: statMap['freeThrowPct'] || 0,
    plusMinus: statMap['plusMinus'] || 0,
  };
}

// ============================================
// BATCH PLAYER SEASON STATS FETCHER
// ============================================

export async function fetchPlayersSeasonStats(playerIds: string[]): Promise<Map<string, ESPNPlayerSeasonStats>> {
  const statsMap = new Map<string, ESPNPlayerSeasonStats>();
  
  // Fetch all player stats in parallel (with chunking to avoid too many requests)
  const chunkSize = 10;
  for (let i = 0; i < playerIds.length; i += chunkSize) {
    const chunk = playerIds.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(id => fetchPlayerStats(id).catch(() => null))
    );
    
    results.forEach((stats, idx) => {
      if (stats) {
        statsMap.set(chunk[idx], stats);
      }
    });
  }
  
  return statsMap;
}

// ============================================
// PREVIOUS GAMES FETCHER
// ============================================

export interface ESPNPreviousGame {
  id: string;
  date: string;
  homeTeam: {
    abbreviation: string;
    logo: string;
    score: number;
    winner: boolean;
  };
  awayTeam: {
    abbreviation: string;
    logo: string;
    score: number;
    winner: boolean;
  };
  status: 'final';
}

export async function fetchTeamPreviousGames(teamId: string, limit: number = 5): Promise<ESPNPreviousGame[]> {
  const url = `${ESPN_BASE_URL}/teams/${teamId}/schedule`;
  const data = await fetchJSON<any>(url);
  
  if (!data?.events) {
    return [];
  }

  const games: ESPNPreviousGame[] = [];
  const now = new Date();
  
  // Filter and sort completed games
  const completedEvents = data.events
    .filter((e: any) => {
      const status = e.competitions?.[0]?.status?.type?.name?.toLowerCase();
      return status?.includes('final');
    })
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  for (const event of completedEvents) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');
    
    if (!homeComp || !awayComp) continue;

    const homeScore = parseInt(homeComp.score?.displayValue || homeComp.score || '0');
    const awayScore = parseInt(awayComp.score?.displayValue || awayComp.score || '0');

    games.push({
      id: event.id,
      date: event.date,
      homeTeam: {
        abbreviation: homeComp.team?.abbreviation || '???',
        logo: homeComp.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${homeComp.team?.abbreviation?.toLowerCase()}.png`,
        score: homeScore,
        winner: homeScore > awayScore,
      },
      awayTeam: {
        abbreviation: awayComp.team?.abbreviation || '???',
        logo: awayComp.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${awayComp.team?.abbreviation?.toLowerCase()}.png`,
        score: awayScore,
        winner: awayScore > homeScore,
      },
      status: 'final',
    });
  }

  return games;
}

// ============================================
// SCOREBOARD / GAMES LIST FETCHER
// ============================================

export interface ESPNScoreboardGame {
  id: string;
  date: string;
  status: 'scheduled' | 'live' | 'halftime' | 'final' | 'postponed';
  period: number;
  clock: string;
  homeTeam: {
    id: string;
    abbreviation: string;
    displayName: string;
    logo: string;
    score: number;
    record?: string;
  };
  awayTeam: {
    id: string;
    abbreviation: string;
    displayName: string;
    logo: string;
    score: number;
    record?: string;
  };
}

export async function fetchScoreboard(date?: string): Promise<ESPNScoreboardGame[]> {
  // If no date provided, use today
  const dateStr = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
  const formattedDate = date ? date.replace(/-/g, '') : dateStr;
  
  const url = `${ESPN_BASE_URL}/scoreboard?dates=${formattedDate}`;
  const data = await fetchJSON<any>(url);
  
  if (!data?.events) {
    return [];
  }

  const games: ESPNScoreboardGame[] = [];
  
  for (const event of data.events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const homeComp = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayComp = competition.competitors?.find((c: any) => c.homeAway === 'away');
    
    if (!homeComp || !awayComp) continue;

    // Parse status
    const statusType = competition.status?.type?.name?.toLowerCase() || '';
    let status: ESPNScoreboardGame['status'] = 'scheduled';
    if (statusType.includes('in_progress') || statusType === 'in progress') status = 'live';
    else if (statusType === 'halftime') status = 'halftime';
    else if (statusType.includes('final')) status = 'final';
    else if (statusType.includes('postponed')) status = 'postponed';

    games.push({
      id: event.id,
      date: event.date,
      status,
      period: competition.status?.period || 0,
      clock: competition.status?.displayClock || '',
      homeTeam: {
        id: homeComp.id || homeComp.team?.id,
        abbreviation: homeComp.team?.abbreviation || '???',
        displayName: homeComp.team?.displayName || homeComp.team?.name || 'Unknown',
        logo: homeComp.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${homeComp.team?.abbreviation?.toLowerCase()}.png`,
        score: parseInt(homeComp.score || '0'),
        record: homeComp.records?.[0]?.summary,
      },
      awayTeam: {
        id: awayComp.id || awayComp.team?.id,
        abbreviation: awayComp.team?.abbreviation || '???',
        displayName: awayComp.team?.displayName || awayComp.team?.name || 'Unknown',
        logo: awayComp.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${awayComp.team?.abbreviation?.toLowerCase()}.png`,
        score: parseInt(awayComp.score || '0'),
        record: awayComp.records?.[0]?.summary,
      },
    });
  }

  return games;
}

// Fetch games for a date range
export async function fetchGamesForDateRange(startDate: string, endDate: string): Promise<ESPNScoreboardGame[]> {
  const allGames: ESPNScoreboardGame[] = [];
  
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    try {
      const games = await fetchScoreboard(dateStr);
      allGames.push(...games);
    } catch (error) {
      logger.error('Failed to fetch scoreboard for date', { date: dateStr, error: (error as Error).message });
    }
    current.setDate(current.getDate() + 1);
  }
  
  return allGames;
}

