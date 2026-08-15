import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { UpdateState } from './types';

const fallbackState: UpdateState = {
  status: 'disabled',
  currentVersion: '0.6.1',
  availableVersion: null,
  percent: null,
  message: 'Проверка обновлений доступна в установленной версии',
};

function statusLabel(state: UpdateState) {
  switch (state.status) {
    case 'checking': return 'Проверяем обновления';
    case 'available': return `Доступна ${state.availableVersion}`;
    case 'downloading': return `Загрузка ${state.percent ?? 0}%`;
    case 'downloaded': return 'Готово к установке';
    case 'error': return 'Ошибка обновления';
    case 'disabled': return `Версия ${state.currentVersion}`;
    default: return `Версия ${state.currentVersion} актуальна`;
  }
}

function StatusIcon({ status }: { status: UpdateState['status'] }) {
  if (status === 'checking' || status === 'downloading') return <LoaderCircle className="spin" size={15} />;
  if (status === 'downloaded') return <Download size={15} />;
  if (status === 'error') return <TriangleAlert size={15} />;
  return <ShieldCheck size={15} />;
}

export default function UpdateControl() {
  const [state, setState] = useState<UpdateState>(fallbackState);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updater = window.appUpdater;
    if (!updater) return;
    updater.getState().then(setState).catch(() => undefined);
    return updater.onState(setState);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const isBusy = state.status === 'checking' || state.status === 'available' || state.status === 'downloading';
  const canCheck = Boolean(window.appUpdater) && !isBusy && state.status !== 'disabled' && state.status !== 'downloaded';

  return (
    <div className={`update-control status-${state.status}`} ref={rootRef}>
      <button className="update-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="status-dot" />
        <span>{statusLabel(state)}</span>
        <ChevronDown className={open ? 'chevron-open' : ''} size={14} />
      </button>

      {open && (
        <section className="update-popover">
          <div className="update-popover-title">
            <span className="update-state-icon"><StatusIcon status={state.status} /></span>
            <div>
              <strong>{statusLabel(state)}</strong>
              <small>{state.message}</small>
            </div>
          </div>

          {(state.status === 'available' || state.status === 'downloading' || state.status === 'downloaded') && (
            <div className="update-progress" aria-label={`Загружено ${state.percent ?? 0}%`}>
              <span style={{ width: `${state.percent ?? 0}%` }} />
            </div>
          )}

          <div className="update-meta">
            <span>Текущая версия</span>
            <b>v{state.currentVersion}</b>
          </div>

          {state.status === 'downloaded' ? (
            <button className="update-action primary" onClick={() => window.appUpdater?.install()}>
              <RotateCcw size={15} /> Перезапустить и обновить
            </button>
          ) : (
            <button className="update-action" disabled={!canCheck} onClick={() => window.appUpdater?.check()}>
              {state.status === 'up-to-date' ? <CheckCircle2 size={15} /> : <RefreshCw size={15} />}
              {isBusy ? 'Проверяем…' : 'Проверить сейчас'}
            </button>
          )}

          <p>Проверка выполняется автоматически через GitHub Releases. Загруженное обновление также установится при выходе.</p>
        </section>
      )}
    </div>
  );
}
