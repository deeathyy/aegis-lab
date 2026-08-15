const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

const API_ROOT = 'https://api.opendota.com/api';
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';
const cache = new Map();
const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR);
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: null,
  message: 'Готово к проверке обновлений',
};

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
  if (cached && Date.now() - cached.savedAt < ttl) return cached.data;

  const response = await fetch(`${API_ROOT}${endpoint}`, {
    headers: { 'User-Agent': `AegisLab/${app.getVersion()} (desktop companion)` },
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
