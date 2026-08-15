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
};

export type BuildPhase = {
  key: string;
  title: string;
  timing: string;
  items: BuildItem[];
};

export type Matchup = {
  heroId: number;
  gamesPlayed: number;
  wins: number;
};

declare global {
  interface Window {
    dotaApi?: {
      getHeroes: () => Promise<Hero[]>;
      getBuild: (heroId: number) => Promise<BuildPhase[]>;
      getMatchups: (heroId: number) => Promise<Matchup[]>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
