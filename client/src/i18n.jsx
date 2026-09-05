import { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'fpl-lang';

// UI chrome only — player/team/opponent names and other FPL API data are
// never translated (they're real-world data, not interface text).
const STRINGS = {
  en: {
    'app.title': 'FPL Dashboard',
    'nav.players': 'Players',
    'nav.fixtures': 'Fixtures',
    'nav.squad': 'My Squad',
    'nav.suggestions': 'Suggestions',
    'meta.eventPlayers': '{{event}} · {{count}} players',
    'meta.updated': 'Updated {{time}}',
    'time.justNow': 'just now',
    'time.minutesAgo': '{{n}}m ago',
    'time.hoursAgo': '{{n}}h ago',
    'status.loading': 'Loading FPL data…',
    'status.error': 'Error: {{message}}',

    'filters.search': 'Search player',
    'filters.searchPlaceholder': 'Player name…',
    'filters.position': 'Position',
    'filters.positionAll': 'All',
    'filters.team': 'Team',
    'filters.teamAll': 'All',
    'filters.maxPrice': 'Max price £{{price}}m',
    'filters.minOwn': 'Min own {{pct}}%',
    'filters.differential': 'Differential only (being bought)',
    'filters.shown': '{{count}} shown',

    'table.player': 'Player',
    'table.team': 'Team',
    'table.pos': 'Pos',
    'table.price': 'Price',
    'table.form': 'Form',
    'table.pts': 'Pts',
    'table.ptsPerM': 'Pts/M',
    'table.ownPct': 'Own %',
    'table.next3fdr': 'Next 3 FDR',
    'table.gwPts': 'GW Pts',
    'table.nextFixtures': 'Next fixture(s)',
    'table.score': 'Score',

    'sug.verdictColumn': 'Verdict',

    'legend.easy': 'Easy (1-2)',
    'legend.med': 'Med (3)',
    'legend.hard': 'Hard (4-5)',
    'legend.playersNote': 'Next 3 fixtures, in order. FDR is a 1-5 scale (5 = hardest). Pts/M = points per million (value).',

    'fixtures.loading': 'Loading fixtures…',
    'fixtures.teamCol': 'Team',
    'fixtures.now': 'now',
    'fixtures.home': 'Home',
    'fixtures.away': 'Away',
    'fixtures.fdr1': '1 · easiest',
    'fixtures.fdr2': '2 · easy',
    'fixtures.fdr3': '3 · medium',
    'fixtures.fdr4': '4 · hard',
    'fixtures.fdr5': '5 · hardest',
    'fixtures.note': 'v = home, @ = away. FDR 1–5 (5 = hardest). Scores shown for finished matches.',

    'fdr.easy': 'Easy',
    'fdr.med': 'Med',
    'fdr.hard': 'Hard',
    'fdr.tooltip': 'GW{{event}} vs {{opponent}} ({{side}}) — FDR {{fdr}}/5 ({{label}})',
    'fdr.home': 'H',
    'fdr.away': 'A',
    'fdr.none': '—',

    'teamId.label': 'FPL Team ID',
    'teamId.placeholder': 'e.g. 1234567',
    'teamId.loading': 'Loading…',
    'teamId.load': 'Load squad',
    'teamId.trySample': 'Try a sample team',
    'teamId.trySampleTitle': "Don't have your own Team ID yet? Preview the app with a real public team.",
    'teamId.empty.intro': 'Enter your FPL Team ID above to load your squad.',
    'teamId.empty.step1': 'and log in',
    'teamId.empty.step1Link': 'Go to',
    'teamId.empty.step2': 'Open the "Points" tab',
    'teamId.empty.step3': 'The number in the URL is your Team ID:',
    'teamId.empty.noTeam': "Just starting out and don't have a team yet?",
    'teamId.errorHelp': "Check the Team ID — it's the number in your FPL URL (fantasy.premierleague.com/entry/{{teamId}}/). A 404 means the ID doesn't exist.",

    'squad.loading': 'Loading your squad…',
    'squad.startingXI': 'Starting XI',
    'squad.bench': 'Bench',
    'squad.ptsThisGw': 'pts this GW',
    'squad.value': 'value £{{value}}m',
    'squad.rank': 'rank #{{rank}}',
    'squad.captain': 'Captain',
    'squad.viceCaptain': 'Vice-captain',
    'squad.emptyPrompt': 'Enter a Team ID and press Load squad.',

    'pitch.bench': 'Bench',
    'pitch.priorityTitle': 'Transfer priority #{{rank}} — biggest upgrade available',

    'sug.quickScan': 'Quick squad scan',
    'sug.quickScanNote': 'Every starting XI player compared to the best same-position replacement you can afford (assumes one swap at a time, not all at once) — hover a name to see the score breakdown. The number on a jersey is transfer priority (biggest score gap first).',
    'sug.pitchCurrent': 'Current team',
    'sug.pitchSuggested': 'Suggested team',
    'sug.pitchSuggestedNote': 'Dashed outline = a player the system suggests bringing in (assumes every "Upgrade" swap happens at once). Your real budget/free transfers may not stretch to all of them — see the table below for details.',
    'sug.scanCurrent': 'Current',
    'sug.scanSuggested': 'Suggested',
    'sug.scanNoOption': 'No affordable alternative',
    'sug.verdictUpgrade': 'Upgrade',
    'sug.verdictKeep': 'Keep',
    'sug.verdictNone': '—',
    'sug.scanning': 'Scanning squad…',

    'sug.transferTitle': 'Transfer suggestions',
    'sug.sell': 'Sell (replace)',
    'sug.sellPlaceholder': 'Choose a player to sell…',
    'sug.findReplacements': 'Find replacements',
    'sug.scoring': 'Scoring…',
    'sug.noCandidates': 'No affordable same-position candidates found.',
    'sug.sellingNote': 'Selling {{name}} (£{{price}}m) · bank £{{bank}}m · top 5 same-position candidates that fit the budget.',
    'sug.rank': '#',
    'sug.rankLabel': 'Rank',
    'sug.currentScore': 'Current score',
    'sug.suggestedScore': 'Suggested score',

    'sug.captainTitle': 'Captain pick',
    'sug.captainScoring': 'Scoring starting XI…',
    'sug.captainNote': 'Starting XI only · single next-fixture difficulty · top pick highlighted.',
    'sug.recommended': 'Recommended',

    'weights.label': 'Weights',
    'weights.form': 'Form',
    'weights.fixtures': 'Fixtures',
    'weights.value': 'Value',

    'lang.toggle': 'ไทย',
  },
  th: {
    'app.title': 'แดชบอร์ด FPL',
    'nav.players': 'นักเตะ',
    'nav.fixtures': 'โปรแกรมแข่ง',
    'nav.squad': 'ทีมของฉัน',
    'nav.suggestions': 'คำแนะนำ',
    'meta.eventPlayers': '{{event}} · นักเตะ {{count}} คน',
    'meta.updated': 'อัปเดตล่าสุด {{time}}',
    'time.justNow': 'เมื่อสักครู่',
    'time.minutesAgo': '{{n}} นาทีที่แล้ว',
    'time.hoursAgo': '{{n}} ชม. ที่แล้ว',
    'status.loading': 'กำลังโหลดข้อมูล FPL…',
    'status.error': 'เกิดข้อผิดพลาด: {{message}}',

    'filters.search': 'ค้นหานักเตะ',
    'filters.searchPlaceholder': 'ชื่อนักเตะ…',
    'filters.position': 'ตำแหน่ง',
    'filters.positionAll': 'ทั้งหมด',
    'filters.team': 'ทีม',
    'filters.teamAll': 'ทั้งหมด',
    'filters.maxPrice': 'ราคาสูงสุด £{{price}}m',
    'filters.minOwn': 'ครองทีมขั้นต่ำ {{pct}}%',
    'filters.differential': 'เฉพาะที่กำลังถูกซื้อ (differential)',
    'filters.shown': 'แสดง {{count}} คน',

    'table.player': 'นักเตะ',
    'table.team': 'ทีม',
    'table.pos': 'ตำแหน่ง',
    'table.price': 'ราคา',
    'table.form': 'ฟอร์ม',
    'table.pts': 'คะแนน',
    'table.ptsPerM': 'คะแนน/ล้าน',
    'table.ownPct': 'ครองทีม %',
    'table.next3fdr': 'FDR 3 นัดถัดไป',
    'table.gwPts': 'คะแนน GW',
    'table.nextFixtures': 'นัดถัดไป',
    'table.score': 'คะแนน',

    'sug.verdictColumn': 'ผลสรุป',

    'legend.easy': 'ง่าย (1-2)',
    'legend.med': 'ปานกลาง (3)',
    'legend.hard': 'ยาก (4-5)',
    'legend.playersNote': '3 นัดถัดไปตามลำดับ FDR เป็นสเกล 1-5 (5 = ยากสุด) Pts/M คือคะแนนต่อราคา 1 ล้านปอนด์ (ความคุ้มค่า)',

    'fixtures.loading': 'กำลังโหลดโปรแกรมแข่ง…',
    'fixtures.teamCol': 'ทีม',
    'fixtures.now': 'ตอนนี้',
    'fixtures.home': 'เหย้า',
    'fixtures.away': 'เยือน',
    'fixtures.fdr1': '1 · ง่ายที่สุด',
    'fixtures.fdr2': '2 · ง่าย',
    'fixtures.fdr3': '3 · ปานกลาง',
    'fixtures.fdr4': '4 · ยาก',
    'fixtures.fdr5': '5 · ยากที่สุด',
    'fixtures.note': 'v = เหย้า, @ = เยือน FDR 1–5 (5 = ยากสุด) นัดที่จบแล้วจะโชว์สกอร์',

    'fdr.easy': 'ง่าย',
    'fdr.med': 'กลาง',
    'fdr.hard': 'ยาก',
    'fdr.tooltip': 'GW{{event}} พบ {{opponent}} ({{side}}) — FDR {{fdr}}/5 ({{label}})',
    'fdr.home': 'H',
    'fdr.away': 'A',
    'fdr.none': '—',

    'teamId.label': 'FPL Team ID',
    'teamId.placeholder': 'เช่น 1234567',
    'teamId.loading': 'กำลังโหลด…',
    'teamId.load': 'โหลดทีม',
    'teamId.trySample': 'ลองด้วยทีมตัวอย่าง',
    'teamId.trySampleTitle': 'ยังไม่มี Team ID ของตัวเอง? ลองดูตัวอย่างจากทีมสาธารณะจริง',
    'teamId.empty.intro': 'ใส่ FPL Team ID ของคุณด้านบนเพื่อโหลดทีม',
    'teamId.empty.step1': 'แล้ว log in',
    'teamId.empty.step1Link': 'เข้า',
    'teamId.empty.step2': 'ไปแท็บ "Points"',
    'teamId.empty.step3': 'ตัวเลขใน URL คือ Team ID ของคุณ:',
    'teamId.empty.noTeam': 'เพิ่งเริ่มเล่นและยังไม่มีทีม?',
    'teamId.errorHelp': 'ตรวจสอบ Team ID — คือตัวเลขใน URL ของ FPL (fantasy.premierleague.com/entry/{{teamId}}/) ถ้าเจอ 404 แปลว่าไม่มี ID นี้อยู่จริง',

    'squad.loading': 'กำลังโหลดทีมของคุณ…',
    'squad.startingXI': 'ตัวจริง',
    'squad.bench': 'ตัวสำรอง',
    'squad.ptsThisGw': 'คะแนนสัปดาห์นี้',
    'squad.value': 'มูลค่า £{{value}}m',
    'squad.rank': 'อันดับ #{{rank}}',
    'squad.captain': 'กัปตัน',
    'squad.viceCaptain': 'รองกัปตัน',
    'squad.emptyPrompt': 'ใส่ Team ID แล้วกด "โหลดทีม"',

    'pitch.bench': 'ตัวสำรอง',
    'pitch.priorityTitle': 'ลำดับความสำคัญเปลี่ยนตัว #{{rank}} — ส่วนต่างคะแนนเยอะที่สุด',

    'sug.quickScan': 'สแกนทีมด่วน',
    'sug.quickScanNote': 'เทียบตัวจริงทั้ง 11 คนกับตัวเลือกที่ดีที่สุดในตำแหน่งเดียวกันที่งบไหว (คำนวณแบบเปลี่ยนทีละคน ไม่ใช่เปลี่ยนพร้อมกันทั้งหมด) — เอาเมาส์ชี้ชื่อเพื่อดู breakdown คะแนน ตัวเลขบนเสื้อ = ลำดับความสำคัญที่ควรเปลี่ยนก่อน (ส่วนต่างคะแนนเยอะสุดก่อน)',
    'sug.pitchCurrent': 'ทีมปัจจุบัน',
    'sug.pitchSuggested': 'ทีมแนะนำ',
    'sug.pitchSuggestedNote': 'เสื้อขอบเส้นประ = ตัวที่ระบบแนะนำให้เปลี่ยนเข้ามาแทน (สมมติว่าเปลี่ยนทุกตำแหน่งที่เป็น Upgrade พร้อมกัน) — ของจริงงบ/free transfer อาจไม่พอให้เปลี่ยนพร้อมกันทั้งหมด ดูรายละเอียดที่ตารางด้านล่าง',
    'sug.scanCurrent': 'ปัจจุบัน',
    'sug.scanSuggested': 'แนะนำ',
    'sug.scanNoOption': 'ไม่มีตัวเลือกที่งบไหว',
    'sug.verdictUpgrade': 'ควรเปลี่ยน',
    'sug.verdictKeep': 'คงไว้',
    'sug.verdictNone': '—',
    'sug.scanning': 'กำลังสแกนทีม…',

    'sug.transferTitle': 'คำแนะนำเปลี่ยนตัว',
    'sug.sell': 'ขายออก (เปลี่ยนตัว)',
    'sug.sellPlaceholder': 'เลือกนักเตะที่จะขาย…',
    'sug.findReplacements': 'หาตัวแทน',
    'sug.scoring': 'กำลังคำนวณ…',
    'sug.noCandidates': 'ไม่พบตัวเลือกตำแหน่งเดียวกันที่งบไหว',
    'sug.sellingNote': 'ขาย {{name}} (£{{price}}m) · งบคงเหลือ £{{bank}}m · 5 อันดับตัวเลือกตำแหน่งเดียวกันที่งบไหว',
    'sug.rank': '#',
    'sug.rankLabel': 'อันดับ',
    'sug.currentScore': 'คะแนนปัจจุบัน',
    'sug.suggestedScore': 'คะแนนแนะนำ',

    'sug.captainTitle': 'คำแนะนำกัปตัน',
    'sug.captainScoring': 'กำลังคำนวณตัวจริง…',
    'sug.captainNote': 'พิจารณาเฉพาะตัวจริง · ใช้ความยากนัดถัดไปนัดเดียว · อันดับ 1 ไฮไลต์ไว้',
    'sug.recommended': 'แนะนำ',

    'weights.label': 'น้ำหนัก',
    'weights.form': 'ฟอร์ม',
    'weights.fixtures': 'โปรแกรมแข่ง',
    'weights.value': 'ความคุ้มค่า',

    'lang.toggle': 'EN',
  },
};

function translate(lang, key, vars) {
  const dict = STRINGS[lang] || STRINGS.en;
  let str = dict[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return str;
}

const LangContext = createContext(null);
const STORAGE_KEY_LANG = STORAGE_KEY;

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LANG) || 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY_LANG, l);
    } catch {
      // ignore — falls back to in-memory only
    }
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}
