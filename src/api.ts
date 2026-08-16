import type { BuildPhase, Hero, Matchup, ProItem, ProMatchDetail, ProMatchSummary, ProTeam, StratzConnectionState } from './types';

const API_ROOT = 'https://api.opendota.com/api';
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';
const browserResponseCache = new Map<string, { expiresAt: number; promise: Promise<any> }>();

function cachedJson<T>(url: string, ttl: number): Promise<T> {
  const cached = browserResponseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    browserResponseCache.delete(url);
    browserResponseCache.set(url, cached);
    return cached.promise as Promise<T>;
  }
  browserResponseCache.delete(url);
  const promise = fetch(url, { signal: AbortSignal.timeout(20000) }).then((response) => {
    if (!response.ok) throw new Error(`OpenDota вернул ${response.status}`);
    return response.json();
  });
  browserResponseCache.set(url, { expiresAt: Date.now() + ttl, promise });
  while (browserResponseCache.size > 18) browserResponseCache.delete(browserResponseCache.keys().next().value!);
  promise.catch(() => {
    if (browserResponseCache.get(url)?.promise === promise) browserResponseCache.delete(url);
  });
  return promise as Promise<T>;
}

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
    baseHealth: Math.round(Number(hero.base_health || 0) + Number(hero.base_str || 0) * 22),
    baseMana: Math.round(Number(hero.base_mana || 0) + Number(hero.base_int || 0) * 12),
    baseArmor: Number(hero.base_armor || 0) + Number(hero.base_agi || 0) / 6,
    moveSpeed: hero.move_speed,
    baseStrength: Number(hero.base_str || 0),
    baseAgility: Number(hero.base_agi || 0),
    baseIntelligence: Number(hero.base_int || 0),
    strengthGain: Number(hero.str_gain || 0),
    agilityGain: Number(hero.agi_gain || 0),
    intelligenceGain: Number(hero.int_gain || 0),
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
  const heroes = (await cachedJson<Record<string, any>[]>(`${API_ROOT}/heroStats`, 10 * 60 * 1000)).map(normalizeHero) as Hero[];
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
  const [popularity, constants] = await Promise.all([
    cachedJson<Record<string, any>>(`${API_ROOT}/heroes/${heroId}/itemPopularity`, 30 * 60 * 1000),
    cachedJson<Record<string, any>>(`${API_ROOT}/constants/items`, 24 * 60 * 60 * 1000),
  ]);
  const constantEntries = Object.entries(constants).filter(([, item]: [string, any]) => item && item.id);
  const usedAsComponent = new Set<string>(
    constantEntries.flatMap(([, item]: [string, any]) => Array.isArray(item.components) ? item.components : []),
  );
  const completeItemExceptions = new Set([
    'blink', 'travel_boots', 'tranquil_boots', 'arcane_boots', 'ultimate_scepter', 'moon_shard', 'aghanims_shard',
    'diffusal_blade', 'maelstrom', 'orchid', 'basher', 'vanguard', 'mekansm', 'dragon_lance', 'echo_sabre',
    'witch_blade', 'phylactery', 'rod_of_atos', 'veil_of_discord', 'aether_lens',
  ]);
  const itemsById = new Map<string, Record<string, any>>(
    constantEntries.map(([key, item]: [string, any]) => [String(item.id), { ...item, key }]),
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
      source: 'OpenDota',
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
          isComplete: !usedAsComponent.has(item.key) || completeItemExceptions.has(item.key),
        };
      }),
    };
  });
}

function normalizeBrowserTeam(teamId: number, name: string, teams: Map<number, Record<string, any>>, matchTeam?: Record<string, any>): ProTeam {
  const team = matchTeam || teams.get(teamId) || {};
  return {
    id: teamId || Number(team.team_id || 0),
    name: String(team.name || name || 'Неизвестная команда').trim(),
    tag: String(team.tag || '').trim(),
    logo: cdnUrl(team.logo_url || ''),
  };
}

function normalizeBrowserMatch(match: Record<string, any>, teams = new Map<number, Record<string, any>>()): ProMatchSummary {
  return {
    matchId: Number(match.match_id),
    duration: Number(match.duration || 0),
    startTime: Number(match.start_time || 0),
    leagueId: Number(match.leagueid || 0),
    leagueName: String(match.league_name || match.league?.name || 'Профессиональный турнир').trim(),
    seriesId: Number(match.series_id || 0),
    radiant: normalizeBrowserTeam(Number(match.radiant_team_id || 0), match.radiant_name, teams, match.radiant_team),
    dire: normalizeBrowserTeam(Number(match.dire_team_id || 0), match.dire_name, teams, match.dire_team),
    radiantScore: Number(match.radiant_score || 0),
    direScore: Number(match.dire_score || 0),
    radiantWin: Boolean(match.radiant_win),
  };
}

async function browserProMatches(): Promise<ProMatchSummary[]> {
  const [matches, teams] = await Promise.all([
    cachedJson<Record<string, any>[]>(`${API_ROOT}/proMatches`, 3 * 60 * 1000),
    cachedJson<Record<string, any>[]>(`${API_ROOT}/teams`, 12 * 60 * 60 * 1000),
  ]);
  const teamsById = new Map<number, Record<string, any>>(teams.map((team: Record<string, any>) => [Number(team.team_id), team]));
  return matches.slice(0, 100).map((match: Record<string, any>) => normalizeBrowserMatch(match, teamsById));
}

async function browserProMatchDetail(matchId: number): Promise<ProMatchDetail> {
  const [match, constants, proPlayers] = await Promise.all([
    cachedJson<Record<string, any>>(`${API_ROOT}/matches/${matchId}`, 30 * 60 * 1000),
    cachedJson<Record<string, any>>(`${API_ROOT}/constants/items`, 24 * 60 * 60 * 1000),
    cachedJson<Record<string, any>[]>(`${API_ROOT}/proPlayers`, 12 * 60 * 60 * 1000).catch(() => []),
  ]);
  const itemsById = new Map<number, Record<string, any>>(
    Object.values(constants).filter((item: any) => item?.id).map((item: any) => [Number(item.id), item]),
  );
  const prosById = new Map<number, Record<string, any>>(proPlayers.map((player: Record<string, any>) => [Number(player.account_id), player]));
  const getItem = (itemId: number): ProItem | null => {
    const id = Number(itemId || 0);
    if (!id) return null;
    const item = itemsById.get(id) || {};
    return { id, name: item.dname || item.name || `Предмет ${id}`, image: cdnUrl(item.img || '') };
  };
  return {
    ...normalizeBrowserMatch(match),
    patch: Number(match.patch || 0),
    region: Number(match.region || 0),
    players: (match.players || []).map((player: Record<string, any>) => {
      const profile = prosById.get(Number(player.account_id)) || {};
      return {
        accountId: Number(player.account_id || 0),
        name: String(player.name || profile.name || player.personaname || 'Игрок'),
        avatar: String(profile.avatarfull || profile.avatarmedium || profile.avatar || ''),
        isRadiant: Boolean(player.isRadiant ?? Number(player.player_slot || 0) < 128),
        heroId: Number(player.hero_id || 0),
        kills: Number(player.kills || 0), deaths: Number(player.deaths || 0), assists: Number(player.assists || 0),
        lastHits: Number(player.last_hits || 0), denies: Number(player.denies || 0),
        netWorth: Number(player.net_worth || player.total_gold || 0),
        gpm: Number(player.gold_per_min || 0), xpm: Number(player.xp_per_min || 0),
        heroDamage: Number(player.hero_damage || 0), towerDamage: Number(player.tower_damage || 0),
        items: [0, 1, 2, 3, 4, 5].map((slot) => getItem(player[`item_${slot}`])).filter(Boolean) as ProItem[],
        neutralItem: getItem(player.item_neutral),
      };
    }),
    draft: (match.picks_bans || []).map((event: Record<string, any>) => ({
      heroId: Number(event.hero_id || 0), isPick: Boolean(event.is_pick),
      team: Number(event.team) === 1 ? 1 : 0, order: Number(event.order || 0),
    })),
  };
}

export const dotaApi = {
  getHeroes: () => window.dotaApi?.getHeroes() ?? browserHeroes(),
  getBuild: (heroId: number) => window.dotaApi?.getBuild(heroId) ?? browserBuild(heroId),
  getMatchups: (heroId: number): Promise<Matchup[]> => window.dotaApi?.getMatchups(heroId) ?? cachedJson<Record<string, any>[]>(`${API_ROOT}/heroes/${heroId}/matchups`, 30 * 60 * 1000)
    .then((rows) => rows.map((row: Record<string, any>) => ({
      heroId: Number(row.hero_id),
      gamesPlayed: Number(row.games_played || 0),
      wins: Number(row.wins || 0),
      source: 'OpenDota',
    }))),
  getProMatches: (): Promise<ProMatchSummary[]> => window.dotaApi?.getProMatches() ?? browserProMatches(),
  getProMatchDetail: (matchId: number): Promise<ProMatchDetail> => window.dotaApi?.getProMatchDetail(matchId) ?? browserProMatchDetail(matchId),
  openExternal: (url: string) => window.dotaApi?.openExternal(url) ?? Promise.resolve(window.open(url, '_blank') as any),
};

const DESKTOP_ONLY_STRATZ: StratzConnectionState = {
  configured: false,
  status: 'desktop-only',
  message: 'Подключение STRATZ доступно в установленном приложении',
};

export const stratzApi = {
  getState: (): Promise<StratzConnectionState> => window.stratzApi?.getState() ?? Promise.resolve(DESKTOP_ONLY_STRATZ),
  connect: (token: string): Promise<StratzConnectionState> => window.stratzApi?.connect(token) ?? Promise.resolve(DESKTOP_ONLY_STRATZ),
  disconnect: (): Promise<StratzConnectionState> => window.stratzApi?.disconnect() ?? Promise.resolve(DESKTOP_ONLY_STRATZ),
};
