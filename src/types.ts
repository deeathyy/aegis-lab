export type Hero = {
  id: number;
  name: string;
  key: string;
  image: string;
  icon: string;
  primaryAttr: 'str' | 'agi' | 'int' | 'all';
  attackType: string;
  roles: string[];
  baseHealth: number;
  baseMana: number;
  baseArmor: number;
  moveSpeed: number;
  baseStrength: number;
  baseAgility: number;
  baseIntelligence: number;
  strengthGain: number;
  agilityGain: number;
  intelligenceGain: number;
  publicPicks: number;
  publicWins: number;
  winRate: number;
  pickRate: number;
  winRateRank: number;
  proPicks: number;
  proWins: number;
  proBans: number;
};

export type BuildItem = {
  id: number;
  name: string;
  image: string;
  cost: number;
  count: number;
  popularity: number;
  isUpgrade: boolean;
  isComplete: boolean;
};

export type BuildPhase = {
  key: string;
  title: string;
  timing: string;
  items: BuildItem[];
  source?: 'OpenDota' | 'STRATZ' | 'STRATZ + OpenDota';
};

export type Matchup = {
  heroId: number;
  gamesPlayed: number;
  wins: number;
  source?: 'OpenDota' | 'STRATZ';
};

export type StratzConnectionState = {
  configured: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'desktop-only';
  message: string;
};

export type ProTeam = {
  id: number;
  name: string;
  tag: string;
  logo: string;
};

export type ProMatchSummary = {
  matchId: number;
  duration: number;
  startTime: number;
  leagueId: number;
  leagueName: string;
  seriesId: number;
  radiant: ProTeam;
  dire: ProTeam;
  radiantScore: number;
  direScore: number;
  radiantWin: boolean;
};

export type ProItem = {
  id: number;
  name: string;
  image: string;
};

export type ProMatchPlayer = {
  accountId: number;
  name: string;
  avatar: string;
  isRadiant: boolean;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  netWorth: number;
  gpm: number;
  xpm: number;
  heroDamage: number;
  towerDamage: number;
  items: ProItem[];
  neutralItem: ProItem | null;
};

export type DraftEvent = {
  heroId: number;
  isPick: boolean;
  team: 0 | 1;
  order: number;
};

export type ProMatchDetail = ProMatchSummary & {
  patch: number;
  region: number;
  players: ProMatchPlayer[];
  draft: DraftEvent[];
};

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
  | 'disabled';

export type UpdateState = {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  percent: number | null;
  message: string;
};

declare global {
  interface Window {
    appDisplay?: {
      setZoomFactor: (factor: number) => void;
    };
    stratzApi?: {
      getState: () => Promise<StratzConnectionState>;
      connect: (token: string) => Promise<StratzConnectionState>;
      disconnect: () => Promise<StratzConnectionState>;
    };
    dotaApi?: {
      getHeroes: () => Promise<Hero[]>;
      getBuild: (heroId: number) => Promise<BuildPhase[]>;
      getMatchups: (heroId: number) => Promise<Matchup[]>;
      getProMatches: () => Promise<ProMatchSummary[]>;
      getProMatchDetail: (matchId: number) => Promise<ProMatchDetail>;
      openExternal: (url: string) => Promise<void>;
    };
    appUpdater?: {
      getState: () => Promise<UpdateState>;
      check: () => Promise<UpdateState>;
      install: () => Promise<boolean>;
      onState: (callback: (state: UpdateState) => void) => () => void;
    };
  }
}
