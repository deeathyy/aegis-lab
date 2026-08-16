const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');

const API_ROOT = 'https://api.opendota.com/api';
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';
const cache = new Map();
const stratzHeroCache = new Map();
const MAX_API_CACHE_ENTRIES = 24;
const MAX_STRATZ_HERO_ENTRIES = 8;
const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR);
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: null,
  message: 'Готово к проверке обновлений',
};
let stratzRuntimeState = { status: 'disconnected', message: 'STRATZ не подключён' };

function rememberLimited(map, key, value, limit) {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value);
}

const STRATZ_HERO_QUERY = `
  query AegisHeroAnalytics($heroId: Short!) {
    heroStats {
      matchUp(heroId: $heroId, take: 140, skip: 0) {
        heroId
        vs { heroId1 heroId2 matchCount winCount synergy winRateHeroId1 winRateHeroId2 winsAverage }
      }
      itemStartingPurchase(heroId: $heroId) {
        itemId matchCount winCount wasGiven
      }
      earlyGame: itemFullPurchase(heroId: $heroId, minTime: 0, maxTime: 15, matchLimit: 2500) {
        itemId time matchCount winCount
      }
      midGame: itemFullPurchase(heroId: $heroId, minTime: 15, maxTime: 30, matchLimit: 2500) {
        itemId time matchCount winCount
      }
      lateGame: itemFullPurchase(heroId: $heroId, minTime: 30, maxTime: 90, matchLimit: 2500) {
        itemId time matchCount winCount
      }
    }
  }
`;

function stratzConfigPath() {
  return path.join(app.getPath('userData'), 'sources.json');
}

function getStratzToken() {
  if (process.env.STRATZ_TOKEN) return String(process.env.STRATZ_TOKEN).trim();
  try {
    const config = JSON.parse(fs.readFileSync(stratzConfigPath(), 'utf8'));
    if (!config.stratzToken || !safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(Buffer.from(config.stratzToken, 'base64')).trim();
  } catch {
    return '';
  }
}

function saveStratzToken(token) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Защищённое хранилище Windows недоступно');
  const file = stratzConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ stratzToken: safeStorage.encryptString(token).toString('base64') }), 'utf8');
}

function removeStratzToken() {
  try {
    const file = stratzConfigPath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
  stratzHeroCache.clear();
}

function getStratzState() {
  const configured = Boolean(getStratzToken());
  return {
    configured,
    status: configured ? (stratzRuntimeState.status === 'error' ? 'error' : 'connected') : 'disconnected',
    message: configured
      ? (stratzRuntimeState.status === 'error' ? stratzRuntimeState.message : 'STRATZ подключён и используется при загрузке героев')
      : 'Добавьте личный API-токен STRATZ',
  };
}

async function stratzGraphql(query, variables, tokenOverride) {
  const token = String(tokenOverride || getStratzToken()).trim();
  if (!token) throw new Error('STRATZ не подключён');
  const response = await fetch('https://api.stratz.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `AegisLab/${app.getVersion()} (desktop companion)`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? 'STRATZ отклонил токен или запрос заблокирован Cloudflare'
      : `STRATZ вернул ${response.status}`;
    stratzRuntimeState = { status: 'error', message };
    throw new Error(message);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    const message = `STRATZ: ${payload.errors[0].message || 'ошибка GraphQL'}`;
    stratzRuntimeState = { status: 'error', message };
    throw new Error(message);
  }
  stratzRuntimeState = { status: 'connected', message: 'STRATZ подключён' };
  return payload.data;
}

async function getStratzHeroPayload(heroId) {
  const id = Number(heroId);
  const cached = stratzHeroCache.get(id);
  if (cached && Date.now() - cached.savedAt < 15 * 60 * 1000) {
    rememberLimited(stratzHeroCache, id, cached, MAX_STRATZ_HERO_ENTRIES);
    return cached.promise;
  }
  const promise = stratzGraphql(STRATZ_HERO_QUERY, { heroId: id });
  rememberLimited(stratzHeroCache, id, { promise, savedAt: Date.now() }, MAX_STRATZ_HERO_ENTRIES);
  try {
    return await promise;
  } catch (error) {
    stratzHeroCache.delete(id);
    throw error;
  }
}

function publishUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('app:update-state', updateState);
  }
  return updateState;
}

function updateErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error || 'Неизвестная ошибка');
  if (/404|latest\.yml/i.test(raw)) return 'Для этой версии пока нет канала обновлений';
  if (/net::|ENOTFOUND|ECONN/i.test(raw)) return 'Нет соединения с сервером обновлений';
  return 'Не удалось проверить обновления';
}

async function checkForUpdates() {
  if (!app.isPackaged || process.platform !== 'win32' || isPortable) {
    return publishUpdateState({
      status: 'disabled',
      message: isPortable
        ? 'Автообновление доступно в установленной версии'
        : 'Проверка обновлений доступна после установки приложения',
    });
  }

  publishUpdateState({ status: 'checking', percent: null, message: 'Проверяем GitHub Releases…' });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publishUpdateState({ status: 'error', message: updateErrorMessage(error), percent: null });
  }
  return updateState;
}

function configureAutoUpdater() {
  if (!app.isPackaged || process.platform !== 'win32' || isPortable) {
    checkForUpdates();
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    publishUpdateState({ status: 'checking', percent: null, message: 'Проверяем GitHub Releases…' });
  });
  autoUpdater.on('update-available', (info) => {
    publishUpdateState({
      status: 'available',
      availableVersion: info.version,
      percent: 0,
      message: `Найдена версия ${info.version}. Начинаем загрузку…`,
    });
  });
  autoUpdater.on('update-not-available', () => {
    publishUpdateState({
      status: 'up-to-date',
      availableVersion: null,
      percent: null,
      message: `Установлена актуальная версия ${app.getVersion()}`,
    });
  });
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
    publishUpdateState({
      status: 'downloading',
      percent,
      message: `Загружаем обновление… ${percent}%`,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    publishUpdateState({
      status: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      message: `Версия ${info.version} готова к установке`,
    });
  });
  autoUpdater.on('error', (error) => {
    publishUpdateState({ status: 'error', percent: null, message: updateErrorMessage(error) });
  });

  setTimeout(checkForUpdates, 5000);
  const timer = setInterval(checkForUpdates, UPDATE_INTERVAL);
  timer.unref();
}

function cdnUrl(value) {
  if (!value) return '';
  return value.startsWith('http') ? value : `${STEAM_CDN}${value}`;
}

async function getJson(endpoint, ttl = 10 * 60 * 1000) {
  const cached = cache.get(endpoint);
  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.savedAt < ttl) {
    rememberLimited(cache, endpoint, cached, MAX_API_CACHE_ENTRIES);
    return cached.data;
  }
  cache.delete(endpoint);

  const promise = (async () => {
    const response = await fetch(`${API_ROOT}${endpoint}`, {
      headers: { 'User-Agent': `AegisLab/${app.getVersion()} (desktop companion)` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`OpenDota вернул ${response.status}`);
    return response.json();
  })();
  rememberLimited(cache, endpoint, { promise, savedAt: Date.now() }, MAX_API_CACHE_ENTRIES);
  try {
    const data = await promise;
    rememberLimited(cache, endpoint, { data, savedAt: Date.now() }, MAX_API_CACHE_ENTRIES);
    return data;
  } catch (error) {
    if (cache.get(endpoint)?.promise === promise) cache.delete(endpoint);
    throw error;
  }
}

function normalizeHero(hero) {
  const brackets = [1, 2, 3, 4, 5, 6, 7, 8];
  const picks = brackets.reduce((sum, bracket) => sum + Number(hero[`${bracket}_pick`] || 0), 0);
  const wins = brackets.reduce((sum, bracket) => sum + Number(hero[`${bracket}_win`] || 0), 0);
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
    publicPicks: picks,
    publicWins: wins,
    winRate: picks ? (wins / picks) * 100 : 0,
    proPicks: Number(hero.pro_pick || 0),
    proWins: Number(hero.pro_win || 0),
    proBans: Number(hero.pro_ban || 0),
  };
}

function normalizeItems(popularity, constants) {
  const constantEntries = Object.entries(constants).filter(([, item]) => item && item.id);
  const usedAsComponent = new Set(
    constantEntries.flatMap(([, item]) => Array.isArray(item.components) ? item.components : []),
  );
  const completeItemExceptions = new Set([
    'blink', 'travel_boots', 'tranquil_boots', 'arcane_boots', 'ultimate_scepter', 'moon_shard', 'aghanims_shard',
    'diffusal_blade', 'maelstrom', 'orchid', 'basher', 'vanguard', 'mekansm', 'dragon_lance', 'echo_sabre',
    'witch_blade', 'phylactery', 'rod_of_atos', 'veil_of_discord', 'aether_lens',
  ]);
  const itemsById = new Map(constantEntries.map(([key, item]) => [String(item.id), { ...item, key }]));
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
      items: entries.map(([id, count]) => {
        const item = itemsById.get(id) || {};
        return {
          id: Number(id),
          name: item.dname || item.name || `Предмет ${id}`,
          image: cdnUrl(item.img),
          cost: Number(item.cost || 0),
          count: Number(count),
          popularity: Math.round((Number(count) / max) * 100),
          isUpgrade: Array.isArray(item.components) && item.components.length > 0,
          isComplete: !usedAsComponent.has(item.key) || completeItemExceptions.has(item.key),
        };
      }),
    };
  });
}

function normalizeStratzBuild(data, constants) {
  const constantEntries = Object.entries(constants).filter(([, item]) => item?.id);
  const usedAsComponent = new Set(
    constantEntries.flatMap(([, item]) => Array.isArray(item.components) ? item.components : []),
  );
  const completeItemExceptions = new Set([
    'blink', 'travel_boots', 'tranquil_boots', 'arcane_boots', 'ultimate_scepter', 'moon_shard', 'aghanims_shard',
    'diffusal_blade', 'maelstrom', 'orchid', 'basher', 'vanguard', 'mekansm', 'dragon_lance', 'echo_sabre',
    'witch_blade', 'phylactery', 'rod_of_atos', 'veil_of_discord', 'aether_lens',
  ]);
  const itemsById = new Map(constantEntries.map(([key, item]) => [Number(item.id), { ...item, key }]));
  const phases = [
    { key: 'start_game_items', title: 'Старт', timing: 'до выхода крипов', rows: new Map() },
    { key: 'early_game_items', title: 'Ранняя игра', timing: 'до 15 мин', rows: new Map() },
    { key: 'mid_game_items', title: 'Середина', timing: '15–30 мин', rows: new Map() },
    { key: 'late_game_items', title: 'Поздняя игра', timing: 'после 30 мин', rows: new Map() },
  ];
  const add = (phase, row) => {
    const id = Number(row.itemId || 0);
    if (!id || !itemsById.get(id)?.img) return;
    const current = phase.rows.get(id) || { count: 0, wins: 0 };
    current.count += Number(row.matchCount || 0);
    current.wins += Number(row.winCount || 0);
    phase.rows.set(id, current);
  };
  for (const row of data?.heroStats?.itemStartingPurchase || []) {
    if (!row.wasGiven) add(phases[0], row);
  }
  for (const row of data?.heroStats?.earlyGame || []) add(phases[1], row);
  for (const row of data?.heroStats?.midGame || []) add(phases[2], row);
  for (const row of data?.heroStats?.lateGame || []) add(phases[3], row);
  return phases.map((phase) => {
    const entries = [...phase.rows.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
    const max = entries[0]?.[1].count || 1;
    return {
      key: phase.key,
      title: phase.title,
      timing: phase.timing,
      source: 'STRATZ',
      items: entries.map(([id, stats]) => {
        const item = itemsById.get(id) || {};
        return {
          id,
          name: item.dname || item.name || `Предмет ${id}`,
          image: cdnUrl(item.img || ''),
          cost: Number(item.cost || 0),
          count: stats.count,
          popularity: Math.round((stats.count / max) * 100),
          isUpgrade: Array.isArray(item.components) && item.components.length > 0,
          isComplete: !usedAsComponent.has(item.key) || completeItemExceptions.has(item.key),
        };
      }),
    };
  });
}

function normalizeStratzMatchups(data, selectedHeroId) {
  const aggregated = new Map();
  for (const group of data?.heroStats?.matchUp || []) {
    for (const row of group.vs || []) {
      const first = Number(row.heroId1 || 0);
      const second = Number(row.heroId2 || 0);
      const opponentId = first === selectedHeroId ? second : first;
      if (!opponentId || opponentId === selectedHeroId) continue;
      const games = Number(row.matchCount || 0);
      const firstWins = Number(row.winCount || 0);
      const wins = first === selectedHeroId ? firstWins : Math.max(0, games - firstWins);
      const current = aggregated.get(opponentId) || { heroId: opponentId, gamesPlayed: 0, wins: 0, source: 'STRATZ' };
      current.gamesPlayed += games;
      current.wins += wins;
      aggregated.set(opponentId, current);
    }
  }
  return [...aggregated.values()];
}

function normalizeProTeam(teamId, fallbackName, teamsById, matchTeam) {
  const team = matchTeam || teamsById.get(Number(teamId)) || {};
  return {
    id: Number(teamId || team.team_id || 0),
    name: String(team.name || fallbackName || 'Неизвестная команда').trim(),
    tag: String(team.tag || '').trim(),
    logo: cdnUrl(team.logo_url || ''),
  };
}

function normalizeProMatch(match, teamsById = new Map()) {
  return {
    matchId: Number(match.match_id),
    duration: Number(match.duration || 0),
    startTime: Number(match.start_time || 0),
    leagueId: Number(match.leagueid || 0),
    leagueName: String(match.league_name || match.league?.name || 'Профессиональный турнир').trim(),
    seriesId: Number(match.series_id || 0),
    radiant: normalizeProTeam(match.radiant_team_id, match.radiant_name, teamsById, match.radiant_team),
    dire: normalizeProTeam(match.dire_team_id, match.dire_name, teamsById, match.dire_team),
    radiantScore: Number(match.radiant_score || 0),
    direScore: Number(match.dire_score || 0),
    radiantWin: Boolean(match.radiant_win),
  };
}

function normalizeFinalItem(itemId, itemsById) {
  const id = Number(itemId || 0);
  if (!id) return null;
  const item = itemsById.get(id) || {};
  return {
    id,
    name: item.dname || item.name || `Предмет ${id}`,
    image: cdnUrl(item.img || ''),
  };
}

ipcMain.handle('dota:getHeroes', async () => {
  const heroes = (await getJson('/heroStats')).map(normalizeHero);
  const totalPicks = heroes.reduce((sum, hero) => sum + hero.publicPicks, 0);
  const ranked = [...heroes].sort((a, b) => b.winRate - a.winRate);
  const rankMap = new Map(ranked.map((hero, index) => [hero.id, index + 1]));
  return heroes.map((hero) => ({
    ...hero,
    pickRate: totalPicks ? (hero.publicPicks / totalPicks) * 100 : 0,
    winRateRank: rankMap.get(hero.id),
  }));
});

ipcMain.handle('dota:getBuild', async (_event, heroId) => {
  if (getStratzToken()) {
    try {
      const [stratzData, constants] = await Promise.all([
        getStratzHeroPayload(heroId),
        getJson('/constants/items', 24 * 60 * 60 * 1000),
      ]);
      const phases = normalizeStratzBuild(stratzData, constants);
      if (phases.slice(1).some((phase) => phase.items.length)) {
        if (!phases[0].items.length) {
          const popularity = await getJson(`/heroes/${Number(heroId)}/itemPopularity`, 30 * 60 * 1000);
          const fallbackStart = normalizeItems(popularity, constants)[0];
          phases[0] = { ...fallbackStart, source: 'STRATZ + OpenDota' };
          for (let index = 1; index < phases.length; index += 1) phases[index].source = 'STRATZ + OpenDota';
        }
        return phases;
      }
    } catch {}
  }
  const [popularity, constants] = await Promise.all([
    getJson(`/heroes/${Number(heroId)}/itemPopularity`, 30 * 60 * 1000),
    getJson('/constants/items', 24 * 60 * 60 * 1000),
  ]);
  return normalizeItems(popularity, constants);
});

ipcMain.handle('dota:getMatchups', async (_event, heroId) => {
  if (getStratzToken()) {
    try {
      const rows = normalizeStratzMatchups(await getStratzHeroPayload(heroId), Number(heroId));
      if (rows.length) return rows;
    } catch {}
  }
  const matchups = await getJson(`/heroes/${Number(heroId)}/matchups`, 30 * 60 * 1000);
  return matchups.map((matchup) => ({
    heroId: Number(matchup.hero_id),
    gamesPlayed: Number(matchup.games_played || 0),
    wins: Number(matchup.wins || 0),
    source: 'OpenDota',
  }));
});

ipcMain.handle('sources:getStratzState', () => getStratzState());
ipcMain.handle('sources:connectStratz', async (_event, rawToken) => {
  const token = String(rawToken || '').trim();
  if (token.length < 20) return { configured: false, status: 'error', message: 'Введите полный API-токен STRATZ' };
  try {
    await stratzGraphql('{ __typename }', {}, token);
    saveStratzToken(token);
    stratzHeroCache.clear();
    stratzRuntimeState = { status: 'connected', message: 'STRATZ подключён' };
    return getStratzState();
  } catch (error) {
    return { configured: false, status: 'error', message: error instanceof Error ? error.message : 'Не удалось подключить STRATZ' };
  }
});
ipcMain.handle('sources:disconnectStratz', () => {
  removeStratzToken();
  stratzRuntimeState = { status: 'disconnected', message: 'STRATZ не подключён' };
  return getStratzState();
});

ipcMain.handle('dota:getProMatches', async () => {
  const [matches, teams] = await Promise.all([
    getJson('/proMatches', 3 * 60 * 1000),
    getJson('/teams', 12 * 60 * 60 * 1000),
  ]);
  const teamsById = new Map(teams.map((team) => [Number(team.team_id), team]));
  return matches.slice(0, 100).map((match) => normalizeProMatch(match, teamsById));
});

ipcMain.handle('dota:getProMatchDetail', async (_event, matchId) => {
  const safeMatchId = Number(matchId);
  if (!Number.isSafeInteger(safeMatchId) || safeMatchId <= 0) throw new Error('Некорректный ID матча');
  const [matchResult, constantsResult, proPlayersResult] = await Promise.allSettled([
    getJson(`/matches/${safeMatchId}`, 30 * 60 * 1000),
    getJson('/constants/items', 24 * 60 * 60 * 1000),
    getJson('/proPlayers', 12 * 60 * 60 * 1000),
  ]);
  if (matchResult.status === 'rejected') throw matchResult.reason;
  if (constantsResult.status === 'rejected') throw constantsResult.reason;
  const match = matchResult.value;
  const constants = constantsResult.value;
  const proPlayers = proPlayersResult.status === 'fulfilled' ? proPlayersResult.value : [];
  const itemsById = new Map(
    Object.values(constants).filter((item) => item?.id).map((item) => [Number(item.id), item]),
  );
  const prosById = new Map(proPlayers.map((player) => [Number(player.account_id), player]));
  const summary = normalizeProMatch(match);
  return {
    ...summary,
    patch: Number(match.patch || 0),
    region: Number(match.region || 0),
    players: (match.players || []).map((player) => {
      const profile = prosById.get(Number(player.account_id)) || {};
      const items = [0, 1, 2, 3, 4, 5]
        .map((slot) => normalizeFinalItem(player[`item_${slot}`], itemsById))
        .filter(Boolean);
      return {
        accountId: Number(player.account_id || 0),
        name: String(player.name || profile.name || player.personaname || 'Игрок'),
        avatar: String(profile.avatarfull || profile.avatarmedium || profile.avatar || ''),
        isRadiant: Boolean(player.isRadiant ?? Number(player.player_slot || 0) < 128),
        heroId: Number(player.hero_id || 0),
        kills: Number(player.kills || 0),
        deaths: Number(player.deaths || 0),
        assists: Number(player.assists || 0),
        lastHits: Number(player.last_hits || 0),
        denies: Number(player.denies || 0),
        netWorth: Number(player.net_worth || player.total_gold || 0),
        gpm: Number(player.gold_per_min || 0),
        xpm: Number(player.xp_per_min || 0),
        heroDamage: Number(player.hero_damage || 0),
        towerDamage: Number(player.tower_damage || 0),
        items,
        neutralItem: normalizeFinalItem(player.item_neutral, itemsById),
      };
    }),
    draft: (match.picks_bans || []).map((event) => ({
      heroId: Number(event.hero_id || 0),
      isPick: Boolean(event.is_pick),
      team: Number(event.team) === 1 ? 1 : 0,
      order: Number(event.order || 0),
    })),
  };
});

ipcMain.handle('app:openExternal', (_event, url) => {
  const parsed = new URL(url);
  if (['https:', 'http:'].includes(parsed.protocol)) shell.openExternal(parsed.toString());
});

ipcMain.handle('app:getUpdateState', () => updateState);
ipcMain.handle('app:checkForUpdates', () => checkForUpdates());
ipcMain.handle('app:installUpdate', () => {
  if (updateState.status !== 'downloaded') return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#090a0f',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#090a0f', symbolColor: '#8a8f9f', height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false,
      v8CacheOptions: 'code',
    },
  });

  if (!app.isPackaged) window.loadURL('http://127.0.0.1:5173');
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  window.webContents.on('did-finish-load', () => {
    window.webContents.send('app:update-state', updateState);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  configureAutoUpdater();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
