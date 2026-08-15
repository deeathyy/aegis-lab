import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Crosshair,
  ExternalLink,
  Flag,
  Gauge,
  Layers3,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { dotaApi } from './api';
import type { BuildItem, BuildPhase, Hero, Matchup } from './types';

function uniqueItems(items: BuildItem[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function isFinishedItem(item: BuildItem) {
  return item.isUpgrade || /blink dagger|aghanim's shard|aghanim's blessing|moon shard/i.test(item.name);
}

function situationFor(item: BuildItem) {
  const name = item.name.toLowerCase();
  if (/black king|pipe|glimmer|eternal shroud|mage slayer|cloak/.test(name)) return 'Против магии и контроля';
  if (/lotus|manta|eul|disperser|guardian greaves/.test(name)) return 'Снятие негативных эффектов';
  if (/assault|shiva|crimson|blade mail|butterfly|halberd/.test(name)) return 'Против физического урона';
  if (/abyssal|basher|orchid|bloodthorn|scythe|atos/.test(name)) return 'Контроль мобильной цели';
  if (/blink|force staff|hurricane pike|shadow blade|silver edge/.test(name)) return 'Позиционирование и инициация';
  if (/satanic|heart|bloodstone|octarine|vanguard/.test(name)) return 'Для затяжных драк';
  if (/desolator|daedalus|rapier|mkb|nullifier/.test(name)) return 'Когда нужен дополнительный урон';
  if (/linken|aeon|ghost|butterfly/.test(name)) return 'Защитный слот';
  return 'Альтернативный слот по ситуации';
}

function gamePlan(hero: Hero) {
  const carry = hero.roles.includes('Carry');
  const support = hero.roles.includes('Support');
  const initiator = hero.roles.includes('Initiator');
  const pusher = hero.roles.includes('Pusher');
  return [
    {
      title: 'Линия',
      timing: '0–10 минут',
      icon: <Flag size={17} />,
      text: support
        ? 'Обеспечьте ресурсы кор-герою, контролируйте руны и подготовьте первый командный выход.'
        : 'Стабилизируйте добивания, не отдавайте лишнее здоровье и выходите в ключевой первый предмет.',
    },
    {
      title: 'Темп',
      timing: '10–25 минут',
      icon: <Zap size={17} />,
      text: initiator
        ? 'Ищите начало драки после ключевого предмета и играйте вокруг обзора своей команды.'
        : carry
          ? 'Чередуйте безопасный фарм и драки только за важные объекты или сильные тайминги.'
          : 'Соединяйтесь с активными героями и превращайте выигранные драки в контроль карты.',
    },
    {
      title: 'Победа',
      timing: '25+ минут',
      icon: <Target size={17} />,
      text: pusher
        ? 'Используйте преимущество для давления на строения и не затягивайте после выигранной драки.'
        : 'Сохраняйте байбек, выбирайте приоритетную цель и не начинайте бой без ключевых ресурсов.',
    },
  ];
}

function ItemTile({ item, rank }: { item: BuildItem; rank?: number }) {
  return (
    <div className="item">
      <div className="item-image-wrap">
        <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
        {rank !== undefined && rank < 3 && <span className="item-rank">{rank + 1}</span>}
      </div>
      <div className="item-tooltip">
        <strong>{item.name}</strong>
        <span>{item.cost ? `${item.cost} золота` : 'Бесплатно'}</span>
        <small>Относительная популярность: {item.popularity}%</small>
      </div>
    </div>
  );
}

export function BuildPanel({ phases, loading }: { phases: BuildPhase[]; loading: boolean }) {
  if (loading) {
    return <PanelLoading text="Собираем популярные предметы…" />;
  }

  return (
    <div className="build-timeline">
      {phases.map((phase, index) => (
        <div className="build-phase" key={phase.key}>
          <div className="phase-meta">
            <span className="phase-index">{index + 1}</span>
            <span>
              <strong>{phase.title}</strong>
              <small><Clock3 size={13} /> {phase.timing}</small>
            </span>
          </div>
          <div className="item-row">
            {phase.items.slice(0, 6).map((item, itemIndex) => (
              <ItemTile item={item} rank={itemIndex} key={`${phase.key}-${item.id}`} />
            ))}
            {!phase.items.length && <span className="phase-empty">Недостаточно данных</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OverviewPanel({ hero, phases, loading }: { hero: Hero; phases: BuildPhase[]; loading: boolean }) {
  if (loading) return <PanelLoading text="Формируем план игры…" />;

  const early = phases.find((phase) => phase.key === 'early_game_items')?.items || [];
  const middle = phases.find((phase) => phase.key === 'mid_game_items')?.items || [];
  const late = phases.find((phase) => phase.key === 'late_game_items')?.items || [];
  const core = uniqueItems([...middle, ...early])
    .filter(isFinishedItem)
    .slice(0, 5);
  const coreIds = new Set(core.map((item) => item.id));
  const situational = uniqueItems([...middle, ...late])
    .filter((item) => isFinishedItem(item) && !coreIds.has(item.id))
    .slice(0, 8);
  const plan = gamePlan(hero);
  const metaVerdict = hero.winRate >= 52
    ? 'Герой уверенно чувствует себя в текущей выборке.'
    : hero.winRate >= 49
      ? 'Сбалансированный выбор: решают исполнение и правильные предметы.'
      : 'Требовательный выбор: особенно важны хороший матчап и тайминги.';

  return (
    <div className="overview-panel-v3">
      <section className="overview-gameplan">
        <div className="overview-section-title">
          <span><Crosshair size={17} /> План на игру</span>
          <small>сценарий по основным ролям героя</small>
        </div>
        <div className="gameplan-grid">
          {plan.map((step, index) => (
            <article key={step.title}>
              <span className="plan-number">0{index + 1}</span>
              <span className="plan-icon">{step.icon}</span>
              <div><small>{step.timing}</small><strong>{step.title}</strong><p>{step.text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <div className="overview-columns">
        <section className="core-build-card">
          <div className="overview-section-title">
            <span><Layers3 size={17} /> Типовое ядро</span>
            <small>самая частая основа</small>
          </div>
          <div className="core-path">
            {core.map((item, index) => (
              <div className="core-step" key={item.id}>
                <ItemTile item={item} rank={index} />
                {index < core.length - 1 && <ArrowUpRight size={14} />}
              </div>
            ))}
          </div>
          <div className="meta-verdict">
            <Gauge size={18} />
            <span><small>ВЕРДИКТ МЕТЫ</small><strong>{metaVerdict}</strong></span>
          </div>
        </section>

        <section className="situational-card">
          <div className="overview-section-title">
            <span><ShieldAlert size={17} /> Ситуативные предметы</span>
            <small>адаптируйте после драфта</small>
          </div>
          <div className="situational-list">
            {situational.map((item) => (
              <article key={item.id}>
                <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
                <span><strong>{item.name}</strong><small>{situationFor(item)}</small></span>
                <span className="situational-rate"><b>{item.popularity}%</b><i style={{ width: `${item.popularity}%` }} /></span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

type MatchupView = Matchup & { opponent: Hero; winRate: number };

function MatchupColumn({
  title,
  description,
  rows,
  good,
  onSelect,
}: {
  title: string;
  description: string;
  rows: MatchupView[];
  good: boolean;
  onSelect: (hero: Hero) => void;
}) {
  return (
    <section className={`matchup-column ${good ? 'favorable' : 'dangerous'}`}>
      <div className="matchup-column-title">
        <span>{good ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</span>
        <div><strong>{title}</strong><small>{description}</small></div>
      </div>
      <div className="matchup-list">
        {rows.map((row, index) => (
          <button key={row.heroId} onClick={() => onSelect(row.opponent)}>
            <span className="matchup-rank">{index + 1}</span>
            <img src={row.opponent.icon || row.opponent.image} alt="" loading="lazy" decoding="async" />
            <span className="matchup-name"><strong>{row.opponent.name}</strong><small>{row.opponent.roles.slice(0, 2).join(' · ')}</small></span>
            <span className="matchup-sample"><small>{row.gamesPlayed.toLocaleString('ru-RU')}</small><em>матчей</em></span>
            <span className="matchup-win"><b>{row.winRate.toFixed(1)}%</b><i /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function MatchupsPanel({
  hero,
  heroes,
  matchups,
  loading,
  onSelect,
}: {
  hero: Hero;
  heroes: Hero[];
  matchups: Matchup[];
  loading: boolean;
  onSelect: (hero: Hero) => void;
}) {
  if (loading) return <PanelLoading text="Считаем матчапы…" />;

  const heroMap = new Map(heroes.map((entry) => [entry.id, entry]));
  const maxGames = Math.max(...matchups.map((entry) => entry.gamesPlayed), 0);
  const threshold = Math.max(100, Math.floor(maxGames * 0.12));
  const rows = matchups
    .filter((entry) => entry.gamesPlayed >= threshold && heroMap.has(entry.heroId))
    .map((entry) => ({
      ...entry,
      opponent: heroMap.get(entry.heroId)!,
      winRate: entry.gamesPlayed ? (entry.wins / entry.gamesPlayed) * 100 : 0,
    }));
  const favorable = [...rows].sort((a, b) => b.winRate - a.winRate).slice(0, 6);
  const dangerous = [...rows].sort((a, b) => a.winRate - b.winRate).slice(0, 6);
  const dotabuffHero = hero.key.replaceAll('_', '-');

  return (
    <div className="matchups-panel-v3">
      <div className="matchup-summary">
        <div><ShieldCheck size={18} /><span><small>НАДЁЖНАЯ ВЫБОРКА</small><strong>Минимум {threshold.toLocaleString('ru-RU')} совместных матчей</strong></span></div>
        <p>Показатель — винрейт <b>{hero.name}</b> против конкретного героя. Малые выборки автоматически исключены.</p>
      </div>
      <div className="matchup-grid">
        <MatchupColumn title="Хорошо играет против" description="лучшие соперники для выбора" rows={favorable} good onSelect={onSelect} />
        <MatchupColumn title="Стоит опасаться" description="герои, снижающие шанс победы" rows={dangerous} good={false} onSelect={onSelect} />
      </div>
      <section className="provider-strip">
        <div className="provider-copy"><Sparkles size={18} /><span><strong>Проверить матчап глубже</strong><small>Профессиональная и публичная выборки в исходных сервисах</small></span></div>
        <button onClick={() => dotaApi.openExternal(`https://stratz.com/heroes/${hero.id}-${dotabuffHero}`)}>
          <span className="source-logo st">SZ</span><span><b>STRATZ</b><small>GraphQL-аналитика и IMP</small></span><ExternalLink size={15} />
        </button>
        <button onClick={() => dotaApi.openExternal(`https://www.dotabuff.com/heroes/${dotabuffHero}/counters`)}>
          <span className="source-logo db">DB</span><span><b>Dotabuff</b><small>Контрпики по рангам</small></span><ExternalLink size={15} />
        </button>
      </section>
    </div>
  );
}

function PanelLoading({ text }: { text: string }) {
  return (
    <div className="panel-loading">
      <LoaderCircle className="spin" size={28} />
      <span>{text}</span>
    </div>
  );
}
