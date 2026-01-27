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

    // Parse player stats using dynamic label-based index lookup
    // ESPN uses different stat orderings in different games/endpoints:
    // Format 1: [MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS]
    // Format 2: [MIN, PTS, FG, 3PT, FT, REB, AST, TO, STL, BLK, OREB, DREB, PF, +/-]
    const parsePlayerStats = (players: any[], teamId: string, teamLabels: string[] = []): ESPNPlayerStats[] => {
      if (!players || !Array.isArray(players)) {
        logger.info('No players array to parse', { teamId });
        return [];
      }
      
      logger.info('Parsing player stats', { teamId, playerCount: players.length, labelsCount: teamLabels.length });
      
      // Build index map from labels (case-insensitive)
      const labelMap: Record<string, number> = {};
      teamLabels.forEach((label, idx) => {
        if (label) {
          labelMap[label.toUpperCase()] = idx;
        }
      });
      
      // Helper to get index by label name
      const getIndex = (labelNames: string[]): number => {
        for (const name of labelNames) {
          if (labelMap[name.toUpperCase()] !== undefined) {
            return labelMap[name.toUpperCase()];
          }
        }
        return -1;
      };
      
      // Find indices for each stat using labels
      const minIdx = getIndex(['MIN', 'MINS', 'Minutes']);
      const ptsIdx = getIndex(['PTS', 'Points']);
      const fgIdx = getIndex(['FG', 'Field Goals']);
      const fg3Idx = getIndex(['3PT', '3P', 'Three Pointers']);
      const ftIdx = getIndex(['FT', 'Free Throws']);
      const rebIdx = getIndex(['REB', 'Rebounds', 'TREB']);
      const astIdx = getIndex(['AST', 'Assists']);
      const toIdx = getIndex(['TO', 'TOV', 'Turnovers']);
      const stlIdx = getIndex(['STL', 'Steals']);
      const blkIdx = getIndex(['BLK', 'Blocks']);
      const pmIdx = getIndex(['+/-', 'PM', 'PLUSMINUS', 'Plus/Minus']);
      
      logger.info('Label index mapping', {
        minIdx, ptsIdx, fgIdx, fg3Idx, ftIdx, rebIdx, astIdx, toIdx, stlIdx, blkIdx, pmIdx,
        labels: teamLabels.join(', '),
      });
      
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
        const stats = p.stats || p.statistics?.[0]?.stats || [];
        
        // Log raw stats for first player
        if (players.indexOf(p) === 0) {
          logger.info('Player stats raw', { 
            athleteName: p.athlete?.displayName,
            statsRaw: stats,
            didPlay: p.didNotPlay !== true,
          });
        }
        
        const parseShooting = (str: string): [number, number] => {
          if (!str || str === '--' || str === '-' || str === '0') return [0, 0];
          const parts = String(str).split('-');
          if (parts.length !== 2) return [0, 0];
          return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0];
        };
        
        const getStatByIndex = (idx: number, defaultVal = '0'): string => {
          if (idx < 0 || !Array.isArray(stats) || idx >= stats.length) return defaultVal;
          return String(stats[idx] ?? defaultVal);
        };
        
        // Use label-based indices if available, otherwise fall back to hardcoded indices
        const useIdx = (labelIdx: number, fallbackIdx: number): number => {
          return labelIdx >= 0 ? labelIdx : fallbackIdx;
        };
        
        // Get stats using label-based or fallback indices
        const minutes = getStatByIndex(useIdx(minIdx, 0));
        const fgStr = getStatByIndex(useIdx(fgIdx, 1));
        const fg3Str = getStatByIndex(useIdx(fg3Idx, 2));
        const ftStr = getStatByIndex(useIdx(ftIdx, 3));
        
        const [fgm, fga] = parseShooting(fgStr);
        const [fg3m, fg3a] = parseShooting(fg3Str);
        const [ftm, fta] = parseShooting(ftStr);
        
        // Get counting stats using label-based indices
        let points = parseInt(getStatByIndex(useIdx(ptsIdx, 13))) || 0;
        let rebounds = parseInt(getStatByIndex(useIdx(rebIdx, 6))) || 0;
        let assists = parseInt(getStatByIndex(useIdx(astIdx, 7))) || 0;
        let steals = parseInt(getStatByIndex(useIdx(stlIdx, 8))) || 0;
        let blocks = parseInt(getStatByIndex(useIdx(blkIdx, 9))) || 0;
        let turnovers = parseInt(getStatByIndex(useIdx(toIdx, 10))) || 0;
        let plusMinus = getStatByIndex(useIdx(pmIdx, 12));
        
        // CRITICAL VALIDATION: Basketball counting stats can NEVER be negative
        // If we got a negative value, something went wrong with index detection
        points = Math.max(0, points);
        rebounds = Math.max(0, rebounds);
        assists = Math.max(0, assists);
        steals = Math.max(0, steals);
        blocks = Math.max(0, blocks);
        turnovers = Math.max(0, turnovers);
        
        // Calculate percentages
        const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0.0';
        const fg3Pct = fg3a > 0 ? ((fg3m / fg3a) * 100).toFixed(1) : '0.0';
        const ftPct = fta > 0 ? ((ftm / fta) * 100).toFixed(1) : '0.0';

        // Extract player name - try multiple paths
        const playerName = p.athlete?.displayName || 
                          p.athlete?.fullName || 
                          p.displayName || 
                          p.fullName || 
                          p.name || 
                          'Unknown';
        
        const playerId = p.athlete?.id || p.id || '';
        const playerJersey = p.athlete?.jersey || p.jersey || '0';
        const playerPosition = p.athlete?.position?.abbreviation || 
                              p.athlete?.position?.name || 
                              p.position?.abbreviation || 
                              p.position?.name || 
                              p.position || 
                              '';
        const playerHeadshot = p.athlete?.headshot?.href || 
                              p.athlete?.headshot || 
                              p.headshot?.href || 
                              p.headshot || 
                              undefined;
        
        return {
          player: {
            id: playerId,
            name: playerName,
            displayName: playerName,
            shortName: p.athlete?.shortName || p.shortName || playerName.split(' ').pop() || playerName,
            jersey: playerJersey,
            position: playerPosition,
            headshot: playerHeadshot,
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
        
        // Get labels and athletes from statistics - labels are at team level, not player level
        const statGroup = team.statistics?.[0] || {};
        const teamLabels = statGroup.labels || [];
        const athletes = statGroup.athletes || team.athletes || [];
        
        logger.info('Processing boxscore players for team', { 
          teamId, 
          teamAbbrev,
          teamName,
          athletesCount: athletes.length,
          hasStatistics: !!team.statistics,
          statisticsLength: team.statistics?.length || 0,
          labelsFound: teamLabels.length,
          labels: teamLabels,
        });
        
        const isHomeTeam = teamId === homeTeam.id || teamAbbrev === homeTeam.abbreviation;
        
        if (isHomeTeam) {
          homeStats = parsePlayerStats(athletes, teamId, teamLabels);
          logger.info('Home team player stats parsed', { 
            teamName,
            playerCount: homeStats.length,
            topScorer: homeStats[0] ? `${homeStats[0].player.shortName} (${homeStats[0].points} pts)` : 'none'
          });
        } else {
          awayStats = parsePlayerStats(athletes, teamId, teamLabels);
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

    // Also try to get stats from team.statistics or team.stats
    const allStats = [
      ...stats,
      ...(team.statistics || []),
      ...(team.stats || []),
      ...(record?.statistics || []),
    ];

    // Parse stats with multiple name variations
    const getStatValue = (names: string | string[]) => {
      const nameArray = Array.isArray(names) ? names : [names];
      for (const name of nameArray) {
        // Try exact match
        let stat = allStats.find((s: any) => 
          s.name?.toLowerCase() === name.toLowerCase() ||
          s.displayName?.toLowerCase() === name.toLowerCase() ||
          s.abbreviation?.toLowerCase() === name.toLowerCase()
        );
        if (stat) {
          const value = parseFloat(stat.value || stat.displayValue || '0');
          if (value > 0) return value;
        }
        
        // Try partial match
        stat = allStats.find((s: any) => 
          s.name?.toLowerCase().includes(name.toLowerCase()) ||
          s.displayName?.toLowerCase().includes(name.toLowerCase())
        );
        if (stat) {
          const value = parseFloat(stat.value || stat.displayValue || '0');
          if (value > 0) return value;
        }
      }
      return 0;
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

    // Try to fetch team stats from a dedicated stats endpoint if main stats are missing
    let teamStats = {
      ppg: getStatValue(['avgPointsFor', 'pointsFor', 'points per game', 'ppg', 'avg points']),
      oppg: getStatValue(['avgPointsAgainst', 'pointsAgainst', 'opponent points per game', 'oppg', 'opp points']),
      rpg: getStatValue(['avgRebounds', 'rebounds', 'rebounds per game', 'rpg', 'avg rebounds', 'totalRebounds']),
      apg: getStatValue(['avgAssists', 'assists', 'assists per game', 'apg', 'avg assists', 'totalAssists']),
      fgPct: (getStatValue(['fieldGoalPct', 'field goal pct', 'fg%', 'fgpct', 'field goal percentage']) || 0) * (getStatValue(['fieldGoalPct']) > 1 ? 1 : 100),
      fg3Pct: (getStatValue(['threePointFieldGoalPct', 'three point field goal pct', '3pt%', '3p%', 'fg3pct', 'three point percentage']) || 0) * (getStatValue(['threePointFieldGoalPct']) > 1 ? 1 : 100),
      ftPct: (getStatValue(['freeThrowPct', 'free throw pct', 'ft%', 'ftpct', 'free throw percentage']) || 0) * (getStatValue(['freeThrowPct']) > 1 ? 1 : 100),
    };

    // If key stats are missing, try fetching from team stats endpoint
    if (teamStats.rpg === 0 && teamStats.apg === 0) {
      try {
        const seasonYear = getCurrentSeason();
        const statsUrl = `${ESPN_BASE_URL}/teams/${teamId}/statistics?seasontype=2&season=${seasonYear}`;
        const statsData = await fetchJSON<any>(statsUrl);
        
        if (statsData?.splits?.categories) {
          const statMap: Record<string, number> = {};
          for (const category of statsData.splits.categories) {
            for (const stat of category.stats || []) {
              if (stat.name && stat.value !== undefined) {
                const statName = stat.name.toLowerCase();
                const statValue = typeof stat.value === 'string' || typeof stat.value === 'number' 
                  ? parseFloat(String(stat.value)) 
                  : 0;
                if (!isNaN(statValue)) {
                  statMap[statName] = statValue;
                }
              }
            }
          }
          
          // Update stats if we found them
          if (statMap['avgrebounds'] || statMap['rebounds per game']) {
            teamStats.rpg = statMap['avgrebounds'] || statMap['rebounds per game'] || teamStats.rpg;
          }
          if (statMap['avgassists'] || statMap['assists per game']) {
            teamStats.apg = statMap['avgassists'] || statMap['assists per game'] || teamStats.apg;
          }
          if (statMap['fieldgoalpct'] || statMap['field goal pct']) {
            const fg = statMap['fieldgoalpct'] || statMap['field goal pct'] || 0;
            teamStats.fgPct = fg > 1 ? fg : fg * 100;
          }
          if (statMap['threepointfieldgoalpct'] || statMap['three point field goal pct']) {
            const fg3 = statMap['threepointfieldgoalpct'] || statMap['three point field goal pct'] || 0;
            teamStats.fg3Pct = fg3 > 1 ? fg3 : fg3 * 100;
          }
          if (statMap['freethrowpct'] || statMap['free throw pct']) {
            const ft = statMap['freethrowpct'] || statMap['free throw pct'] || 0;
            teamStats.ftPct = ft > 1 ? ft : ft * 100;
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch team stats from stats endpoint', { teamId, error: (error as Error).message });
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
      stats: teamStats,
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

/**
 * Get the current NBA season year
 * NBA seasons typically start in October, so if we're past October, we're in the new season
 * For 2025-26 season, if we're in 2025 and it's October or later, return 2025
 * If we're in 2026 and it's before October, we're still in 2025-26 season, so return 2025
 */
function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  
  // NBA season runs from October to June
  // If we're in October (10), November (11), December (12), January (1), February (2), 
  // March (3), April (4), May (5), or June (6), we're in the season that started in the previous October
  // If we're in July (7), August (8), or September (9), we're in the off-season before the new season
  
  if (month >= 10) {
    // October-December: We're in the season that started this year
    return year;
  } else if (month >= 1 && month <= 6) {
    // January-June: We're in the season that started last October
    return year - 1;
  } else {
    // July-September: Off-season, return the season that just ended (which started last October)
    return year - 1;
  }
}

export async function fetchPlayerStats(
  playerId: string, 
  season?: number
): Promise<ESPNPlayerSeasonStats | null> {
  const seasonYear = season || getCurrentSeason();
  logger.info(`[fetchPlayerStats] Fetching stats for player ${playerId}, season ${seasonYear}`);
  
  // Try the web API endpoint first - this matches what ESPN's website uses
  // This endpoint provides the most accurate current season stats
  // Add season parameter to ensure we get the right season
  const webApiUrl = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${playerId}/stats?seasontype=2&season=${seasonYear}`;
  
  logger.info(`[fetchPlayerStats] Fetching from web API: ${webApiUrl}`);
  
  try {
    const webResponse = await fetch(webApiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    logger.info(`[fetchPlayerStats] Web API response status: ${webResponse.status}`);
    
    if (webResponse.ok) {
      const webData = await webResponse.json();
      logger.info(`[fetchPlayerStats] Web API response for ${playerId}`, {
        hasSplits: !!webData.splits,
        splitsCount: webData.splits?.length || 0,
        hasCategories: !!webData.categories,
        categoriesCount: webData.categories?.length || 0,
        responseKeys: Object.keys(webData),
      });
      
      // ESPN web API can return data in different structures:
      // 1. splits array (older format)
      // 2. categories array (newer format)
      // 3. Direct stats in categories
      
      let currentSeasonStats: any = null;
      const splits = webData.splits || [];
      const categories = webData.categories || [];
      
      // Try splits first (if available)
      if (splits.length > 0) {
        logger.info(`[fetchPlayerStats] Found splits, parsing...`);
        // Log all splits to see what we have
        logger.info(`[fetchPlayerStats] Available splits:`, splits.map((s: any, i: number) => ({
          index: i,
          type: s.type,
          season: s.season?.year || s.season,
          displayName: s.displayName,
          hasStats: !!s.stats,
          statsCount: s.stats?.length || 0,
        })));
        
        // Find stats for the requested season
        for (const split of splits) {
          const splitSeason = split.season?.year || split.season;
          if (splitSeason === seasonYear || (!season && split.type === 'season')) {
            currentSeasonStats = split;
            logger.info(`[fetchPlayerStats] Found matching season split`);
            break;
          }
        }
        
        // If no exact match, find the most recent season split
        if (!currentSeasonStats && splits.length > 0) {
          const seasonSplits = splits
            .filter((s: any) => s.type === 'season' && (s.season?.year || s.season))
            .sort((a: any, b: any) => {
              const seasonA = a.season?.year || a.season || 0;
              const seasonB = b.season?.year || b.season || 0;
              return seasonB - seasonA;
            });
          
          if (seasonSplits.length > 0) {
            currentSeasonStats = seasonSplits[0];
          } else {
            currentSeasonStats = splits[0];
          }
        }
      }
      
      // If no splits, try categories structure
      if (!currentSeasonStats && categories.length > 0) {
        logger.info(`[fetchPlayerStats] No splits found, trying categories structure`);
        logger.info(`[fetchPlayerStats] Available categories:`, categories.map((c: any, i: number) => ({
          index: i,
          name: c.name,
          displayName: c.displayName,
          hasStats: !!c.stats,
          statsCount: c.stats?.length || 0,
        })));
        
        // Categories structure: each category has stats array
        // Look for the main stats category (usually first one or named "regular")
        for (const category of categories) {
          if (category.stats && category.stats.length > 0) {
            // Check if this looks like season stats (has games played, points, etc.)
            const statNames = category.stats.map((s: any) => (s.name || s.abbreviation || '').toLowerCase());
            const hasKeyStats = statNames.some((name: string) => 
              name.includes('points') || name.includes('rebounds') || name.includes('assists') || 
              name === 'pts' || name === 'reb' || name === 'ast'
            );
            
            if (hasKeyStats) {
              currentSeasonStats = category;
              logger.info(`[fetchPlayerStats] Found stats in category: ${category.name || category.displayName}`);
              break;
            }
          }
        }
        
        // If still no match, use first category with stats
        if (!currentSeasonStats) {
          for (const category of categories) {
            if (category.stats && category.stats.length > 0) {
              currentSeasonStats = category;
              logger.info(`[fetchPlayerStats] Using first category with stats: ${category.name || category.displayName}`);
              break;
            }
          }
        }
      }
      
      if (currentSeasonStats && currentSeasonStats.stats) {
        const statMap: Record<string, number> = {};
        
        // Log raw stats structure
        logger.info(`[fetchPlayerStats] Raw stats array (first 5):`, currentSeasonStats.stats.slice(0, 5));
        
        // Parse stats array - ESPN web API uses an array of stat objects
        for (const stat of currentSeasonStats.stats) {
          if (stat.name && stat.value !== undefined && stat.value !== null) {
            statMap[stat.name.toLowerCase()] = parseFloat(stat.value);
          }
          // Also check for abbreviation and displayName
          if (stat.abbreviation && stat.value !== undefined && stat.value !== null) {
            statMap[stat.abbreviation.toLowerCase()] = parseFloat(stat.value);
          }
          // Check for displayName
          if (stat.displayName && stat.value !== undefined && stat.value !== null) {
            statMap[stat.displayName.toLowerCase()] = parseFloat(stat.value);
          }
        }
        
        logger.info(`[fetchPlayerStats] Web API stat keys (all): ${Object.keys(statMap).join(', ')}`);
        logger.info(`[fetchPlayerStats] Web API stat values sample:`, {
          points: statMap['points'] || statMap['pts'] || statMap['avgpoints'] || statMap['avg points'],
          rebounds: statMap['rebounds'] || statMap['reb'] || statMap['avgrebounds'] || statMap['avg rebounds'],
          assists: statMap['assists'] || statMap['ast'] || statMap['avgassists'] || statMap['avg assists'],
          fgPct: statMap['fieldgoalpct'] || statMap['fgpct'] || statMap['fg%'],
        });
        
        if (Object.keys(statMap).length > 0) {
          // Also fetch athlete info for name/position/headshot
          const athleteUrl = `${ESPN_BASE_URL}/athletes/${playerId}`;
          const athleteData = await fetchJSON<any>(athleteUrl);
          const athlete = athleteData?.athlete || athleteData || {};
          
          // Map stat names - ESPN web API uses various naming conventions
          // Try multiple variations including spaces, camelCase, and abbreviations
          const pointsPerGame = statMap['avg points'] || statMap['avgpoints'] || statMap['points per game'] || statMap['points'] || statMap['pts'] || statMap['pointspergame'] || 0;
          const reboundsPerGame = statMap['avg rebounds'] || statMap['avgrebounds'] || statMap['rebounds per game'] || statMap['rebounds'] || statMap['reb'] || statMap['reboundspergame'] || 0;
          const assistsPerGame = statMap['avg assists'] || statMap['avgassists'] || statMap['assists per game'] || statMap['assists'] || statMap['ast'] || statMap['assistspergame'] || 0;
          const stealsPerGame = statMap['avg steals'] || statMap['avgsteals'] || statMap['steals per game'] || statMap['steals'] || statMap['stl'] || statMap['stealspergame'] || 0;
          const blocksPerGame = statMap['avg blocks'] || statMap['avgblocks'] || statMap['blocks per game'] || statMap['blocks'] || statMap['blk'] || statMap['blockspergame'] || 0;
          const minutesPerGame = statMap['avg minutes'] || statMap['avgminutes'] || statMap['minutes per game'] || statMap['minutes'] || statMap['min'] || statMap['minutespergame'] || 0;
          const gamesPlayed = statMap['games played'] || statMap['gamesplayed'] || statMap['gp'] || statMap['games'] || 0;
          const turnoversPerGame = statMap['avg turnovers'] || statMap['avgturnovers'] || statMap['turnovers per game'] || statMap['turnovers'] || statMap['to'] || statMap['turnoverspergame'] || 0;
          
          // Percentages - ESPN returns as whole numbers (51.2 = 51.2%)
          const fgPct = statMap['field goal pct'] || statMap['fieldgoalpct'] || statMap['fg pct'] || statMap['fgpct'] || statMap['fg%'] || statMap['field goal %'] || 0;
          const fg3Pct = statMap['three point field goal pct'] || statMap['threepointfieldgoalpct'] || statMap['3pt pct'] || statMap['fg3pct'] || statMap['3p%'] || statMap['3ptpct'] || statMap['three point %'] || 0;
          const ftPct = statMap['free throw pct'] || statMap['freethrowpct'] || statMap['ft pct'] || statMap['ftpct'] || statMap['ft%'] || statMap['free throw %'] || 0;
          
          logger.info(`[fetchPlayerStats] Parsed stats for ${athlete.displayName || playerId}:`, {
            ppg: pointsPerGame,
            rpg: reboundsPerGame,
            apg: assistsPerGame,
            fgPct,
            source: 'web-api',
            season: seasonYear,
          });
          
          // If we got 0 for key stats, log warning
          if (pointsPerGame === 0 && reboundsPerGame === 0 && assistsPerGame === 0) {
            logger.warn(`[fetchPlayerStats] All key stats are 0 - might be parsing wrong fields`, {
              statMapKeys: Object.keys(statMap),
              sampleValues: Object.entries(statMap).slice(0, 10),
            });
          }
          
          return {
            id: playerId,
            name: athlete.displayName || athlete.fullName || '',
            position: athlete.position?.abbreviation || '',
            jersey: athlete.jersey || '',
            headshot: athlete.headshot?.href || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${playerId}.png&w=350&h=254`,
            gamesPlayed,
            gamesStarted: statMap['gamesstarted'] || statMap['gs'] || 0,
            minutesPerGame,
            pointsPerGame,
            reboundsPerGame,
            assistsPerGame,
            stealsPerGame,
            blocksPerGame,
            turnoversPerGame,
            fgPct,
            fg3Pct,
            ftPct,
            plusMinus: statMap['plusminus'] || statMap['+/-'] || 0,
          };
        }
      }
    }
  } catch (e) {
    const errorData: Record<string, unknown> = e instanceof Error 
      ? { message: e.message, stack: e.stack } 
      : { error: String(e) };
    logger.info(`[fetchPlayerStats] Web API failed for ${playerId}, trying core API:`, errorData);
  }
  
  // Fallback to core API endpoint
  const coreUrl = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${seasonYear}/types/2/athletes/${playerId}/statistics`;
  
  try {
    const coreResponse = await fetch(coreUrl);
    if (coreResponse.ok) {
      const coreData = await coreResponse.json();
      logger.info(`[fetchPlayerStats] Core API response for ${playerId}`);
      
      // Parse core API stats
      // Core API structure: splits.categories[] where each category has stats[]
      const splits = coreData.splits?.categories || [];
      const statMap: Record<string, number> = {};
      
      logger.info(`[fetchPlayerStats] Core API has ${splits.length} categories`);
      
      // Parse ALL categories to get all stats
      for (const category of splits) {
        const categoryName = category.name || category.displayName || 'unknown';
        const categoryStats = category.stats || [];
        logger.info(`[fetchPlayerStats] Parsing category "${categoryName}" with ${categoryStats.length} stats`);
        
        for (const stat of categoryStats) {
          if (stat.name && stat.value !== undefined) {
            const statName = stat.name.toLowerCase();
            statMap[statName] = parseFloat(stat.value);
          }
          // Also check abbreviation
          if (stat.abbreviation && stat.value !== undefined) {
            const statAbbr = stat.abbreviation.toLowerCase();
            statMap[statAbbr] = parseFloat(stat.value);
          }
        }
      }
      
      logger.info(`[fetchPlayerStats] Core API stat keys (all): ${Object.keys(statMap).join(', ')}`);
      logger.info(`[fetchPlayerStats] Core API key stats:`, {
        points: statMap['avgpoints'] || statMap['points'] || statMap['pts'],
        rebounds: statMap['avgrebounds'] || statMap['rebounds'] || statMap['reb'],
        assists: statMap['avgassists'] || statMap['assists'] || statMap['ast'],
        fgPct: statMap['fieldgoalpct'] || statMap['fgpct'],
      });
      
      if (Object.keys(statMap).length > 0) {
        // Also fetch athlete info for name/position/headshot
        const athleteUrl = `${ESPN_BASE_URL}/athletes/${playerId}`;
        const athleteData = await fetchJSON<any>(athleteUrl);
        const athlete = athleteData?.athlete || athleteData || {};
        
        // Map stat names with more variations
        const pointsPerGame = statMap['avgpoints'] || statMap['points'] || statMap['pts'] || 0;
        const reboundsPerGame = statMap['avgrebounds'] || statMap['rebounds'] || statMap['reb'] || 0;
        const assistsPerGame = statMap['avgassists'] || statMap['assists'] || statMap['ast'] || 0;
        const stealsPerGame = statMap['avgsteals'] || statMap['steals'] || statMap['stl'] || 0;
        const blocksPerGame = statMap['avgblocks'] || statMap['blocks'] || statMap['blk'] || 0;
        const minutesPerGame = statMap['avgminutes'] || statMap['minutes'] || statMap['min'] || 0;
        const gamesPlayed = statMap['gamesplayed'] || statMap['gp'] || 0;
        const turnoversPerGame = statMap['avgturnovers'] || statMap['turnovers'] || statMap['to'] || 0;
        
        return {
          id: playerId,
          name: athlete.displayName || athlete.fullName || '',
          position: athlete.position?.abbreviation || '',
          jersey: athlete.jersey || '',
          headshot: athlete.headshot?.href || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${playerId}.png&w=350&h=254`,
          gamesPlayed,
          gamesStarted: statMap['gamesstarted'] || statMap['gs'] || 0,
          minutesPerGame,
          pointsPerGame,
          reboundsPerGame,
          assistsPerGame,
          stealsPerGame,
          blocksPerGame,
          turnoversPerGame,
          fgPct: statMap['fieldgoalpct'] || statMap['fgpct'] || 0,
          fg3Pct: statMap['threepointfieldgoalpct'] || statMap['fg3pct'] || 0,
          ftPct: statMap['freethrowpct'] || statMap['ftpct'] || 0,
          plusMinus: statMap['plusminus'] || 0,
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

/**
 * Fetch career stats for a player (all-time averages)
 */
export async function fetchPlayerCareerStats(playerId: string): Promise<ESPNPlayerSeasonStats | null> {
  logger.info(`[fetchPlayerCareerStats] Fetching career stats for player ${playerId}`);
  
  try {
    // ESPN career stats endpoint
    const careerUrl = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${playerId}/statistics`;
    const response = await fetch(careerUrl);
    
    if (response.ok) {
      const data = await response.json();
      const splits = data.splits?.categories || [];
      const statMap: Record<string, number> = {};
      
      for (const category of splits) {
        const categoryStats = category.stats || [];
        for (const stat of categoryStats) {
          if (stat.name && stat.value !== undefined) {
            statMap[stat.name] = parseFloat(stat.value);
          }
        }
      }
      
      if (Object.keys(statMap).length > 0) {
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
          fgPct: statMap['fieldGoalPct'] || 0,
          fg3Pct: statMap['threePointFieldGoalPct'] || 0,
          ftPct: statMap['freeThrowPct'] || 0,
          plusMinus: statMap['plusMinus'] || 0,
        };
      }
    }
  } catch (e) {
    const errorData = e instanceof Error ? { message: e.message, stack: e.stack } : { error: String(e) };
    logger.info(`[fetchPlayerCareerStats] Failed for ${playerId}:`, errorData);
  }
  
  return null;
}

/**
 * Fetch stats for a specific historical season
 */
export async function fetchPlayerStatsForSeason(playerId: string, seasonYear: number): Promise<ESPNPlayerSeasonStats | null> {
  return fetchPlayerStats(playerId, seasonYear);
}

// ============================================
// BATCH PLAYER SEASON STATS FETCHER
// ============================================

export async function fetchPlayersSeasonStats(
  playerIds: string[], 
  season?: number
): Promise<Map<string, ESPNPlayerSeasonStats>> {
  const statsMap = new Map<string, ESPNPlayerSeasonStats>();
  
  // Fetch all player stats in parallel (with chunking to avoid too many requests)
  const chunkSize = 10;
  for (let i = 0; i < playerIds.length; i += chunkSize) {
    const chunk = playerIds.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(id => fetchPlayerStats(id, season).catch(() => null))
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
// PLAYER SEARCH
// ============================================

export interface ESPNPlayerSearchResult {
  id: string;
  name: string;
  displayName: string;
  shortName: string;
  position: string;
  jersey: string;
  headshot?: string;
  team?: {
    id: string;
    name: string;
    abbreviation: string;
    logo: string;
  };
}

/**
 * Search for NBA players by name using ESPN's athlete search API
 */
export async function searchPlayers(query: string, limit: number = 10): Promise<ESPNPlayerSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchQuery = encodeURIComponent(query.trim());
  
  // ESPN's athlete search endpoint
  const url = `https://site.web.api.espn.com/apis/common/v3/search?query=${searchQuery}&limit=${limit}&type=player&sport=basketball&league=nba`;
  
  logger.info(`[searchPlayers] Searching for: ${query}`);
  
  try {
    // Add timeout for serverless environments
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      logger.warn(`[searchPlayers] Search API returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const results: ESPNPlayerSearchResult[] = [];
    
    // ESPN search returns results in different structures
    const items = data.results || data.athletes || data.items || [];
    
    for (const item of items) {
      // Handle different response structures
      const athlete = item.athlete || item;
      
      if (!athlete.id) continue;
      
      results.push({
        id: String(athlete.id),
        name: athlete.displayName || athlete.fullName || athlete.name || '',
        displayName: athlete.displayName || athlete.fullName || '',
        shortName: athlete.shortName || athlete.lastName || '',
        position: athlete.position?.abbreviation || athlete.position?.name || '',
        jersey: athlete.jersey || '',
        headshot: athlete.headshot?.href || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${athlete.id}.png&w=350&h=254`,
        team: athlete.team ? {
          id: String(athlete.team.id),
          name: athlete.team.displayName || athlete.team.name || '',
          abbreviation: athlete.team.abbreviation || '',
          logo: athlete.team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${athlete.team.abbreviation?.toLowerCase()}.png`,
        } : undefined,
      });
    }
    
    logger.info(`[searchPlayers] Found ${results.length} results for "${query}"`);
    return results.slice(0, limit);
    
  } catch (error) {
    logger.error('[searchPlayers] Search failed', { query, error: (error as Error).message });
    return [];
  }
}

/**
 * Fetch detailed player info including bio
 * Uses the core ESPN API which is more reliable for athlete data
 */
export async function fetchPlayerDetail(playerId: string): Promise<{
  id: string;
  name: string;
  displayName: string;
  firstName: string;
  lastName: string;
  position: string;
  jersey: string;
  height: string;
  weight: string;
  birthDate: string;
  birthPlace: string;
  college: string;
  draft: string;
  experience: number;
  headshot: string;
  team?: {
    id: string;
    name: string;
    abbreviation: string;
    logo: string;
    color: string;
  };
} | null> {
  // Use the core ESPN API - more reliable for athlete data
  const coreUrl = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${playerId}`;
  
  logger.info(`[fetchPlayerDetail] Fetching player ${playerId} from core API`);
  
  try {
    // Add timeout for serverless environments
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(coreUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      logger.warn(`[fetchPlayerDetail] Core API returned ${response.status} for player ${playerId}`);
      return null;
    }
    
    const athlete = await response.json();
    
    if (!athlete || !athlete.id) {
      return null;
    }
    
    // Fetch team info if available (it's a $ref in the core API)
    let teamInfo: {
      id: string;
      name: string;
      abbreviation: string;
      logo: string;
      color: string;
    } | undefined;
    
    if (athlete.team?.$ref) {
      try {
        const teamRes = await fetch(athlete.team.$ref);
        if (teamRes.ok) {
          const team = await teamRes.json();
          teamInfo = {
            id: String(team.id),
            name: team.displayName || team.name || '',
            abbreviation: team.abbreviation || '',
            logo: team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nba/500/${team.abbreviation?.toLowerCase()}.png`,
            color: team.color || '#333',
          };
        }
      } catch {
        // Team fetch failed, continue without team info
      }
    }
    
    // Fetch position info if available
    let position = '';
    if (athlete.position?.$ref) {
      try {
        const posRes = await fetch(athlete.position.$ref);
        if (posRes.ok) {
          const pos = await posRes.json();
          position = pos.displayName || pos.abbreviation || '';
        }
      } catch {
        // Position fetch failed
      }
    }
    
    // Parse draft info - can be direct object or $ref
    let draftInfo = 'Undrafted';
    if (athlete.draft) {
      // Check if draft info is directly available
      if (athlete.draft.year && athlete.draft.round && athlete.draft.selection) {
        draftInfo = `${athlete.draft.year} Round ${athlete.draft.round}, Pick ${athlete.draft.selection}`;
      } else if (athlete.draft.displayText) {
        // Use displayText if available
        draftInfo = athlete.draft.displayText;
      } else if (athlete.draft.$ref) {
        // Fallback to fetching from $ref
        try {
          const draftRes = await fetch(athlete.draft.$ref);
          if (draftRes.ok) {
            const d = await draftRes.json();
            draftInfo = `${d.year} Round ${d.round}, Pick ${d.selection}`;
          }
        } catch {
          // Draft fetch failed
        }
      }
    }
    
    // Parse college info
    let college = '';
    if (athlete.college?.$ref) {
      try {
        const collegeRes = await fetch(athlete.college.$ref);
        if (collegeRes.ok) {
          const c = await collegeRes.json();
          college = c.name || '';
        }
      } catch {
        // College fetch failed
      }
    }
    
    // Parse birth place
    let birthPlace = '';
    if (athlete.birthPlace?.$ref) {
      try {
        const placeRes = await fetch(athlete.birthPlace.$ref);
        if (placeRes.ok) {
          const place = await placeRes.json();
          birthPlace = place.city && place.country 
            ? `${place.city}, ${place.country}`
            : place.country || '';
        }
      } catch {
        // Birth place fetch failed
      }
    }
    
    return {
      id: String(athlete.id),
      name: athlete.displayName || athlete.fullName || '',
      displayName: athlete.displayName || athlete.fullName || '',
      firstName: athlete.firstName || '',
      lastName: athlete.lastName || '',
      position,
      jersey: athlete.jersey || '',
      height: athlete.displayHeight || '',
      weight: athlete.displayWeight || '',
      birthDate: athlete.dateOfBirth || '',
      birthPlace,
      college,
      draft: draftInfo,
      experience: athlete.experience?.years || (athlete.debutYear ? new Date().getFullYear() - athlete.debutYear : 0),
      headshot: athlete.headshot?.href || `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${playerId}.png&w=350&h=254`,
      team: teamInfo,
    };
    
  } catch (error) {
    logger.error('[fetchPlayerDetail] Failed', { playerId, error: (error as Error).message });
    return null;
  }
}

/**
 * Fetch player's recent game logs
 */
export async function fetchPlayerGameLogs(playerId: string, limit: number = 10): Promise<{
  gameId: string;
  date: string;
  opponent: string;
  isHome: boolean;
  result: 'W' | 'L';
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
}[]> {
  const seasonYear = getCurrentSeason() + 1; // ESPN uses the end year (2025-26 = 2026)
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${playerId}/gamelog?seasontype=2&season=${seasonYear}`;
  
  logger.info(`[fetchPlayerGameLogs] Fetching game logs for player ${playerId}, season ${seasonYear}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    if (!response.ok) {
      logger.warn(`[fetchPlayerGameLogs] Failed with status ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const games: {
      gameId: string;
      date: string;
      opponent: string;
      isHome: boolean;
      result: 'W' | 'L';
      minutes: number;
      points: number;
      rebounds: number;
      assists: number;
      steals: number;
      blocks: number;
      fgm: number;
      fga: number;
      fg3m: number;
      fg3a: number;
    }[] = [];
    
    // ESPN gamelog structure:
    // - events: { [gameId]: { gameDate, opponent, atVs, gameResult, ... } }
    // - seasonTypes[].categories[].events[]: { eventId, stats[] }
    // - labels: ['MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS']
    
    const eventsMap = data.events || {};
    const seasonTypes = data.seasonTypes || [];
    
    // Build a map of eventId -> stats from seasonTypes
    const statsMap: Map<string, string[]> = new Map();
    for (const seasonType of seasonTypes) {
      for (const category of seasonType.categories || []) {
        for (const event of category.events || []) {
          if (event.eventId && event.stats) {
            statsMap.set(event.eventId, event.stats);
          }
        }
      }
    }
    
    // Parse shooting stats (e.g., "6-16" -> [6, 16])
    const parseShooting = (str: string): [number, number] => {
      if (!str || str === '--') return [0, 0];
      const parts = str.split('-');
      if (parts.length !== 2) return [0, 0];
      return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0];
    };
    
    // Process each event from the events map
    for (const [gameId, eventData] of Object.entries(eventsMap)) {
      if (games.length >= limit) break;
      
      const event = eventData as any;
      const stats = statsMap.get(gameId) || [];
      
      // Stats order: MIN, FG, FG%, 3PT, 3P%, FT, FT%, REB, AST, BLK, STL, PF, TO, PTS
      const [fgm, fga] = parseShooting(stats[1] || '0-0');
      const [fg3m, fg3a] = parseShooting(stats[3] || '0-0');
      
      games.push({
        gameId,
        date: event.gameDate || '',
        opponent: event.opponent?.abbreviation || '',
        isHome: event.atVs === 'vs',
        result: event.gameResult === 'W' ? 'W' : 'L',
        minutes: parseInt(stats[0]) || 0,
        points: parseInt(stats[13]) || 0,
        rebounds: parseInt(stats[7]) || 0,
        assists: parseInt(stats[8]) || 0,
        steals: parseInt(stats[10]) || 0,
        blocks: parseInt(stats[9]) || 0,
        fgm,
        fga,
        fg3m,
        fg3a,
      });
    }
    
    // Sort by date descending (most recent first)
    games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    logger.info(`[fetchPlayerGameLogs] Found ${games.length} game logs for player ${playerId}`);
    return games.slice(0, limit);
    
  } catch (error) {
    logger.error('[fetchPlayerGameLogs] Failed', { playerId, error: (error as Error).message });
    return [];
  }
}