import { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Database,
  ExternalLink,
  Gamepad2,
  Heart,
  LayoutDashboard,
  KeyRound,
  Moon,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trophy,
  X,
  ZoomIn,
} from 'lucide-react';
import { dotaApi, stratzApi } from './api';
import { DEFAULT_SETTINGS } from './settings';
import type { AppPage, AppSettings, DensityMode, ThemeMode, UiScale } from './settings';
import type { StratzConnectionState } from './types';

const UI_SCALES: Array<{ value: UiScale; label: string }> = [
  { value: 1, label: '100%' },
  { value: 1.15, label: '115%' },
  { value: 1.3, label: '130%' },
  { value: 1.45, label: '145%' },
];

const START_PAGES: Array<{ value: AppPage; label: string; icon: typeof Gamepad2 }> = [
  { value: 'heroes', label: 'Герои', icon: Gamepad2 },
  { value: 'meta', label: 'Мета', icon: LayoutDashboard },
  { value: 'matches', label: 'Матчи', icon: Trophy },
  { value: 'knowledge', label: 'Знания', icon: BookOpen },
];

export default function SettingsModal({
  settings,
  onChange,
  onClose,
  onSourcesChanged,
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
  onSourcesChanged: () => void;
}) {
  const [stratzState, setStratzState] = useState<StratzConnectionState>({ configured: false, status: 'disconnected', message: 'Проверяем подключение…' });
  const [stratzToken, setStratzToken] = useState('');
  const [sourceBusy, setSourceBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    stratzApi.getState().then(setStratzState);
  }, []);

  const connectStratz = async () => {
    setSourceBusy(true);
    const state = await stratzApi.connect(stratzToken);
    setStratzState(state);
    setSourceBusy(false);
    if (state.configured) {
      setStratzToken('');
      onSourcesChanged();
    }
  };

  const disconnectStratz = async () => {
    setSourceBusy(true);
    setStratzState(await stratzApi.disconnect());
    setSourceBusy(false);
    onSourcesChanged();
  };

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

            <div className="setting-row scale-setting-row">
              <div><strong><ZoomIn size={14} /> Масштаб интерфейса</strong><small>Увеличивает весь текст, карточки, кнопки и отступы.</small></div>
              <div className="scale-options" aria-label="Масштаб интерфейса">
                {UI_SCALES.map((option) => (
                  <button
                    key={option.value}
                    className={settings.uiScale === option.value ? 'active' : ''}
                    onClick={() => update('uiScale', option.value)}
                    aria-pressed={settings.uiScale === option.value}
                  >
                    {option.label}
                    {option.value === 1.3 && <small>Рекомендуется</small>}
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

          <section className="settings-section source-settings-section">
            <div className="settings-section-title">
              <span><Database size={15} /> Источники данных</span>
              <small>Приоритет аналитики</small>
            </div>
            <div className="stratz-source-card">
              <span className="stratz-source-logo">SZ</span>
              <div>
                <span><strong>STRATZ GraphQL</strong><i className={stratzState.status}>{stratzState.configured ? 'ПОДКЛЮЧЁН' : 'НЕ ПОДКЛЮЧЁН'}</i></span>
                <small>Расширенные матчапы и покупки предметов с таймингами.</small>
              </div>
              <button className="stratz-docs-button" onClick={() => dotaApi.openExternal('https://stratz.com/api')} title="Получить токен STRATZ"><ExternalLink size={14} /></button>
            </div>
            {stratzState.configured ? (
              <div className="stratz-connected-actions">
                <span><Check size={14} /><span><strong>Приоритетный источник активен</strong><small>При ошибке приложение автоматически вернётся к OpenDota.</small></span></span>
                <button onClick={disconnectStratz} disabled={sourceBusy}>Отключить</button>
              </div>
            ) : (
              <div className="stratz-token-row">
                <label><KeyRound size={14} /><input type="password" value={stratzToken} onChange={(event) => setStratzToken(event.target.value)} placeholder="Личный API-токен STRATZ" autoComplete="off" /></label>
                <button onClick={connectStratz} disabled={sourceBusy || !stratzToken.trim()}>{sourceBusy ? 'Проверяем…' : 'Подключить'}</button>
              </div>
            )}
            <div className={`stratz-source-message ${stratzState.status}`}><ShieldCheck size={13} /><span>{stratzState.message}. Токен хранится локально и шифруется средствами Windows.</span></div>
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
