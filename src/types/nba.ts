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

export interface GameDetail extends GameInfo {
  plays: PlayEvent[];
  homeStats: PlayerStats[];
  awayStats: PlayerStats[];
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
