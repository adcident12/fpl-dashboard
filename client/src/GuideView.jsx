import { useLang } from './i18n.jsx';

// Static content, not run through the STRINGS dictionary — this is long-form
// prose, not short UI labels, so a per-sentence i18n key would be unwieldy.
// Badge previews below reuse the exact CSS classes used elsewhere in the app
// (styles.css) so what's shown here is pixel-identical to what a user sees
// on the Suggestions/Fixtures/Chips tabs, not just a text description.

function Section({ title, children }) {
  return (
    <section className="bg-panel border border-line rounded-md p-4">
      <h2 className="m-0 mb-3 font-display text-xl font-bold tracking-[0.01em]">{title}</h2>
      <div className="flex flex-col gap-3 text-[14px] leading-relaxed">{children}</div>
    </section>
  );
}

function WeightTable({ rows, headers }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left border-b border-line py-1.5 pr-3 text-muted font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((cell, i) => (
                <td key={i} className="py-1.5 pr-3 border-b border-line/50">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuideEN() {
  return (
    <div className="flex flex-col gap-5">
      <Section title="How Suggestions works">
        <p>
          Every score in the Suggestions and Quick Squad Scan sections comes from one transparent formula —
          never a hidden ranking. Hover any player name (or read this page) to see exactly why a number is
          what it is: raw value → normalized 0-100 → × weight → points.
        </p>
      </Section>

      <Section title="The scoring formula — 4 weighted components">
        <p>Each component is scaled to 0-100 before weighting, then summed:</p>
        <WeightTable
          headers={['Component', 'Transfer suggestions', 'Captain suggestions']}
          rows={[
            ['Form (~5 GW avg)', '30%', '35%'],
            ['Fixture difficulty', '30% (next 3 GW avg)', '35% (this GW\'s actual fixture(s))'],
            ['Value (pts per £m)', '20%', '10%'],
            ['Underlying (xG+xA per 90)', '20%', '20%'],
          ]}
        />
        <p className="text-muted text-[13px]">
          "Underlying" is a forward-looking signal (should this player be scoring, based on chances created)
          distinct from "Form" (actual points already scored, which mixes in finishing luck) — kept as its own
          component so the breakdown shows both honestly. Below 180 minutes played, a player's underlying stat
          is treated as neutral instead of their real (statistically unreliable) per-90 number.
        </p>
      </Section>

      <Section title="Then: Double/Blank Gameweek adjustment">
        <p>
          Read from that gameweek's actual fixtures, not "whichever match comes next" (which can silently skip
          a blank or miscount a double):
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <span className="badge event-flag blank">BLANK</span> — no fixture that gameweek. Fixture score
            forced to <b>0</b> (a guaranteed zero, not a guess).
          </li>
          <li>
            <span className="badge event-flag dgw">DGW ×2</span> — two fixtures that gameweek. Fixture score
            gets a flat bonus for the extra scoring chance.
          </li>
        </ul>
      </Section>

      <Section title="Then: availability multiplier">
        <p>
          <span className="badge event-flag availability-severe">25%</span>{' '}
          <span className="badge event-flag availability-minor">75%</span> — FPL's own "chance of playing"
          percentage. Applied as a multiplier on the <i>final</i> score, not blended in as a 5th component:
        </p>
        <p className="font-mono text-[13px] bg-panel-2 rounded px-3 py-2">
          score = (form + fixture + value + underlying) × chance of playing ÷ 100
        </p>
        <p>
          A 25% chance of playing quarters the score — armbanding a doubtful captain is one of the most common
          real FPL mistakes this exists to catch. No badge at all means fully fit (100%).
        </p>
      </Section>

      <Section title="Shown, but never scored">
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <span className="badge event-flag penalty">⚽ Pen 1</span> — the club's first-choice penalty
            taker. Informational only — how many penalties a team wins is too unpredictable to weight into a
            formula without implying false precision.
          </li>
          <li>Ownership % and Differential (Players tab) — meta-strategy signals, not player-quality ones.</li>
        </ul>
      </Section>

      <Section title="Other badges around the app">
        <div className="flex flex-col gap-2.5">
          <div>
            <div className="text-muted text-[12px] mb-1">Fixture difficulty (FDR), 1 (easiest) – 5 (hardest)</div>
            <span className="fdr-badge fdr-easy">ARS</span> <span className="fdr-badge fdr-med">ARS</span>{' '}
            <span className="fdr-badge fdr-hard">ARS</span>
          </div>
          <div>
            <div className="text-muted text-[12px] mb-1">Quick Squad Scan verdict</div>
            <span className="badge verdict-upgrade">Upgrade</span>{' '}
            <span className="badge verdict-keep">Keep</span>
          </div>
          <div>
            <div className="text-muted text-[12px] mb-1">Chip window status (Chips tab)</div>
            <span className="chip-card chip-status-available" style={{ display: 'inline-block', padding: '4px 10px' }}>
              <span className="chip-card-status">Available</span>
            </span>{' '}
            <span className="chip-card chip-status-expiringSoon" style={{ display: 'inline-block', padding: '4px 10px' }}>
              <span className="chip-card-status">Use soon</span>
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}

function GuideTH() {
  return (
    <div className="flex flex-col gap-5">
      <Section title="ระบบ Suggestions ทำงานอย่างไร">
        <p>
          ทุกคะแนนในแท็บ Suggestions และ Quick Squad Scan มาจากสูตรเดียวที่โปร่งใส — ไม่ใช่การจัดอันดับแบบซ่อนสูตร
          เอาเมาส์ชี้ชื่อนักเตะ (หรืออ่านหน้านี้) จะเห็นเหตุผลของตัวเลขทุกจุด: ค่าดิบ → normalize เป็น 0-100 → คูณน้ำหนัก → คะแนน
        </p>
      </Section>

      <Section title="สูตรคำนวณคะแนน — 4 องค์ประกอบถ่วงน้ำหนัก">
        <p>แต่ละองค์ประกอบถูกปรับสเกลเป็น 0-100 ก่อนคูณน้ำหนัก แล้วบวกรวมกัน:</p>
        <WeightTable
          headers={['องค์ประกอบ', 'คำแนะนำเปลี่ยนตัว', 'คำแนะนำกัปตัน']}
          rows={[
            ['ฟอร์ม (เฉลี่ย ~5 GW)', '30%', '35%'],
            ['ความยากโปรแกรมแข่ง', '30% (เฉลี่ย 3 GW ถัดไป)', '35% (นัดจริงของ GW นั้น)'],
            ['ความคุ้มค่า (แต้ม/ราคา)', '20%', '10%'],
            ['สถิติเบื้องหลัง (xG+xA ต่อ 90 นาที)', '20%', '20%'],
          ]}
        />
        <p className="text-muted text-[13px]">
          "สถิติเบื้องหลัง" เป็นสัญญาณเชิงคาดการณ์ล่วงหน้า (ควรทำผลงานได้เท่าไหร่ตามคุณภาพโอกาสที่สร้าง) ต่างจาก "ฟอร์ม"
          (แต้มจริงที่ทำได้แล้ว ซึ่งปนโชค/การจบสกอร์) จึงแยกเป็นองค์ประกอบของตัวเอง ไม่ผสมรวมกัน ถ้าลงเล่นน้อยกว่า 180 นาที
          ค่าสถิติเบื้องหลังของนักเตะคนนั้นจะถูกมองเป็นค่ากลาง แทนค่า per-90 จริงที่ยังไม่น่าเชื่อถือ
        </p>
      </Section>

      <Section title="ปรับต่อ: Double/Blank Gameweek">
        <p>อ่านจากนัดแข่งจริงของ gameweek นั้นตรงๆ ไม่ใช่ "นัดถัดไปเท่าที่เจอ" ที่อาจข้าม blank หรือนับ double ผิด:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <span className="badge event-flag blank">ไม่มีนัด</span> — ไม่มีนัดแข่งใน gameweek นั้น คะแนนด้าน fixture
            ถูกบังคับให้เป็น <b>0</b> (รู้แน่ชัด ไม่ใช่การเดา)
          </li>
          <li>
            <span className="badge event-flag dgw">DGW ×2</span> — มี 2 นัดใน gameweek นั้น คะแนนด้าน fixture
            ได้โบนัสคงที่จากโอกาสทำแต้ม 2 ครั้ง
          </li>
        </ul>
      </Section>

      <Section title="ปรับสุดท้าย: ตัวคูณโอกาสลงเล่น">
        <p>
          <span className="badge event-flag availability-severe">25%</span>{' '}
          <span className="badge event-flag availability-minor">75%</span> — เปอร์เซ็นต์ "โอกาสลงเล่น" จาก FPL เอง
          ถูกใช้เป็น<b>ตัวคูณคะแนนสุดท้าย</b> ไม่ใช่ผสมเป็นองค์ประกอบที่ 5:
        </p>
        <p className="font-mono text-[13px] bg-panel-2 rounded px-3 py-2">
          คะแนน = (ฟอร์ม + fixture + ความคุ้มค่า + สถิติเบื้องหลัง) × โอกาสลงเล่น ÷ 100
        </p>
        <p>
          โอกาสลงเล่น 25% คะแนนหายไป 3/4 ทันที — การใส่ปลอกแขนให้นักเตะที่มีข้อสงสัยเรื่องลงเล่นเป็นความผิดพลาดที่พบบ่อยที่สุดอย่างหนึ่งในเกมจริง
          ระบบนี้ออกแบบมาเพื่อจับจุดนี้โดยเฉพาะ ถ้าไม่มี badge เลย = ฟิตเต็มร้อย
        </p>
      </Section>

      <Section title="โชว์ให้เห็น แต่ไม่เอาไปคิดคะแนน">
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <span className="badge event-flag penalty">⚽ จุดโทษ 1</span> — มือยิงจุดโทษอันดับ 1 ของทีม
            ข้อมูลเสริมเท่านั้น เพราะจำนวนจุดโทษที่ทีมจะได้คาดเดายากเกินกว่าจะใส่เป็นตัวแปรถ่วงน้ำหนักแบบมีความแม่นยำจริง
          </li>
          <li>% การถือครอง (Ownership) และ Differential (แท็บ Players) — เป็นสัญญาณด้านกลยุทธ์การแข่งขัน ไม่ใช่คุณภาพนักเตะ</li>
        </ul>
      </Section>

      <Section title="Badge อื่นๆ ในแอป">
        <div className="flex flex-col gap-2.5">
          <div>
            <div className="text-muted text-[12px] mb-1">ความยากโปรแกรมแข่ง (FDR) 1 (ง่ายสุด) – 5 (ยากสุด)</div>
            <span className="fdr-badge fdr-easy">ARS</span> <span className="fdr-badge fdr-med">ARS</span>{' '}
            <span className="fdr-badge fdr-hard">ARS</span>
          </div>
          <div>
            <div className="text-muted text-[12px] mb-1">ผลสรุป Quick Squad Scan</div>
            <span className="badge verdict-upgrade">ควรเปลี่ยน</span>{' '}
            <span className="badge verdict-keep">คงไว้</span>
          </div>
          <div>
            <div className="text-muted text-[12px] mb-1">สถานะช่วงเวลาใช้ Chip (แท็บ Chips)</div>
            <span className="chip-card chip-status-available" style={{ display: 'inline-block', padding: '4px 10px' }}>
              <span className="chip-card-status">ใช้ได้</span>
            </span>{' '}
            <span className="chip-card chip-status-expiringSoon" style={{ display: 'inline-block', padding: '4px 10px' }}>
              <span className="chip-card-status">ใกล้หมดอายุ</span>
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default function GuideView() {
  const { lang } = useLang();
  return lang === 'th' ? <GuideTH /> : <GuideEN />;
}
