import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Crosshair,
  Flame,
  Gauge,
  Info,
  Layers3,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { Hero } from './types';

const ATTR_LABELS: Record<string, string> = {
  str: 'Сила',
  agi: 'Ловкость',
  int: 'Интеллект',
  all: 'Универсал',
};

const ROLE_LABELS: Record<string, string> = {
  All: 'Все роли',
  Carry: 'Керри',
  Support: 'Поддержка',
  Nuker: 'Нюкер',
  Disabler: 'Контроль',
  Durable: 'Танк',
  Escape: 'Мобильный',
  Pusher: 'Пушер',
  Initiator: 'Инициатор',
};

type SortKey = 'rating' | 'winRate' | 'pickRate' | 'matches';

const compactFormatter = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const compact = (value: number) => compactFormatter.format(value);

function getTier(hero: Hero) {
  if (hero.winRateRank <= 12) return 'S';
  if (hero.winRateRank <= 35) return 'A';
  if (hero.winRateRank <= 78) return 'B';
  return 'C';
}

function getAegisIndex(hero: Hero, maxPickRate: number) {
  const winSignal = (hero.winRate - 50) * 7;
  const presenceSignal = maxPickRate ? (hero.pickRate / maxPickRate) * 20 : 0;
  return Math.max(1, Math.min(99, Math.round(50 + winSignal + presenceSignal)));
}

function SpotlightCard({
  hero,
  label,
  value,
  note,
  icon,
  onSelect,
}: {
  hero: Hero;
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  onSelect: (hero: Hero) => void;
}) {
  return (
    <button className="spotlight-card" onClick={() => onSelect(hero)}>
      <img src={hero.image} alt="" decoding="async" />
      <span className="spotlight-overlay" />
      <span className="spotlight-icon">{icon}</span>
      <span className="spotlight-content">
        <small>{label}</small>
        <strong>{hero.name}</strong>
        <span><b>{value}</b> {note}</span>
      </span>
      <ArrowUpRight className="spotlight-arrow" size={16} />
    </button>
  );
}

export default function MetaPage({ heroes, onSelect }: { heroes: Hero[]; onSelect: (hero: Hero) => void }) {
  const [role, setRole] = useState('All');
  const [sort, setSort] = useState<SortKey>('rating');
  const [visibleCount, setVisibleCount] = useState(15);

  const meta = useMemo(() => {
    const byWinRate = [...heroes].sort((a, b) => b.winRate - a.winRate);
    const byPopularity = [...heroes].sort((a, b) => b.pickRate - a.pickRate);
    const maxPickRate = byPopularity[0]?.pickRate || 1;
    const pickRates = heroes.map((hero) => hero.pickRate).sort((a, b) => a - b);
    const medianPickRate = pickRates[Math.floor(pickRates.length / 2)] || 0;
    const sleeper = byWinRate.find((hero) => hero.pickRate <= medianPickRate) || byWinRate[0];
    const strong = heroes.filter((hero) => hero.winRate >= 52);
    const balanced = heroes.filter((hero) => hero.winRate >= 48 && hero.winRate < 52);
    const weak = heroes.filter((hero) => hero.winRate < 48);
    const averageWinRate = heroes.reduce((sum, hero) => sum + hero.winRate, 0) / heroes.length;
    return {
      byWinRate,
      byPopularity,
      maxPickRate,
      sleeper,
      strong,
      balanced,
      weak,
      averageWinRate,
    };
  }, [heroes]);

  const filtered = useMemo(() => {
    const list = role === 'All' ? [...heroes] : heroes.filter((hero) => hero.roles.includes(role));
    return list.sort((a, b) => {
      if (sort === 'winRate') return b.winRate - a.winRate;
      if (sort === 'pickRate') return b.pickRate - a.pickRate;
      if (sort === 'matches') return b.publicPicks - a.publicPicks;
      return getAegisIndex(b, meta.maxPickRate) - getAegisIndex(a, meta.maxPickRate);
    });
  }, [heroes, meta.maxPickRate, role, sort]);

  const balancePercent = Math.round((meta.balanced.length / heroes.length) * 100);

  return (
    <main className="content meta-page">
      <section className="meta-hero">
        <div className="meta-hero-copy">
          <span className="eyebrow"><Activity size={13} /> LIVE-СРЕЗ ПУБЛИЧНЫХ МАТЧЕЙ</span>
          <h1>Карта текущей меты</h1>
          <p>Сравнивайте силу, популярность и стабильность всех героев в одной выборке.</p>
          <div className="meta-pulse"><i /> Анализируется {heroes.length} героев</div>
        </div>
        <div className="radar-orbit" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="radar-core"><Crosshair size={32} /></span>
          {meta.byWinRate.slice(0, 4).map((hero, index) => (
            <img key={hero.id} className={`orbit-hero orbit-hero-${index + 1}`} src={hero.icon || hero.image} alt="" decoding="async" />
          ))}
        </div>
        <div className="meta-hero-stat">
          <small>СРЕДНИЙ ВИНРЕЙТ</small>
          <strong>{meta.averageWinRate.toFixed(2)}%</strong>
          <span><ShieldCheck size={13} /> выборка синхронизирована</span>
        </div>
      </section>

      <section className="meta-spotlights">
        <SpotlightCard
          hero={meta.byWinRate[0]}
          label="ЛИДЕР ВИНРЕЙТА"
          value={`${meta.byWinRate[0].winRate.toFixed(1)}%`}
          note="побед"
          icon={<Flame size={17} />}
          onSelect={onSelect}
        />
        <SpotlightCard
          hero={meta.byPopularity[0]}
          label="НАРОДНЫЙ ВЫБОР"
          value={`${meta.byPopularity[0].pickRate.toFixed(2)}%`}
          note="доля пиков"
          icon={<Users size={17} />}
          onSelect={onSelect}
        />
        <SpotlightCard
          hero={meta.sleeper}
          label="ТИХИЙ ЛИДЕР"
          value={`${meta.sleeper.winRate.toFixed(1)}%`}
          note="при редких пиках"
          icon={<Zap size={17} />}
          onSelect={onSelect}
        />
      </section>

      <div className="meta-layout">
        <section className="meta-table-panel">
          <div className="meta-section-header">
            <div>
              <span className="eyebrow"><BarChart3 size={13} /> РЕЙТИНГ ГЕРОЕВ</span>
              <h2>Срез меты</h2>
            </div>
            <div className="meta-controls">
              <label>
                <SlidersHorizontal size={14} />
                <select value={role} onChange={(event) => { setRole(event.target.value); setVisibleCount(15); }}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <Layers3 size={14} />
                <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                  <option value="rating">Индекс Aegis</option>
                  <option value="winRate">По винрейту</option>
                  <option value="pickRate">По популярности</option>
                  <option value="matches">По матчам</option>
                </select>
              </label>
            </div>
          </div>

          <div className="meta-table-head">
            <span>#</span><span>Герой</span><span>Тип</span><span>Винрейт</span><span>Выборы</span><span>Индекс</span><span />
          </div>
          <div className="meta-table-body">
            {filtered.slice(0, visibleCount).map((hero, index) => {
              const indexValue = getAegisIndex(hero, meta.maxPickRate);
              return (
                <button className="meta-row" key={hero.id} onClick={() => onSelect(hero)}>
                  <span className="meta-rank">{index + 1}</span>
                  <span className="meta-name">
                    <img src={hero.icon || hero.image} alt="" loading="lazy" decoding="async" />
                    <span><strong>{hero.name}</strong><small>{hero.roles.slice(0, 2).join(' · ')}</small></span>
                  </span>
                  <span className={`meta-attr attr-${hero.primaryAttr}`}>{ATTR_LABELS[hero.primaryAttr]}</span>
                  <span className={`meta-win ${hero.winRate >= 50 ? 'positive' : 'negative'}`}>
                    <strong>{hero.winRate.toFixed(1)}%</strong>
                    <i style={{ '--win': `${Math.min(100, hero.winRate * 1.8)}%` } as React.CSSProperties} />
                  </span>
                  <span className="meta-picks"><strong>{hero.pickRate.toFixed(2)}%</strong><small>{compact(hero.publicPicks)} матчей</small></span>
                  <span className="aegis-index"><i style={{ '--score': `${indexValue}%` } as React.CSSProperties} /><b>{indexValue}</b></span>
                  <span className={`tier tier-${getTier(hero).toLowerCase()}`}>{getTier(hero)}</span>
                </button>
              );
            })}
          </div>
          {visibleCount < filtered.length && (
            <button className="show-more" onClick={() => setVisibleCount((value) => value + 15)}>
              Показать ещё <ArrowUpRight size={14} />
            </button>
          )}
        </section>

        <aside className="meta-insights">
          <section className="insight-panel radar-panel">
            <div className="insight-title">
              <span><Gauge size={16} /> Радар меты</span>
              <span className="live-pill"><i /> LIVE</span>
            </div>
            <div className="balance-score">
              <div className="score-ring" style={{ '--balance': `${balancePercent * 3.6}deg` } as React.CSSProperties}>
                <span><b>{balancePercent}%</b><small>баланс</small></span>
              </div>
              <p><strong>{meta.balanced.length} героев</strong> находятся в коридоре винрейта 48–52%.</p>
            </div>
            <div className="distribution-bar">
              <span className="strong" style={{ width: `${(meta.strong.length / heroes.length) * 100}%` }} />
              <span className="balanced" style={{ width: `${(meta.balanced.length / heroes.length) * 100}%` }} />
              <span className="weak" style={{ width: `${(meta.weak.length / heroes.length) * 100}%` }} />
            </div>
            <div className="distribution-legend">
              <span><i className="strong" /> Сильные <b>{meta.strong.length}</b></span>
              <span><i className="balanced" /> Баланс <b>{meta.balanced.length}</b></span>
              <span><i className="weak" /> Рисковые <b>{meta.weak.length}</b></span>
            </div>
          </section>

          <section className="insight-panel compass-panel">
            <div className="insight-title"><span><Target size={16} /> Мета-компас</span></div>
            <button onClick={() => onSelect(meta.sleeper)}>
              <span className="compass-icon"><Sparkles size={16} /></span>
              <span><small>НЕДООЦЕНЁН</small><strong>{meta.sleeper.name}</strong><em>{meta.sleeper.winRate.toFixed(1)}% побед</em></span>
              <ArrowUpRight size={14} />
            </button>
            <button onClick={() => onSelect(meta.byPopularity[0])}>
              <span className="compass-icon"><TrendingUp size={16} /></span>
              <span><small>САМЫЙ МАССОВЫЙ</small><strong>{meta.byPopularity[0].name}</strong><em>{compact(meta.byPopularity[0].publicPicks)} выборов</em></span>
              <ArrowUpRight size={14} />
            </button>
            <div className="index-note"><Info size={14} /><span><b>Индекс Aegis</b> объединяет винрейт и присутствие героя в текущей выборке.</span></div>
          </section>
        </aside>
      </div>
    </main>
  );
}
