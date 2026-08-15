export type AppPage = 'heroes' | 'meta' | 'matches' | 'knowledge';
export type ThemeMode = 'dark' | 'light';
export type DensityMode = 'comfortable' | 'compact';
export type UiScale = 1 | 1.15 | 1.3 | 1.45;

export type AppSettings = {
  theme: ThemeMode;
  density: DensityMode;
  uiScale: UiScale;
  reduceMotion: boolean;
  startPage: AppPage;
};

export const SETTINGS_KEY = 'aegis-lab:settings';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  density: 'comfortable',
  uiScale: 1.3,
  reduceMotion: false,
  startPage: 'heroes',
};

export function loadSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<AppSettings>;
    return {
      theme: saved.theme === 'light' ? 'light' : 'dark',
      density: saved.density === 'compact' ? 'compact' : 'comfortable',
      uiScale: [1, 1.15, 1.3, 1.45].includes(saved.uiScale || 0)
        ? saved.uiScale as UiScale
        : DEFAULT_SETTINGS.uiScale,
      reduceMotion: Boolean(saved.reduceMotion),
      startPage: ['heroes', 'meta', 'matches', 'knowledge'].includes(saved.startPage || '')
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
  if (window.appDisplay) {
    root.style.zoom = '';
    window.appDisplay.setZoomFactor(settings.uiScale);
  } else {
    root.style.zoom = String(settings.uiScale);
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
