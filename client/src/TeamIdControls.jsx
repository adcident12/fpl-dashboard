import { useLang } from './i18n.jsx';
import { Spinner } from './LoadingSpinner.jsx';

// A well-known, long-lived public FPL team (id 1) — used only so people without
// a team ID yet (new to FPL this season) can see the Squad/Suggestions tabs work.
export const SAMPLE_TEAM_ID = '1';

export function TeamIdInput({ value, onChangeValue, onLoad, loading }) {
  const { t } = useLang();
  function submit(id) {
    const tid = String(id).trim();
    if (!tid) return;
    onLoad(tid);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 bg-panel border border-line rounded-md px-3.5 py-3 mb-3.5 shadow-sm max-sm:flex-col max-sm:items-stretch">
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('teamId.label')}
        <input
          type="text"
          inputMode="numeric"
          placeholder={t('teamId.placeholder')}
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(value)}
          className="w-[180px] bg-panel-2 border border-line text-text rounded-sm px-2.5 py-1.5 font-[inherit] transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(79,140,255,0.25)] max-sm:w-full"
        />
      </label>
      <button
        type="button"
        onClick={() => submit(value)}
        disabled={loading || !value.trim()}
        className="self-end flex items-center justify-center gap-2 bg-accent text-white rounded-full px-4 py-2 font-semibold cursor-pointer transition shadow-sm enabled:hover:brightness-110 enabled:hover:shadow-md enabled:active:scale-[0.98] disabled:opacity-60 disabled:cursor-default disabled:shadow-none max-sm:self-stretch max-sm:text-center"
      >
        {loading && <Spinner size="sm" className="border-white/30 border-t-white" />}
        {loading ? t('teamId.loading') : t('teamId.load')}
      </button>
      <button
        type="button"
        onClick={() => submit(SAMPLE_TEAM_ID)}
        disabled={loading}
        title={t('teamId.trySampleTitle')}
        className="self-end bg-transparent text-accent border border-accent rounded-full px-3.5 py-2 font-semibold cursor-pointer transition enabled:hover:bg-accent/10 enabled:active:scale-[0.98] disabled:opacity-60 disabled:cursor-default max-sm:self-stretch max-sm:text-center"
      >
        {t('teamId.trySample')}
      </button>
    </div>
  );
}

export function TeamIdEmptyState({ onTrySample }) {
  const { t } = useLang();
  return (
    <div className="text-left max-w-[480px] mx-auto my-6 bg-panel border border-line rounded-lg py-5 px-6 text-muted shadow-sm">
      <p className="mb-2.5">{t('teamId.empty.intro')}</p>
      <ol className="mb-3.5 pl-5">
        <li className="mb-1.5">
          {t('teamId.empty.step1Link')}{' '}
          <a href="https://fantasy.premierleague.com/" target="_blank" rel="noreferrer" className="text-accent">
            fantasy.premierleague.com
          </a>{' '}
          {t('teamId.empty.step1')}
        </li>
        <li className="mb-1.5">{t('teamId.empty.step2')}</li>
        <li className="mb-1.5">
          {t('teamId.empty.step3')}
          <br />
          <code className="bg-panel-2 rounded px-1.5 py-0.5 text-xs">
            fantasy.premierleague.com/entry/&lt;TEAM_ID&gt;/event/…
          </code>
        </li>
      </ol>
      <p>
        {t('teamId.empty.noTeam')}{' '}
        <button
          type="button"
          onClick={onTrySample}
          className="bg-transparent text-accent border border-accent rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer align-middle transition hover:bg-accent/10 active:scale-[0.98]"
        >
          {t('teamId.trySample')}
        </button>
      </p>
    </div>
  );
}
