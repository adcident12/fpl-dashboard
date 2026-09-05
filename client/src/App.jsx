import { useEffect, useMemo, useState } from 'react';
import { fetchPlayers } from './api.js';
import FixtureGrid from './FixtureGrid.jsx';
import SquadView from './SquadView.jsx';
import SuggestionsView from './SuggestionsView.jsx';
import ChipsView from './ChipsView.jsx';
import FdrBadges from './FdrBadges.jsx';
import Logo from './Logo.jsx';
import LoadingState from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

// Relative "how long ago" for the data-freshness indicator. Recomputed on
// every tick (see the `now` state below) so it stays live without refetching.
function formatTimeAgo(fetchedAt, now, t) {
  if (fetchedAt == null) return null;
  const mins = Math.floor((now - fetchedAt) / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { n: mins });
  return t('time.hoursAgo', { n: Math.floor(mins / 60) });
}

// Countdown to the next transfer/lineup deadline. Same `now` tick as the
// freshness indicator drives this too — minute-level precision is plenty,
// no separate per-second interval needed.
function formatDeadlineCountdown(deadlineEpochMs, now, t) {
  if (deadlineEpochMs == null) return null;
  const diff = deadlineEpochMs - now;
  if (diff <= 0) return t('deadline.passed');
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return t('deadline.inDaysHours', { days, hours });
  if (hours > 0) return t('deadline.inHoursMins', { hours, mins });
  return t('deadline.inMins', { mins });
}

export default function App() {
  const { lang, setLang, t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [sortKey, setSortKey] = useState('valueSeason');
  const [sortDir, setSortDir] = useState('desc');

  const [nameFilter, setNameFilter] = useState('');
  const [posFilter, setPosFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [maxPrice, setMaxPrice] = useState(15);
  const [minOwnership, setMinOwnership] = useState(0);
  const [diffOnly, setDiffOnly] = useState(false);
  const [tab, setTab] = useState('players');

  const COLUMNS = [
    { key: 'name', label: t('table.player'), sortable: true },
    { key: 'teamShort', label: t('table.team'), sortable: true },
    { key: 'position', label: t('table.pos'), sortable: true },
    { key: 'price', label: t('table.price'), sortable: true },
    { key: 'form', label: t('table.form'), sortable: true },
    { key: 'totalPoints', label: t('table.pts'), sortable: true },
    { key: 'valueSeason', label: t('table.ptsPerM'), sortable: true },
    { key: 'ownership', label: t('table.ownPct'), sortable: true },
    { key: 'next3', label: t('table.next3fdr'), sortable: false },
  ];

  useEffect(() => {
    let alive = true;
    fetchPlayers()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Keeps "Updated Xm ago" live without refetching data.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const players = data?.players ?? [];
  const teams = data?.teams ?? [];
  const meta = data?.meta;

  const filtered = useMemo(() => {
    let rows = players;
    if (nameFilter.trim()) {
      const q = nameFilter.trim().toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (posFilter !== 'all') rows = rows.filter((p) => p.positionId === Number(posFilter));
    if (teamFilter !== 'all') rows = rows.filter((p) => p.teamId === Number(teamFilter));
    rows = rows.filter((p) => p.price <= maxPrice);
    rows = rows.filter((p) => p.ownership >= minOwnership);
    if (diffOnly) rows = rows.filter((p) => p.differential > 0);

    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === 'next3') {
        av = a.next3AvgFDR ?? 99;
        bv = b.next3AvgFDR ?? 99;
      }
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * dir;
      }
      return (av - bv) * dir;
    });
    return rows;
  }, [players, nameFilter, posFilter, teamFilter, maxPrice, minOwnership, diffOnly, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'teamShort' ? 'asc' : 'desc');
    }
  }

  if (loading) return <LoadingState label={t('status.loading')} />;
  if (error) return <div className="py-10 text-center text-[#ff8a80]">{t('status.error', { message: error })}</div>;

  return (
    <div className="max-w-[1200px] mx-auto p-4 max-[900px]:p-3">
      <header className="flex items-center flex-wrap gap-5 mb-3 max-sm:gap-2.5">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-[0.03em] uppercase m-0">
          <Logo className="w-6 h-6" />
          {t('app.title')}
        </h1>
        <nav className="inline-flex gap-1 bg-panel border border-line rounded-lg p-[3px]">
          <button
            className={`font-display text-[13px] font-bold tracking-[0.02em] uppercase px-3.5 py-1.5 rounded-sm cursor-pointer transition-colors ${tab === 'players' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
            onClick={() => setTab('players')}
          >
            {t('nav.players')}
          </button>
          <button
            className={`font-display text-[13px] font-bold tracking-[0.02em] uppercase px-3.5 py-1.5 rounded-sm cursor-pointer transition-colors ${tab === 'fixtures' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
            onClick={() => setTab('fixtures')}
          >
            {t('nav.fixtures')}
          </button>
          <button
            className={`font-display text-[13px] font-bold tracking-[0.02em] uppercase px-3.5 py-1.5 rounded-sm cursor-pointer transition-colors ${tab === 'squad' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
            onClick={() => setTab('squad')}
          >
            {t('nav.squad')}
          </button>
          <button
            className={`font-display text-[13px] font-bold tracking-[0.02em] uppercase px-3.5 py-1.5 rounded-sm cursor-pointer transition-colors ${tab === 'suggestions' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
            onClick={() => setTab('suggestions')}
          >
            {t('nav.suggestions')}
          </button>
          <button
            className={`font-display text-[13px] font-bold tracking-[0.02em] uppercase px-3.5 py-1.5 rounded-sm cursor-pointer transition-colors ${tab === 'chips' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
            onClick={() => setTab('chips')}
          >
            {t('nav.chips')}
          </button>
        </nav>
        <div className="flex items-center gap-3 ml-auto max-sm:w-full max-sm:justify-between">
          {meta?.nextDeadline && (
            <span
              className={`font-display text-xs font-bold tracking-[0.02em] uppercase px-3 py-1.5 rounded-full border cursor-help ${
                meta.nextDeadline.deadlineEpochMs - now < 3 * 3600000
                  ? 'text-hard border-hard/40 bg-hard/10'
                  : meta.nextDeadline.deadlineEpochMs - now < 86400000
                    ? 'text-med border-med/40 bg-med/10'
                    : 'text-muted border-line bg-panel-2'
              }`}
              title={`${meta.nextDeadline.eventName}: ${new Date(meta.nextDeadline.deadlineEpochMs).toLocaleString()}`}
            >
              {t('deadline.label', { time: formatDeadlineCountdown(meta.nextDeadline.deadlineEpochMs, now, t) })}
            </span>
          )}
          {meta && (
            <span className="text-muted text-[13px]">
              {t('meta.eventPlayers', { event: meta.currentEventName, count: players.length })}
              {meta.dataFetchedAt != null && (
                <span
                  className={`cursor-help ml-2.5 before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:mr-1.5 before:align-middle ${now - meta.dataFetchedAt < (meta.dataTtlMs ?? 0) ? 'before:bg-accent-2' : 'before:bg-med'}`}
                  title={new Date(meta.dataFetchedAt).toLocaleString()}
                >
                  {t('meta.updated', { time: formatTimeAgo(meta.dataFetchedAt, now, t) })}
                </span>
              )}
            </span>
          )}
          <button
            onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
            className="bg-panel border border-line text-text font-display font-bold text-xs tracking-[0.04em] px-3.5 py-1.5 rounded-full cursor-pointer transition-colors hover:border-accent hover:text-accent"
          >
            {t('lang.toggle')}
          </button>
        </div>
      </header>

      {tab === 'fixtures' ? (
        <FixtureGrid />
      ) : tab === 'squad' ? (
        <SquadView />
      ) : tab === 'suggestions' ? (
        <SuggestionsView />
      ) : tab === 'chips' ? (
        <ChipsView />
      ) : (
        <>
      <div className="filters flex flex-wrap items-center gap-4 bg-panel border border-line rounded-md px-3.5 py-3 mb-3.5 max-sm:flex-col max-sm:items-stretch">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('filters.search')}
          <input
            type="text"
            placeholder={t('filters.searchPlaceholder')}
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="bg-panel-2 border border-line text-text rounded-sm px-2.5 py-1.5 font-[inherit] transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(79,140,255,0.25)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('filters.position')}
          <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
            <option value="all">{t('filters.positionAll')}</option>
            <option value="1">GK</option>
            <option value="2">DEF</option>
            <option value="3">MID</option>
            <option value="4">FWD</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('filters.team')}
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">{t('filters.teamAll')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('filters.maxPrice', { price: maxPrice.toFixed(1) })}
          <input
            type="range"
            min="4"
            max="15"
            step="0.5"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="accent-accent max-sm:w-full"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('filters.minOwn', { pct: minOwnership })}
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={minOwnership}
            onChange={(e) => setMinOwnership(Number(e.target.value))}
            className="accent-accent max-sm:w-full"
          />
        </label>

        <label className="toggle flex flex-row items-center gap-1.5 text-text text-xs">
          <input
            type="checkbox"
            checked={diffOnly}
            onChange={(e) => setDiffOnly(e.target.checked)}
          />
          {t('filters.differential')}
        </label>

        <span className="ml-auto text-muted text-xs max-sm:text-right">{t('filters.shown', { count: filtered.length })}</span>
      </div>

      <div className="overflow-auto border border-line rounded-md max-h-[72vh]">
        <table className="players">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={c.sortable ? 'sortable' : ''}
                  onClick={() => c.sortable && toggleSort(c.key)}
                >
                  {c.label}
                  {sortKey === c.key && <span className="arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="name">
                  {p.name}
                  {p.news && <span className="news" title={p.news}> ⚑</span>}
                </td>
                <td data-label={t('table.team')}>{p.teamShort}</td>
                <td data-label={t('table.pos')}>
                  <span className={`pos pos-${p.positionId}`}>{p.position}</span>
                </td>
                <td className="num" data-label={t('table.price')}>{p.price.toFixed(2)}</td>
                <td className="num" data-label={t('table.form')}>{p.form.toFixed(1)}</td>
                <td className="num" data-label={t('table.pts')}>{p.totalPoints}</td>
                <td className="num" data-label={t('table.ptsPerM')}>{p.valueSeason.toFixed(1)}</td>
                <td className="num" data-label={t('table.ownPct')}>{p.ownership.toFixed(1)}</td>
                <td data-label={t('table.next3fdr')}>
                  <FdrBadges fixtures={p.nextFixtures} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="legend">
        <span className="fdr-badge fdr-easy">{t('legend.easy')}</span>
        <span className="fdr-badge fdr-med">{t('legend.med')}</span>
        <span className="fdr-badge fdr-hard">{t('legend.hard')}</span>
        <span className="muted">{t('legend.playersNote')}</span>
      </footer>
        </>
      )}
    </div>
  );
}
