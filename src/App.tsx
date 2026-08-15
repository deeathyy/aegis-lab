import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  CircleAlert,
  Clock3,
  Crown,
  ExternalLink,
  Flame,
  Gamepad2,
  Gem,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { dotaApi } from './api';
import type { BuildPhase, Hero, Matchup } from './types';
import { BuildPanel, MatchupsPanel, OverviewPanel } from './HeroDetailPanels';
import UpdateControl from './UpdateControl';
import aegisLogo from '../build/icon.svg';
import { applySettings, loadSettings } from './settings';
import type { AppPage } from './settings';

const MetaPage = lazy(() => import('./MetaPage'));
const KnowledgeBasePage = lazy(() => import('./KnowledgeBasePage'));
const SettingsModal = lazy(() => import('./SettingsModal'));
const MatchesPage = lazy(() => import('./MatchesPage'));

const ATTR_LABELS: Record<string, string> = {
  str: 'Сила',
  agi: 'Ловкость',
  int: 'Интеллект',
  all: 'Универсал',
};

const ATTR_ICONS: Record<string, string> = {
  str: '♦',
  agi: '▲',
  int: '●',
  all: '◆',
};

const compactNumberFormatter = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const standardNumberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const formatNumber = (value: number) => (value > 9999 ? compactNumberFormatter : standardNumberFormatter).format(value);

function rememberLimited<T>(cache: Map<number, T>, key: number, value: T, limit = 12) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone = 'cyan',
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone?: 'cyan' | 'green' | 'orange' | 'blue';
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function HeroSearch({ heroes, selected, onSelect }: { heroes: Hero[]; selected: Hero; onSelect: (hero: Hero) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return heroes.slice(0, 12);
    return heroes.filter((hero) => hero.name.toLowerCase().includes(normalized)).slice(0, 12);
  }, [deferredQuery, heroes]);

  return (
    <div className={`hero-search ${open ? 'open' : ''}`}>
      <Search size={18} />
      <input
        aria-label="Поиск героя"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && matches[0]) {
            onSelect(matches[0]);
            setQuery('');
            setOpen(false);
          }
        }}
        placeholder={`Сейчас: ${selected.name}`}
      />
      <kbd>⌘ K</kbd>
      {open && (
        <div className="search-results">
          <div className="search-caption">{query ? `Найдено: ${matches.length}` : 'Популярные герои'}</div>
          {matches.map((hero) => (
            <button
              key={hero.id}
              className={hero.id === selected.id ? 'active' : ''}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(hero);
                setQuery('');
                setOpen(false);
              }}
            >
              <img src={hero.icon || hero.image} alt="" loading="lazy" decoding="async" />
              <span>
                <strong>{hero.name}</strong>
                <small>{hero.roles.slice(0, 2).join(' · ')}</small>
              </span>
              <b>{hero.winRate.toFixed(1)}%</b>
            </button>
          ))}
          {!matches.length && <div className="empty-search">Герой не найден</div>}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <main className="loading-screen">
      <div className="brand-mark"><img src={aegisLogo} alt="" /></div>
      <LoaderCircle className="spin" size={34} />
      <strong>Загружаем мету Dota 2</strong>
      <span>Получаем героев и статистику из OpenDota</span>
    </main>
  );
}

function SectionLoader() {
  return <main className="loading-screen section-loader"><LoaderCircle className="spin" size={26} /><strong>Открываем раздел…</strong></main>;
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phases, setPhases] = useState<BuildPhase[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [buildLoading, setBuildLoading] = useState(false);
  const [matchupsLoading, setMatchupsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'builds' | 'matchups'>('overview');
  const [page, setPage] = useState<AppPage>(settings.startPage);
  const buildCache = useRef(new Map<number, BuildPhase[]>());
  const matchupCache = useRef(new Map<number, Matchup[]>());

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  useEffect(() => {
    const syncVisibility = () => {
      document.documentElement.toggleAttribute('data-page-hidden', document.hidden);
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  const loadHeroes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await dotaApi.getHeroes();
      setHeroes(data);
      const defaultHero = data.find((hero) => hero.key === 'antimage') || data[0];
      setSelectedId((current) => current ?? defaultHero?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeroes();
  }, []);

  const selected = useMemo(() => heroes.find((hero) => hero.id === selectedId) || heroes[0], [heroes, selectedId]);
  const topHeroes = useMemo(() => [...heroes].sort((a, b) => b.winRate - a.winRate).slice(0, 5), [heroes]);

  useEffect(() => {
    if (!selected?.id) return;
    let cancelled = false;
    const cached = buildCache.current.get(selected.id);
    if (cached) {
      setPhases(cached);
      setBuildLoading(false);
      return;
    }
    setPhases([]);
    setBuildLoading(true);
    dotaApi
      .getBuild(selected.id)
      .then((data) => {
        if (cancelled) return;
        rememberLimited(buildCache.current, selected.id, data);
        setPhases(data);
      })
      .catch(() => !cancelled && setPhases([]))
      .finally(() => !cancelled && setBuildLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected?.id, sourceRevision]);

  useEffect(() => {
    if (!selected?.id || activeTab !== 'matchups') return;
    let cancelled = false;
    const cached = matchupCache.current.get(selected.id);
    if (cached) {
      setMatchups(cached);
      setMatchupsLoading(false);
      return;
    }
    setMatchups([]);
    setMatchupsLoading(true);
    dotaApi
      .getMatchups(selected.id)
      .then((data) => {
        if (cancelled) return;
        rememberLimited(matchupCache.current, selected.id, data);
        setMatchups(data);
      })
      .catch(() => !cancelled && setMatchups([]))
      .finally(() => !cancelled && setMatchupsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeTab, selected?.id, sourceRevision]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.hero-search input')?.focus();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  if (loading) return <Skeleton />;
  if (error || !selected) {
    return (
      <main className="error-screen">
        <CircleAlert size={42} />
        <h1>Статистика временно недоступна</h1>
        <p>{error || 'OpenDota не вернул список героев.'}</p>
        <button onClick={loadHeroes}><RefreshCw size={16} /> Повторить</button>
      </main>
    );
  }

  const proWinRate = selected.proPicks ? (selected.proWins / selected.proPicks) * 100 : 0;
  const buildSource = phases[0]?.source || 'OpenDota';
  const matchupSource = matchups[0]?.source || 'OpenDota';
  const activeSource = activeTab === 'matchups' ? matchupSource : buildSource;
  const activeSourceClass = activeSource.includes('STRATZ') ? 'stratz' : 'opendota';
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark"><img src={aegisLogo} alt="" /></div>
          <span><strong>AEGIS</strong> LAB</span>
          <em>V6</em>
        </div>
        <nav>
          <button className={page === 'heroes' ? 'active' : ''} onClick={() => setPage('heroes')}><Gamepad2 size={17} /> Герои</button>
          <button className={page === 'meta' ? 'active' : ''} onClick={() => setPage('meta')}><BarChart3 size={17} /> Мета</button>
          <button className={page === 'matches' ? 'active' : ''} onClick={() => setPage('matches')}><Trophy size={17} /> Матчи</button>
          <button className={page === 'knowledge' ? 'active' : ''} onClick={() => setPage('knowledge')}><BookOpen size={17} /> База знаний</button>
        </nav>
        <UpdateControl />
      </header>

      <div className="toolbar">
        <div className="breadcrumbs">
          <span>{page === 'meta' ? 'Аналитика' : page === 'matches' ? 'Киберспорт' : page === 'knowledge' ? 'Обучение' : 'Герои'}</span><b>/</b><strong>{page === 'meta' ? 'Мета' : page === 'matches' ? 'Профессиональные матчи' : page === 'knowledge' ? 'База знаний' : selected.name}</strong>
        </div>
        {page === 'matches'
          ? <div className="toolbar-pro-status"><span><i /> PRO DATA</span><b>OpenDota</b><small>матчи обновляются автоматически</small></div>
          : <HeroSearch heroes={heroes} selected={selected} onSelect={(hero) => { setSelectedId(hero.id); setPage('heroes'); }} />}
        <button className="menu-button" aria-label="Настройки" title="Настройки" onClick={() => setSettingsOpen(true)}><SettingsIcon size={19} /></button>
      </div>

      <Suspense fallback={<SectionLoader />}>
      {page === 'heroes' ? <main className="content">
        <section className="hero-overview">
          <div className="hero-portrait">
            <img src={selected.image} alt={selected.name} decoding="async" fetchPriority="high" />
            <div className="portrait-shade" />
            <span className={`attribute attr-${selected.primaryAttr}`}>{ATTR_ICONS[selected.primaryAttr]}</span>
            <div className="portrait-caption">
              <small>{ATTR_LABELS[selected.primaryAttr]} · {selected.attackType === 'Melee' ? 'Ближний бой' : 'Дальний бой'}</small>
              <h1>{selected.name}</h1>
            </div>
          </div>

          <div className="hero-summary">
            <div className="summary-topline">
              <div>
                <span className="eyebrow">ОБЗОР ГЕРОЯ</span>
                <h2>{selected.name}</h2>
              </div>
              <div className="source-badge"><ShieldCheck size={14} /> Характеристики · 1 уровень</div>
            </div>
            <div className="role-list">
              {selected.roles.slice(0, 4).map((role) => <span key={role}>{role}</span>)}
            </div>
            <p className="summary-copy">
              Актуальные показатели публичных и профессиональных матчей. Сборка ниже рассчитана по самым часто покупаемым предметам игроков на этом герое.
            </p>
            <div className="base-stats">
              <span><Activity size={15} /> <b>{selected.baseHealth}</b><small>здоровье</small></span>
              <span><Gem size={15} /> <b>{selected.baseMana}</b><small>мана</small></span>
              <span><ShieldCheck size={15} /> <b>{selected.baseArmor.toFixed(1)}</b><small>броня</small></span>
              <span><TrendingUp size={15} /> <b>{selected.moveSpeed}</b><small>скорость</small></span>
            </div>
            <div className="hero-attributes">
              <span className="strength"><i>◆</i><small>СИЛА</small><b>{selected.baseStrength}</b><em>+{selected.strengthGain.toFixed(1)}</em></span>
              <span className="agility"><i>▲</i><small>ЛОВКОСТЬ</small><b>{selected.baseAgility}</b><em>+{selected.agilityGain.toFixed(1)}</em></span>
              <span className="intelligence"><i>●</i><small>ИНТЕЛЛЕКТ</small><b>{selected.baseIntelligence}</b><em>+{selected.intelligenceGain.toFixed(1)}</em></span>
              <p>Начальное значение <b>на 1 уровне</b> · справа указан прирост за уровень</p>
            </div>
          </div>
        </section>

        <section className="metrics-grid">
          <MetricCard
            label="ВИНРЕЙТ"
            value={`${selected.winRate.toFixed(1)}%`}
            note={`#${selected.winRateRank} среди ${heroes.length} героев`}
            icon={<TrendingUp size={18} />}
            tone="green"
          />
          <MetricCard
            label="ДОЛЯ ВЫБОРОВ"
            value={`${selected.pickRate.toFixed(2)}%`}
            note={`${formatNumber(selected.publicPicks)} выборов в выборке`}
            icon={<Users size={18} />}
            tone="cyan"
          />
          <MetricCard
            label="ПРО-СЦЕНА"
            value={`${proWinRate.toFixed(1)}%`}
            note={`${selected.proPicks} пиков · ${selected.proBans} банов`}
            icon={<Crown size={18} />}
            tone="orange"
          />
          <MetricCard
            label="ПОЗИЦИЯ В МЕТЕ"
            value={selected.winRateRank <= 20 ? 'S / A' : selected.winRateRank <= 70 ? 'B' : 'C'}
            note="На основе общего винрейта"
            icon={<Flame size={18} />}
            tone="blue"
          />
        </section>

        <div className="dashboard-grid">
          <section className="main-panel">
            <div className="tabs">
              <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Обзор</button>
              <button className={activeTab === 'builds' ? 'active' : ''} onClick={() => setActiveTab('builds')}>Сборка предметов</button>
              <button className={activeTab === 'matchups' ? 'active' : ''} onClick={() => setActiveTab('matchups')}>Матчапы <span>live</span></button>
            </div>

            <div className="panel-heading">
              <div>
                <span className="eyebrow"><Sparkles size={13} /> {activeTab === 'matchups' ? 'АНАЛИТИКА СОПЕРНИКОВ' : 'РЕКОМЕНДОВАНО МЕТОЙ'}</span>
                <h3>{activeTab === 'overview' ? 'План и ситуационные решения' : activeTab === 'builds' ? 'Предметы по стадиям' : 'Лучшие и худшие матчапы'}</h3>
              </div>
              <div className="updated"><span className={`active-data-source ${activeSourceClass}`}>{activeSource}</span><RefreshCw size={13} /> обновляется автоматически</div>
            </div>

            {activeTab === 'overview' && <OverviewPanel hero={selected} phases={phases} loading={buildLoading} />}
            {activeTab === 'builds' && <BuildPanel phases={phases} loading={buildLoading} />}
            {activeTab === 'matchups' && (
              <MatchupsPanel
                hero={selected}
                heroes={heroes}
                matchups={matchups}
                loading={matchupsLoading}
                onSelect={(hero) => setSelectedId(hero.id)}
              />
            )}

            <div className="data-note">
              <ShieldCheck size={15} />
              <span>
                {activeTab === 'overview' && <><b>Как использовать обзор:</b> типовое ядро рассчитано по данным {buildSource}; ситуационные предметы выбираются после оценки вражеского драфта.</>}
                {activeTab === 'builds' && <><b>Источник сборки — {buildSource}:</b> предметы отсортированы по частоте покупки внутри каждой стадии. STRATZ используется при подключённом токене, OpenDota — как резерв.</>}
                {activeTab === 'matchups' && <><b>Источник матчапов — {matchupSource}:</b> малые выборки исключаются автоматически. STRATZ предоставляет расширенную агрегацию, OpenDota остаётся резервом.</>}
              </span>
            </div>
          </section>

          <aside className="side-column">
            <section className="side-panel meta-panel">
              <div className="side-heading">
                <span><Flame size={16} /> Лидеры винрейта</span>
                <small>Общая выборка</small>
              </div>
              <div className="leader-list">
                {topHeroes.map((hero, index) => (
                  <button key={hero.id} onClick={() => setSelectedId(hero.id)} className={hero.id === selected.id ? 'selected' : ''}>
                    <span className="leader-rank">{index + 1}</span>
                    <img src={hero.icon || hero.image} alt="" loading="lazy" decoding="async" />
                    <span className="leader-name"><b>{hero.name}</b><small>{ATTR_LABELS[hero.primaryAttr]}</small></span>
                    <strong>{hero.winRate.toFixed(1)}%</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="side-panel sources-panel">
              <div className="side-heading">
                <span><Activity size={16} /> Источники</span>
                <span className="live-pill"><i /> LIVE</span>
              </div>
              <button onClick={() => dotaApi.openExternal('https://www.opendota.com/')}>
                <span className="source-logo od">OD</span>
                <span><b>OpenDota</b><small>Статистика и предметы</small></span>
                <ExternalLink size={14} />
              </button>
              <button onClick={() => dotaApi.openExternal(`https://dota2protracker.com/hero/${encodeURIComponent(selected.name)}`)}>
                <span className="source-logo d2">D2</span>
                <span><b>Dota 2 Pro Tracker</b><small>7000+ MMR · страница героя</small></span>
                <ExternalLink size={14} />
              </button>
              <button onClick={() => dotaApi.openExternal(`https://stratz.com/heroes/${selected.id}-${selected.key.replaceAll('_', '-')}`)}>
                <span className="source-logo st">SZ</span>
                <span><b>STRATZ</b><small>GraphQL · предметы и матчапы</small></span>
                <ExternalLink size={14} />
              </button>
              <button onClick={() => dotaApi.openExternal(`https://www.dotabuff.com/heroes/${selected.key.replaceAll('_', '-')}`)}>
                <span className="source-logo db">DB</span>
                <span><b>Dotabuff</b><small>Публичная мета · страница героя</small></span>
                <ExternalLink size={14} />
              </button>
              <button onClick={() => dotaApi.openExternal('https://liquipedia.net/dota2game/Main_Page')}>
                <span className="source-logo wiki">W</span>
                <span><b>Dota 2 Wiki</b><small>Механики и справочник</small></span>
                <ExternalLink size={14} />
              </button>
            </section>
          </aside>
        </div>
      </main> : page === 'meta' ? (
        <MetaPage
          heroes={heroes}
          onSelect={(hero) => {
            setSelectedId(hero.id);
            setPage('heroes');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : page === 'matches' ? (
        <MatchesPage heroes={heroes} />
      ) : (
        <KnowledgeBasePage />
      )}
      </Suspense>

      {settingsOpen && <Suspense fallback={null}><SettingsModal settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} onSourcesChanged={() => {
        buildCache.current.clear();
        matchupCache.current.clear();
        setSourceRevision((value) => value + 1);
      }} /></Suspense>}

      <footer>
        <span>Aegis Lab не связан с Valve Corporation. Dota 2 — товарный знак Valve.</span>
        <span>Данные: OpenDota + STRATZ (при подключении) · Изображения: Valve / Dota 2 CDN · Steam Profiles</span>
      </footer>
    </div>
  );
}
