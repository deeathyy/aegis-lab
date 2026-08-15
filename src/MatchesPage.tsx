import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Flame,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { dotaApi } from './api';
import type { Hero, ProMatchDetail, ProMatchPlayer, ProMatchSummary, ProTeam } from './types';

const compactNumberFormatter = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const compactNumber = (value: number) => compactNumberFormatter.format(value || 0);

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const fullDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const formatDate = (unix: number, includeYear = false) => (includeYear ? fullDateFormatter : shortDateFormatter).format(new Date(unix * 1000));

function initials(value: string) {
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function TeamLogo({ team, size = 'normal' }: { team: ProTeam; size?: 'small' | 'normal' | 'large' }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`pro-team-logo ${size}`}>
      {team.logo && !failed
        ? <img src={team.logo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <b>{initials(team.tag || team.name)}</b>}
    </span>
  );
}

function PlayerAvatar({ player }: { player: ProMatchPlayer }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="pro-player-avatar">
      {player.avatar && !failed
        ? <img src={player.avatar} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <b>{initials(player.name)}</b>}
    </span>
  );
}

function MatchCard({ match, active, onClick }: { match: ProMatchSummary; active: boolean; onClick: () => void }) {
  return (
    <button className={`pro-match-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="pro-match-card-top">
        <span>{match.leagueName}</span>
        <small><Clock3 size={11} /> {formatDuration(match.duration)}</small>
      </span>
      <span className={`pro-match-card-team ${match.radiantWin ? 'winner' : ''}`}>
        <TeamLogo team={match.radiant} size="small" />
        <strong>{match.radiant.name}</strong>
        <b>{match.radiantScore}</b>
      </span>
      <span className={`pro-match-card-team ${!match.radiantWin ? 'winner' : ''}`}>
        <TeamLogo team={match.dire} size="small" />
        <strong>{match.dire.name}</strong>
        <b>{match.direScore}</b>
      </span>
      <span className="pro-match-card-bottom">
        <small>{formatDate(match.startTime)}</small>
        <span>Матч #{String(match.matchId).slice(-6)} <ChevronRight size={12} /></span>
      </span>
    </button>
  );
}

function DraftTeam({
  team,
  teamIndex,
  detail,
  heroMap,
}: {
  team: ProTeam;
  teamIndex: 0 | 1;
  detail: ProMatchDetail;
  heroMap: Map<number, Hero>;
}) {
  const events = detail.draft.filter((event) => event.team === teamIndex);
  const picks = events.filter((event) => event.isPick);
  const bans = events.filter((event) => !event.isPick);
  return (
    <section className={`draft-team ${teamIndex === 0 ? 'radiant' : 'dire'}`}>
      <header><TeamLogo team={team} size="small" /><strong>{team.name}</strong><span>{teamIndex === 0 ? 'RADIANT' : 'DIRE'}</span></header>
      <div className="draft-label">ПИКИ</div>
      <div className="draft-heroes picks">
        {picks.map((event) => {
          const hero = heroMap.get(event.heroId);
          return <div key={`pick-${event.order}`} title={hero?.name || `Герой ${event.heroId}`}><img src={hero?.image || hero?.icon} alt="" loading="lazy" decoding="async" /><span>{event.order + 1}</span><b>{hero?.name || 'Unknown'}</b></div>;
        })}
      </div>
      <div className="draft-label">БАНЫ</div>
      <div className="draft-heroes bans">
        {bans.map((event) => {
          const hero = heroMap.get(event.heroId);
          return <div key={`ban-${event.order}`} title={hero?.name || `Герой ${event.heroId}`}><img src={hero?.icon || hero?.image} alt="" loading="lazy" decoding="async" /><span>{event.order + 1}</span></div>;
        })}
      </div>
    </section>
  );
}

function PlayerRow({ player, heroMap }: { player: ProMatchPlayer; heroMap: Map<number, Hero> }) {
  const hero = heroMap.get(player.heroId);
  return (
    <div className="pro-player-row">
      <PlayerAvatar player={player} />
      <span className="pro-player-name"><strong>{player.name}</strong><small>{hero?.name || `Герой ${player.heroId}`}</small></span>
      <span className="pro-player-hero"><img src={hero?.image || hero?.icon} alt={hero?.name || ''} loading="lazy" decoding="async" /></span>
      <span className="pro-kda"><b>{player.kills}</b><i>/</i><em>{player.deaths}</em><i>/</i><b>{player.assists}</b><small>K / D / A</small></span>
      <span className="pro-economy"><b>{compactNumber(player.netWorth)}</b><small>{player.gpm} GPM · {player.xpm} XPM</small></span>
      <span className="pro-farm"><b>{player.lastHits} / {player.denies}</b><small>LH / DN</small></span>
      <span className="pro-items">
        {player.items.map((item, index) => <span key={`${item.id}-${index}`} title={item.name}>{item.image ? <img src={item.image} alt="" loading="lazy" decoding="async" /> : <b>?</b>}</span>)}
        {player.neutralItem && <span className="neutral" title={`Нейтральный: ${player.neutralItem.name}`}><img src={player.neutralItem.image} alt="" loading="lazy" decoding="async" /></span>}
      </span>
    </div>
  );
}

function TeamRoster({ team, players, won, heroMap }: { team: ProTeam; players: ProMatchPlayer[]; won: boolean; heroMap: Map<number, Hero> }) {
  return (
    <section className={`pro-roster ${won ? 'won' : ''}`}>
      <header>
        <span><TeamLogo team={team} size="normal" /><span><strong>{team.name}</strong><small>{won ? 'Победитель карты' : 'Состав команды'}</small></span></span>
        {won && <b><Trophy size={13} /> ПОБЕДА</b>}
      </header>
      <div className="pro-roster-labels"><span>Игрок</span><span>Герой</span><span>KDA</span><span>Экономика</span><span>Фарм</span><span>Итоговые предметы</span></div>
      {players.map((player) => <PlayerRow key={`${player.accountId}-${player.heroId}`} player={player} heroMap={heroMap} />)}
    </section>
  );
}

function MatchDetails({ detail, heroes }: { detail: ProMatchDetail; heroes: Hero[] }) {
  const heroMap = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);
  const radiantPlayers = detail.players.filter((player) => player.isRadiant);
  const direPlayers = detail.players.filter((player) => !player.isRadiant);
  const totalKills = detail.radiantScore + detail.direScore;

  return (
    <article className="pro-match-detail">
      <section className="pro-scoreboard">
        <div className={`pro-score-team radiant ${detail.radiantWin ? 'winner' : ''}`}>
          <TeamLogo team={detail.radiant} size="large" />
          <span><small>RADIANT</small><strong>{detail.radiant.name}</strong>{detail.radiantWin && <b><Trophy size={12} /> Победитель</b>}</span>
        </div>
        <div className="pro-score-center">
          <span>{detail.radiantScore}<i>:</i>{detail.direScore}</span>
          <small>ЗАВЕРШЁН · {formatDuration(detail.duration)}</small>
        </div>
        <div className={`pro-score-team dire ${!detail.radiantWin ? 'winner' : ''}`}>
          <span><small>DIRE</small><strong>{detail.dire.name}</strong>{!detail.radiantWin && <b><Trophy size={12} /> Победитель</b>}</span>
          <TeamLogo team={detail.dire} size="large" />
        </div>
      </section>

      <section className="pro-match-facts">
        <span><Trophy size={15} /><span><small>ТУРНИР</small><strong>{detail.leagueName}</strong></span></span>
        <span><CalendarDays size={15} /><span><small>ДАТА</small><strong>{formatDate(detail.startTime, true)}</strong></span></span>
        <span><Flame size={15} /><span><small>УБИЙСТВ</small><strong>{totalKills}</strong></span></span>
        <span><Activity size={15} /><span><small>ПАТЧ</small><strong>{detail.patch || '—'}</strong></span></span>
        <button onClick={() => dotaApi.openExternal(`https://www.opendota.com/matches/${detail.matchId}`)}>OpenDota <ExternalLink size={13} /></button>
      </section>

      <section className="pro-section-heading">
        <span><Swords size={16} /></span>
        <div><small>ДРАФТ КАРТЫ</small><h2>Пики и баны</h2></div>
        <p>Порядок выбора и запретов восстановлен из игрового протокола.</p>
      </section>
      <div className="draft-grid">
        <DraftTeam team={detail.radiant} teamIndex={0} detail={detail} heroMap={heroMap} />
        <DraftTeam team={detail.dire} teamIndex={1} detail={detail} heroMap={heroMap} />
      </div>

      <section className="pro-section-heading roster-heading">
        <span><Users size={16} /></span>
        <div><small>ИТОГОВЫЙ ПРОТОКОЛ</small><h2>Игроки и сборки</h2></div>
        <p>Фотографии профилей, герои, KDA, экономика и предметы на момент окончания карты.</p>
      </section>
      <div className="pro-rosters">
        <TeamRoster team={detail.radiant} players={radiantPlayers} won={detail.radiantWin} heroMap={heroMap} />
        <TeamRoster team={detail.dire} players={direPlayers} won={!detail.radiantWin} heroMap={heroMap} />
      </div>

      <div className="pro-data-note"><ShieldCheck size={15} /><span><b>Источник матча:</b> OpenDota. Фотографии берутся из публичных Steam-профилей игроков; состав и предметы соответствуют выбранной карте.</span></div>
    </article>
  );
}

export default function MatchesPage({ heroes }: { heroes: Hero[] }) {
  const [matches, setMatches] = useState<ProMatchSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProMatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [league, setLeague] = useState('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const detailCache = useRef(new Map<number, ProMatchDetail>());

  const loadMatches = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await dotaApi.getProMatches();
      setMatches(rows);
      setSelectedId((current) => current && rows.some((row) => row.matchId === current) ? current : rows[0]?.matchId || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить профессиональные матчи');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMatches(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    const cached = detailCache.current.get(selectedId);
    if (cached) {
      detailCache.current.delete(selectedId);
      detailCache.current.set(selectedId, cached);
      setDetail(cached);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    dotaApi.getProMatchDetail(selectedId)
      .then((value) => {
        if (cancelled) return;
        detailCache.current.set(selectedId, value);
        while (detailCache.current.size > 8) detailCache.current.delete(detailCache.current.keys().next().value!);
        setDetail(value);
      })
      .catch((caught) => !cancelled && setDetailError(caught instanceof Error ? caught.message : 'Детали матча недоступны'))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => { cancelled = true; };
  }, [selectedId, detailRetry]);

  const leagues = useMemo(() => {
    const counts = new Map<string, number>();
    matches.forEach((match) => counts.set(match.leagueName, (counts.get(match.leagueName) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [matches]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return matches.filter((match) => {
      if (league !== 'all' && match.leagueName !== league) return false;
      return !needle || `${match.leagueName} ${match.radiant.name} ${match.dire.name}`.toLowerCase().includes(needle);
    });
  }, [matches, league, deferredQuery]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    if (!selectedId || !filtered.some((match) => match.matchId === selectedId)) {
      setSelectedId(filtered[0].matchId);
    }
  }, [filtered, selectedId]);

  const teamCount = useMemo(() => new Set(matches.flatMap((match) => [match.radiant.id, match.dire.id]).filter(Boolean)).size, [matches]);

  return (
    <main className="matches-page">
      <section className="matches-hero">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> PRO CIRCUIT · АКТУАЛЬНАЯ ЛЕНТА</span>
          <h1>Профессиональные матчи</h1>
          <p>Турниры высшего уровня, драфты, составы и итоговые сборки игроков — в одном протоколе.</p>
          <div className="matches-hero-stats">
            <span><b>{matches.length || '—'}</b><small>последних карт</small></span>
            <span><b>{teamCount || '—'}</b><small>про-команд</small></span>
            <span><b>{leagues.length || '—'}</b><small>турниров в ленте</small></span>
          </div>
        </div>
        <div className="matches-hero-orbit">
          <span><Trophy size={37} /></span>
          <i /><i /><i />
          <b>PRO</b>
        </div>
      </section>

      <section className="matches-toolbar-panel">
        <div className="tournament-filters">
          <button className={league === 'all' ? 'active' : ''} onClick={() => setLeague('all')}>Все турниры <span>{matches.length}</span></button>
          {leagues.slice(0, 5).map(([name, count]) => <button key={name} className={league === name ? 'active' : ''} onClick={() => setLeague(name)}>{name.replace('The International', 'TI')} <span>{count}</span></button>)}
        </div>
        <label className="match-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Команда или турнир" /></label>
        <button className="matches-refresh" onClick={loadMatches} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={15} /> Обновить</button>
      </section>

      {error ? (
        <section className="matches-error"><CircleAlert size={34} /><h2>Лента матчей временно недоступна</h2><p>{error}</p><button onClick={loadMatches}><RefreshCw size={15} /> Повторить</button></section>
      ) : (
        <div className="matches-layout">
          <aside className="matches-feed">
            <header><span><Trophy size={14} /> НЕДАВНИЕ КАРТЫ</span><small>{filtered.length} результатов</small></header>
            <div>
              {loading && !matches.length ? Array.from({ length: 6 }, (_, index) => <span className="match-card-skeleton" key={index} />) : filtered.map((match) => (
                <MatchCard key={match.matchId} match={match} active={match.matchId === selectedId} onClick={() => setSelectedId(match.matchId)} />
              ))}
              {!loading && !filtered.length && <span className="matches-empty">По этому фильтру матчей нет.</span>}
            </div>
          </aside>

          <section className="matches-detail-shell">
            {detailLoading && <div className="matches-detail-loading"><LoaderCircle className="spin" size={28} /><strong>Разбираем протокол матча</strong><span>Загружаем драфт, игроков и предметы…</span></div>}
            {detailError && <div className="matches-detail-loading error"><CircleAlert size={28} /><strong>Протокол недоступен</strong><span>{detailError}</span><button onClick={() => setDetailRetry((value) => value + 1)}><RefreshCw size={13} /> Повторить</button></div>}
            {detail && !detailLoading && <MatchDetails detail={detail} heroes={heroes} />}
          </section>
        </div>
      )}
    </main>
  );
}
