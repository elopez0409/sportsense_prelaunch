// NBA Types - Core data structures for NBA functionality

export interface TeamInfo {
  id: string;
  externalId?: string;
  name: string;
  fullName: string;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface GameInfo {
  id: string;
  externalId?: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore: number | null;
  awayScore: number | null;
  status: 'SCHEDULED' | 'LIVE' | 'FINAL' | 'POSTPONED' | 'CANCELLED';
  period: number | null;
  gameClock: string | null;
  scheduledAt: Date;
  venue: string | null;
  nationalTv: string | null;
}

export interface PlayEvent {
  id: string;
  gameId: string;
  period: number;
  clock: string;
  description: string;
  scoreAfter: string;
  playType: string;
  teamId?: string;
  playerId?: string;
}

export interface PlayInfo {
  id: string;
  period: number;
  gameClock: string | null;
  playType: string;
  description: string;
  homeScore: number;
  awayScore: number;
  scoreChange: number;
  isBigPlay: boolean;
  isClutch: boolean;
}

export interface PlayerInfo {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  jerseyNumber: string | null;
  team: TeamInfo | null;
  headshotUrl: string | null;
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  plusMinus: number;
}

export interface PlayerGameStatsInfo {
  player: PlayerInfo;
  minutes: string | null;
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
  plusMinus: number;
}

export interface GameDetail extends GameInfo {
  plays: PlayInfo[];
  homePlayerStats: PlayerGameStatsInfo[];
  awayPlayerStats: PlayerGameStatsInfo[];
}

export interface AIGameContext {
  game: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    period: number | null;
    gameClock: string | null;
    venue: string | null;
    isLive: boolean;
  };
  recentPlays: {
    period: number;
    clock: string;
    description: string;
    scoreAfter: string;
  }[];
  homeLeaders: {
    points?: { player: string; value: number };
    rebounds?: { player: string; value: number };
    assists?: { player: string; value: number };
  };
  awayLeaders: {
    points?: { player: string; value: number };
    rebounds?: { player: string; value: number };
    assists?: { player: string; value: number };
  };
  dataSource: string;
  dataTimestamp: string;
}

// API Response types
export type BDLTeam = NbaApiTeam;
export type BDLPlayer = NbaApiPlayer;
export type BDLGame = NbaApiGame;

export interface BDLStats {
  id: number;
  min: string;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  pts: number;
  player: BDLPlayer;
  team: BDLTeam;
  game: BDLGame;
}

export interface BDLPaginatedResponse<T> {
  data: T[];
  meta: {
    total_pages: number;
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_count: number;
  };
}

export interface NBAStatsResponse<T> {
  resource: string;
  parameters: Record<string, unknown>;
  resultSets: {
    name: string;
    headers: string[];
    rowSet: (string | number | null)[][];
  }[];
}

export interface NBAStatsPlayByPlay {
  game_id: string;
  eventNum: number;
  eventMsgType: number;
  eventMsgActionType: number;
  period: number;
  wcTimeString: string;
  pcTimeString: string;
  homedescription: string | null;
  neutraldescription: string | null;
  visitordescription: string | null;
  score: string | null;
  scoreMargin: string | null;
  person1Type: number;
  player1Id: number;
  player1Name: string;
  player1TeamId: number;
  player1TeamCity: string;
  player1TeamNickname: string;
  player1TeamAbbreviation: string;
  person2Type: number;
  player2Id: number;
  player2Name: string;
  player2TeamId: number;
  player2TeamCity: string;
  player2TeamNickname: string;
  player2TeamAbbreviation: string;
  person3Type: number;
  player3Id: number;
  player3Name: string;
  player3TeamId: number;
  player3TeamCity: string;
  player3TeamNickname: string;
  player3TeamAbbreviation: string;
  videoAvailableFlag: number;
}

export interface NbaApiTeam {
  id: number;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  full_name: string;
  name: string;
}

export interface NbaApiPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height_feet: number | null;
  height_inches: number | null;
  weight_pounds: number | null;
  team: NbaApiTeam;
}

export interface NbaApiGame {
  id: number;
  date: string;
  home_team: NbaApiTeam;
  visitor_team: NbaApiTeam;
  home_team_score: number;
  visitor_team_score: number;
  period: number;
  status: string;
  time: string;
  postseason: boolean;
}

// Generic API Response type
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: Record<string, unknown>;
}
