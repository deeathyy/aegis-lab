import type { BuildPhase, Hero, Matchup } from './types';

const API_ROOT = 'https://api.opendota.com/api';
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';

function cdnUrl(value: string) {
  return value?.startsWith('http') ? value : `${STEAM_CDN}${value || ''}`;
}

function normalizeHero(hero: Record<string, any>): Hero {
  const brackets = [1, 2, 3, 4, 5, 6, 7, 8];
  const publicPicks = brackets.reduce((sum, bracket) => sum + Number(hero[`${bracket}_pick`] || 0), 0);
  const publicWins = brackets.reduce((sum, bracket) => sum + Number(hero[`${bracket}_win`] || 0), 0);
  return {
    id: hero.id,
    name: hero.localized_name,
    key: hero.name.replace('npc_dota_hero_', ''),
    image: cdnUrl(hero.img),
    icon: cdnUrl(hero.icon),
    primaryAttr: hero.primary_attr,
    attackType: hero.attack_type,
    roles: hero.roles || [],
    baseHealth: hero.base_health,
    baseMana: hero.base_mana,
    baseArmor: hero.base_armor,
    moveSpeed: hero.move_speed,
    publicPicks,
    publicWins,
    winRate: publicPicks ? (publicWins / publicPicks) * 100 : 0,
    pickRate: 0,
    winRateRank: 0,
    proPicks: Number(hero.pro_pick || 0),
    proWins: Number(hero.pro_win || 0),
    proBans: Number(hero.pro_ban || 0),
  };
}

async function browserHeroes(): Promise<Hero[]> {
  const response = await fetch(`${API_ROOT}/heroStats`);
  if (!response.ok) throw new Error(`OpenDota вернул ${response.status}`);
  const heroes = (await response.json()).map(normalizeHero) as Hero[];
  const totalPicks = heroes.reduce((sum, hero) => sum + hero.publicPicks, 0);
  const ranked = [...heroes].sort((a, b) => b.winRate - a.winRate);
  const rankMap = new Map(ranked.map((hero, index) => [hero.id, index + 1]));
  return heroes.map((hero) => ({
    ...hero,
    pickRate: totalPicks ? (hero.publicPicks / totalPicks) * 100 : 0,
    winRateRank: rankMap.get(hero.id) || 0,
  }));
}

async function browserBuild(heroId: number): Promise<BuildPhase[]> {
  const [popularityResponse, itemsResponse] = await Promise.all([
    fetch(`${API_ROOT}/heroes/${heroId}/itemPopularity`),
    fetch(`${API_ROOT}/constants/items`),
  ]);
  if (!popularityResponse.ok || !itemsResponse.ok) throw new Error('Не удалось загрузить сборку');
  const popularity = await popularityResponse.json();
  const constants = await itemsResponse.json();
  const itemsById = new Map<string, Record<string, any>>(
    Object.values(constants)
      .filter((item: any) => item && item.id)
      .map((item: any) => [String(item.id), item]),
  );
  const phases = [
    ['start_game_items', 'Старт', '0:00'],
    ['early_game_items', 'Ранняя игра', 'до 15 мин'],
    ['mid_game_items', 'Середина', '15–30 мин'],
    ['late_game_items', 'Поздняя игра', 'после 30 мин'],
  ];
  return phases.map(([key, title, timing]) => {
    const entries = Object.entries(popularity[key] || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .filter(([id]) => itemsById.get(id)?.img)
      .slice(0, 12);
    const max = Number(entries[0]?.[1] || 1);
    return {
      key,
      title,
      timing,
      items: entries.map(([id, value]) => {
        const item = itemsById.get(id) || {};
        return {
          id: Number(id),
          name: item.dname || item.name || `Предмет ${id}`,
          image: cdnUrl(item.img),
          cost: Number(item.cost || 0),
          count: Number(value),
          popularity: Math.round((Number(value) / max) * 100),
          isUpgrade: Array.isArray(item.components) && item.components.length > 0,
        };
      }),
    };
  });
}

export const dotaApi = {
  getHeroes: () => window.dotaApi?.getHeroes() ?? browserHeroes(),
  getBuild: (heroId: number) => window.dotaApi?.getBuild(heroId) ?? browserBuild(heroId),
  getMatchups: (heroId: number): Promise<Matchup[]> => window.dotaApi?.getMatchups(heroId) ?? fetch(`${API_ROOT}/heroes/${heroId}/matchups`)
    .then((response) => {
      if (!response.ok) throw new Error(`OpenDota вернул ${response.status}`);
      return response.json();
    })
    .then((rows) => rows.map((row: Record<string, any>) => ({
      heroId: Number(row.hero_id),
      gamesPlayed: Number(row.games_played || 0),
      wins: Number(row.wins || 0),
    }))),
  openExternal: (url: string) => window.dotaApi?.openExternal(url) ?? Promise.resolve(window.open(url, '_blank') as any),
};
