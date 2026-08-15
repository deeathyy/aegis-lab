import { useEffect } from 'react';
import {
  BookOpen,
  Check,
  ExternalLink,
  Gamepad2,
  Heart,
  LayoutDashboard,
  Moon,
  RefreshCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { dotaApi } from './api';
import { DEFAULT_SETTINGS } from './settings';
import type { AppPage, AppSettings, DensityMode, ThemeMode } from './settings';

const START_PAGES: Array<{ value: AppPage; label: string; icon: typeof Gamepad2 }> = [
  { value: 'heroes', label: 'Герои', icon: Gamepad2 },
  { value: 'meta', label: 'Мета', icon: LayoutDashboard },
  { value: 'knowledge', label: 'Знания', icon: BookOpen },
];

export default function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <span className="settings-header-icon"><Settings2 size={19} /></span>
          <div><span>AEGIS LAB</span><h2 id="settings-title">Настройки приложения</h2></div>
          <button onClick={onClose} aria-label="Закрыть настройки"><X size={18} /></button>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <div className="settings-section-title">
              <span><Sparkles size={15} /> Оформление</span>
              <small>Применяется сразу</small>
            </div>
            <div className="theme-options">
              {([
                { value: 'dark' as ThemeMode, label: 'Тёмная', note: 'Фирменная палитра', icon: Moon },
                { value: 'light' as ThemeMode, label: 'Светлая', note: 'Больше контраста днём', icon: Sun },
              ]).map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.value} className={settings.theme === option.value ? 'active' : ''} onClick={() => update('theme', option.value)}>
                    <span><Icon size={19} /></span>
                    <span><strong>{option.label}</strong><small>{option.note}</small></span>
                    {settings.theme === option.value && <Check size={15} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title"><span><SlidersHorizontal size={15} /> Интерфейс</span></div>

            <div className="setting-row">
              <div><strong>Плотность блоков</strong><small>Компактный режим показывает больше данных на экране.</small></div>
              <div className="segmented-control">
                {(['comfortable', 'compact'] as DensityMode[]).map((value) => (
                  <button key={value} className={settings.density === value ? 'active' : ''} onClick={() => update('density', value)}>
                    {value === 'comfortable' ? 'Обычно' : 'Компактно'}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row">
              <div><strong>Уменьшить анимации</strong><small>Отключает вращения, пульсацию и плавные переходы.</small></div>
              <button
                className={`settings-switch ${settings.reduceMotion ? 'active' : ''}`}
                role="switch"
                aria-checked={settings.reduceMotion}
                onClick={() => update('reduceMotion', !settings.reduceMotion)}
              ><span /></button>
            </div>

            <div className="setting-row start-page-row">
              <div><strong>Стартовая страница</strong><small>Раздел, который откроется при следующем запуске.</small></div>
              <div className="start-page-options">
                {START_PAGES.map((option) => {
                  const Icon = option.icon;
                  return <button key={option.value} className={settings.startPage === option.value ? 'active' : ''} onClick={() => update('startPage', option.value)}><Icon size={14} /> {option.label}</button>;
                })}
              </div>
            </div>
          </section>

          <section className="donate-card">
            <span className="donate-icon"><Heart size={20} /></span>
            <div><strong>Поддержать Aegis Lab</strong><small>Помоги развитию приложения и новых источников статистики.</small></div>
            <button onClick={() => dotaApi.openExternal('https://boosty.to/aegislab')}>Boosty <ExternalLink size={14} /></button>
          </section>
        </div>

        <footer className="settings-footer">
          <button className="settings-reset" onClick={() => onChange(DEFAULT_SETTINGS)}><RefreshCcw size={14} /> Сбросить</button>
          <button className="settings-done" onClick={onClose}>Готово</button>
        </footer>
      </section>
    </div>
  );
}
