export type AppPage = 'heroes' | 'meta' | 'knowledge';
export type ThemeMode = 'dark' | 'light';
export type DensityMode = 'comfortable' | 'compact';

export type AppSettings = {
  theme: ThemeMode;
  density: DensityMode;
  reduceMotion: boolean;
  startPage: AppPage;
};

export const SETTINGS_KEY = 'aegis-lab:settings';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  density: 'comfortable',
  reduceMotion: false,
  startPage: 'heroes',
};

export function loadSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<AppSettings>;
    return {
      theme: saved.theme === 'light' ? 'light' : 'dark',
      density: saved.density === 'compact' ? 'compact' : 'comfortable',
      reduceMotion: Boolean(saved.reduceMotion),
      startPage: ['heroes', 'meta', 'knowledge'].includes(saved.startPage || '')
        ? saved.startPage as AppPage
        : 'heroes',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applySettings(settings: AppSettings) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.density = settings.density;
  root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full';
  root.style.colorScheme = settings.theme;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
