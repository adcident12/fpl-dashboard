import { useEffect, useState } from 'react';
import { fetchSquad } from './api.js';
import { useTeamId } from './useTeamId.js';
import { TeamIdInput } from './TeamIdControls.jsx';
import PitchView from './PitchView.jsx';
import LoadingState from './LoadingSpinner.jsx';
import Tooltip from './Tooltip.jsx';
import { useLang } from './i18n.jsx';

// The rival slot gets its own localStorage key so it doesn't clobber the
// shared 'fpl-team-id' every other tab reads/writes — "your team" (the
// default key) still prefills from whatever's already saved there.
const RIVAL_STORAGE_KEY = 'fpl-rival-team-id';

// Bragging-rights text — a curated phrase bank, not a live AI/API call.
// A per-view LLM call was considered and deliberately skipped: it would need
// a server-side key (this app has never held one — see CLAUDE.md, "reads
// only the public FPL API"), adds real latency/cost/failure modes to what's
// otherwise an instant, free page, and a hand-picked bank gives more
// consistent comedic quality than a live generation call would per-request
// anyway. Several lines per outcome category instead of just one, picked
// deterministically (see pickBanter below) so the same matchup+score always
// shows the same line — re-renders don't make it flicker between phrases —
// while different matchups/scores do get variety.
const BANTER_PHRASES = {
  en: {
    tie: [
      'Dead even on {{p}} points — bragging rights are still up for grabs.',
      "{{p}}-{{p}}. A perfect stalemate. Somewhere, a neutral fan nods in approval.",
      "Tied at {{p}}. Nobody wins, nobody loses, everybody's mildly unsatisfied.",
      "{{p}} apiece. The football gods couldn't decide either.",
      'Exactly level on {{p}}. Flip a coin, argue about it in the group chat.',
      "{{p}}-{{p}}. A draw so clean it's almost suspicious.",
    ],
    close: [
      '{{w}} just edges it by {{m}} pt(s) — nail-biter.',
      '{{w}} scrapes past by {{m}}. Barely a win, still a win.',
      "{{w}} wins by the width of a bench player's cameo — {{m}} pts.",
      "{{m}} points. That's the margin. {{w}} will take it and say nothing more.",
      "A {{m}}-point squeaker for {{w}} — somebody's bench points are haunting them.",
      '{{w}} sneaks it by {{m}}. Every point mattered this week.',
    ],
    win: [
      '{{w}} takes the week by {{m}} pts.',
      '{{w}} comes out on top, {{m}} points clear — a solid, unarguable win.',
      '{{w}} wins comfortably, {{m}} points to spare.',
      'No drama here — {{w}} by {{m}}, fair and square.',
      '{{w}} put in the work this week. {{m}} points says so.',
      '{{w}} banks the bragging rights, {{m}} points in hand.',
    ],
    blowout: [
      '{{w}} is running away with it this week, {{m}} pts clear. Brutal.',
      "{{w}} didn't just win — {{w}} sent a message. {{m}} points of it.",
      "{{m}} points. That's not a win, that's a statement.",
      '{{w}} obliterated the competition by {{m}}. Screenshot this.',
      'Somebody tell the rival captain to hand in the armband — {{m}} points down.',
      "{{w}} by {{m}}. At this point it's not rivalry, it's a public service announcement.",
    ],
  },
  th: {
    tie: [
      'เสมอกันที่ {{p}} แต้ม — สิทธิ์คุยโวยังไม่มีใครได้ไป',
      '{{p}}-{{p}} เสมอกันเป๊ะ แฟนบอลที่เป็นกลางคงพยักหน้าพอใจ',
      'เสมอที่ {{p}} แต้ม ไม่มีใครแพ้ ไม่มีใครชนะ แต่ทุกคนรู้สึกค้างคาใจนิดๆ',
      '{{p}} แต้มเท่ากันเป๊ะ เทพเจ้าฟุตบอลก็ตัดสินใจไม่ได้เหมือนกัน',
      'เสมอกันที่ {{p}} แต้ม โยนเหรียญตัดสิน แล้วไปเถียงกันในกลุ่มแชทต่อ',
      '{{p}}-{{p}} เสมอกันจนน่าสงสัยว่าจงใจหรือเปล่า',
    ],
    close: [
      '{{w}} เฉือนชนะแค่ {{m}} แต้ม — สูสีสุดๆ',
      '{{w}} ชนะแบบหวุดหวิดแค่ {{m}} แต้ม ชนะก็คือชนะ',
      '{{w}} ชนะด้วยระยะห่างแค่ตัวสำรองโผล่มาเตะไม่กี่นาที — {{m}} แต้ม',
      '{{m}} แต้ม คือส่วนต่างทั้งหมด {{w}} รับไปเงียบๆ',
      'ชนะฉิวเฉียด {{m}} แต้มของ {{w}} — คะแนนตัวสำรองอาจหลอกหลอนใครบางคนอยู่',
      '{{w}} แซงหน้าไปแค่ {{m}} แต้ม ทุกแต้มมีความหมายจริงๆ สัปดาห์นี้',
    ],
    win: [
      '{{w}} ชนะสัปดาห์นี้ด้วยส่วนต่าง {{m}} แต้ม',
      '{{w}} ขึ้นนำอย่างสบายๆ ทิ้งห่าง {{m}} แต้ม — ชนะแบบไม่มีข้อกังขา',
      '{{w}} ชนะแบบสบายๆ เหลือแต้มกันตั้ง {{m}} แต้ม',
      'ไม่มีดราม่า {{w}} ชนะ {{m}} แต้ม ยุติธรรมชัดเจน',
      '{{w}} ทำการบ้านมาดีสัปดาห์นี้ {{m}} แต้มเป็นเครื่องพิสูจน์',
      '{{w}} เก็บสิทธิ์คุยโวไปครอง นำอยู่ {{m}} แต้ม',
    ],
    blowout: [
      '{{w}} ทิ้งห่างสัปดาห์นี้ถึง {{m}} แต้ม โหดจริง',
      '{{w}} ไม่ได้แค่ชนะ — {{w}} ส่งสารเตือน ด้วย {{m}} แต้ม',
      '{{m}} แต้ม นี่ไม่ใช่แค่ชนะ นี่คือการประกาศศักดา',
      '{{w}} ถล่มคู่แข่งไป {{m}} แต้ม แคปหน้าจอเก็บไว้ได้เลย',
      'บอกกัปตันทีมคู่แข่งให้ถอดปลอกแขนได้แล้ว — ตามหลังอยู่ {{m}} แต้ม',
      '{{w}} นำ {{m}} แต้ม ถึงจุดนี้ไม่ใช่ศึกคู่แข่งแล้ว นี่คือประกาศสาธารณะ',
    ],
  },
};

function banterCategory(margin) {
  if (margin === 0) return 'tie';
  if (margin >= 20) return 'blowout';
  if (margin >= 8) return 'win';
  return 'close';
}

function interpolate(str, vars) {
  let out = str;
  for (const [key, value] of Object.entries(vars)) out = out.replaceAll(`{{${key}}}`, String(value));
  return out;
}

// Deterministic pick (not Math.random()) so re-rendering the same matchup
// with the same score never swaps the phrase out from under the user —
// only an actually different matchup/score changes which line shows.
function hashSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.codePointAt(i)) >>> 0;
  return hash;
}

function pickBanter(category, lang, seed, vars) {
  const pool = BANTER_PHRASES[lang]?.[category] ?? BANTER_PHRASES.en[category];
  const template = pool[hashSeed(seed) % pool.length];
  return interpolate(template, vars);
}

function computeWinnerLabel(dataA, dataB, t) {
  if (dataA.teamPoints === dataB.teamPoints) return null;
  return dataA.teamPoints > dataB.teamPoints ? t('rivalry.yourTeam') : t('rivalry.rivalTeam');
}

// Copy-to-clipboard with a brief "Copied!" swap (the same pattern Wordle's
// share button popularized) plus a category-driven entrance animation
// (styles.css: .banter-tie/close/win/blowout) so a blowout actually feels
// like one instead of using the same quiet fade as a tie.
function BanterCard({ category, text, t }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can be unavailable (insecure context, denied
      // permission) — this is a nice-to-have convenience action, not worth
      // surfacing an error for; the button just silently does nothing.
    }
  }

  return (
    <div className={`banter-card banter-${category} bg-panel border border-accent/40 rounded-md p-4 mb-3.5 shadow-sm text-center relative`}>
      <div className="font-display text-lg font-bold pr-8">{text}</div>
      <Tooltip content={copied ? t('rivalry.copied') : t('rivalry.copy')}>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t('rivalry.copy')}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-panel-2 border border-line text-muted cursor-pointer transition hover:text-accent hover:border-accent active:scale-95"
        >
          {copied ? '✓' : '⧉'}
        </button>
      </Tooltip>
    </div>
  );
}

function Side({ label, teamId, setTeamId, data, error, loading, onLoad, t }) {
  return (
    <div className="flex-1 min-w-[280px]">
      <h3 className="font-display text-sm font-bold tracking-[0.02em] uppercase text-muted mb-1.5">{label}</h3>
      <TeamIdInput value={teamId} onChangeValue={setTeamId} onLoad={onLoad} loading={loading} />
      {error && <div className="text-[#ff8a80] text-sm mb-3">{error}</div>}
      {loading && !data && <LoadingState label={t('status.loading')} />}
      {data && (
        <>
          <div className="bg-panel border border-line rounded-md px-3.5 py-3 mb-3.5 shadow-sm text-[13px] text-muted">
            <b className="text-text text-xl font-display">{data.teamPoints ?? '—'}</b> {t('rivalry.pts')}
            {data.value != null && <> · {t('squad.value', { value: data.value.toFixed(1) })}</>}
            {data.rank != null && <> · {t('squad.rank', { rank: data.rank })}</>}
          </div>
          <PitchView squad={data.squad} />
        </>
      )}
    </div>
  );
}

export default function RivalryView() {
  const { t, lang } = useLang();
  const [teamIdA, setTeamIdA] = useTeamId();
  const [teamIdB, setTeamIdB] = useTeamId(RIVAL_STORAGE_KEY);
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [errorA, setErrorA] = useState(null);
  const [errorB, setErrorB] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  async function loadA(id) {
    const tid = String(id).trim();
    if (!tid) return;
    setTeamIdA(tid);
    setLoadingA(true);
    setErrorA(null);
    try {
      setDataA(await fetchSquad(tid));
    } catch (e) {
      setDataA(null);
      setErrorA(e.message);
    } finally {
      setLoadingA(false);
    }
  }

  async function loadB(id) {
    const tid = String(id).trim();
    if (!tid) return;
    setTeamIdB(tid);
    setLoadingB(true);
    setErrorB(null);
    try {
      setDataB(await fetchSquad(tid));
    } catch (e) {
      setDataB(null);
      setErrorB(e.message);
    } finally {
      setLoadingB(false);
    }
  }

  useEffect(() => {
    if (teamIdA) loadA(teamIdA);
    if (teamIdB) loadB(teamIdB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bothLoaded = dataA?.teamPoints != null && dataB?.teamPoints != null;
  const margin = bothLoaded ? Math.abs(dataA.teamPoints - dataB.teamPoints) : null;
  const winnerLabel = bothLoaded ? computeWinnerLabel(dataA, dataB, t) : null;
  const banterCat = bothLoaded ? banterCategory(margin) : null;
  // Seeded by the two team IDs + both scores: the same matchup at the same
  // score always shows the same line (stable across re-renders), but a
  // different gameweek's score for the same two teams picks a fresh one.
  const banterText = bothLoaded
    ? pickBanter(banterCat, lang, `${teamIdA}-${teamIdB}-${dataA.teamPoints}-${dataB.teamPoints}`, {
        w: winnerLabel,
        m: margin,
        p: dataA.teamPoints,
      })
    : null;

  return (
    <div>
      <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm">
        <h2 className="m-0 mb-2 font-display text-xl font-bold tracking-[0.01em]">{t('rivalry.title')}</h2>
        <div className="text-[13px] text-muted">{t('rivalry.note')}</div>
      </div>

      {bothLoaded && <BanterCard key={banterText} category={banterCat} text={banterText} t={t} />}

      <div className="flex gap-4 flex-wrap max-sm:flex-col">
        <Side
          label={t('rivalry.yourTeam')}
          teamId={teamIdA}
          setTeamId={setTeamIdA}
          data={dataA}
          error={errorA}
          loading={loadingA}
          onLoad={loadA}
          t={t}
        />
        <Side
          label={t('rivalry.rivalTeam')}
          teamId={teamIdB}
          setTeamId={setTeamIdB}
          data={dataB}
          error={errorB}
          loading={loadingB}
          onLoad={loadB}
          t={t}
        />
      </div>
    </div>
  );
}
