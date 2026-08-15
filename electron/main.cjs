const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

const API_ROOT = 'https://api.opendota.com/api';
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';
const cache = new Map();

function cdnUrl(value) {
  if (!value) return '';
  return value.startsWith('http') ? value : `${STEAM_CDN}${value}`;
}

async function getJson(endpoint, ttl = 10 * 60 * 1000) {
  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.savedAt < ttl) return cached.data;

  const response = await fetch(`${API_ROOT}${endpoint}`, {
    headers: { 'User-Agent': 'AegisLab/0.3 (desktop companion)' },
  });
  if (!response.ok) throw new Error(`OpenDota вернул ${response.status}`);
  const data = await response.json();
  cache.set(endpoint, { data, savedAt: Date.now() });
  return data;
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
    baseHealth: hero.base_health,
    baseMana: hero.base_mana,
    baseArmor: hero.base_armor,
    moveSpeed: hero.move_speed,
    publicPicks: picks,
    publicWins: wins,
    winRate: picks ? (wins / picks) * 100 : 0,
    proPicks: Number(hero.pro_pick || 0),
    proWins: Number(hero.pro_win || 0),
    proBans: Number(hero.pro_ban || 0),
  };
}

function normalizeItems(popularity, constants) {
  const itemsById = new Map(
    Object.values(constants)
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item]),
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
        };
      }),
    };
  });
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
  const [popularity, constants] = await Promise.all([
    getJson(`/heroes/${Number(heroId)}/itemPopularity`, 30 * 60 * 1000),
    getJson('/constants/items', 24 * 60 * 60 * 1000),
  ]);
  return normalizeItems(popularity, constants);
});

ipcMain.handle('dota:getMatchups', async (_event, heroId) => {
  const matchups = await getJson(`/heroes/${Number(heroId)}/matchups`, 30 * 60 * 1000);
  return matchups.map((matchup) => ({
    heroId: Number(matchup.hero_id),
    gamesPlayed: Number(matchup.games_played || 0),
    wins: Number(matchup.wins || 0),
  }));
});

ipcMain.handle('app:openExternal', (_event, url) => {
  const parsed = new URL(url);
  if (['https:', 'http:'].includes(parsed.protocol)) shell.openExternal(parsed.toString());
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#090a0f',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#090a0f', symbolColor: '#8a8f9f', height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) window.loadURL('http://127.0.0.1:5173');
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
