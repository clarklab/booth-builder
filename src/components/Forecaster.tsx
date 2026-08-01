import { useEffect, useMemo, useRef, useState } from 'react';
import { buildBoothForTarget, type BoothBuild } from '../domain/autoLayout';
import { money } from '../domain/layout';
import {
  SHIRT_PRESETS,
  TAPE_PRESETS,
  computeForecast,
  defaultPlan,
  lineFromPreset,
  loadPlan,
  savePlan,
  type ForecastResult,
  type LineResult,
  type MerchKind,
  type MerchLine,
  type MerchPreset,
  type Plan,
} from '../domain/forecast';

type Props = {
  onHome: () => void;
  onBuildBooth: (build: BoothBuild) => void;
};

const STEPS = ['Shows', 'VHS releases', 'T-shirts', 'Your year'] as const;

const SHOW_CHIPS = [4, 8, 12, 24, 36];
const TAKE_CHIPS = [100, 200, 400, 800];
const CROWD_CHIPS = [
  { v: 0.1, label: 'Slow', sub: '10% moves' },
  { v: 0.25, label: 'Typical', sub: '25% moves' },
  { v: 0.5, label: 'Busy', sub: '50% moves' },
];
const SELL_CHIPS = [0.5, 0.65, 0.8, 1];

export function Forecaster({ onHome, onBuildBooth }: Props) {
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [step, setStep] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => computeForecast(plan), [plan]);
  const build = useMemo(
    () => buildBoothForTarget(plan.takePerShow, plan.boothSellThrough),
    [plan.takePerShow, plan.boothSellThrough],
  );

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  // Each step is its own page — start it at the top, not wherever the last
  // one was scrolled to.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const patch = (p: Partial<Plan>) => setPlan((cur) => ({ ...cur, ...p }));

  const addLine = (preset: MerchPreset) =>
    setPlan((cur) => ({
      ...cur,
      lines: [
        ...cur.lines,
        lineFromPreset(preset, cur.lines.filter((l) => l.kind === preset.kind).length),
      ],
    }));

  const patchLine = (uid: string, p: Partial<MerchLine>) =>
    setPlan((cur) => ({
      ...cur,
      lines: cur.lines.map((l) => (l.uid === uid ? { ...l, ...p } : l)),
    }));

  const removeLine = (uid: string) =>
    setPlan((cur) => ({ ...cur, lines: cur.lines.filter((l) => l.uid !== uid) }));

  const reset = () => {
    if (!confirm('Start the forecast over from scratch?')) return;
    setPlan(defaultPlan());
    setStep(0);
  };

  return (
    <div className="fc">
      <header className="header">
        <button className="btn ghost back" onClick={onHome}>
          ← Home
        </button>
        <span className="logo">📈</span>
        <h1>Forecaster</h1>
        <span className="tag">year planner</span>
        <div className="spacer" />
        <span className="badge">
          <strong>{money(result.netProfit)}</strong> projected profit
        </span>
      </header>

      <nav className="fc-steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            className={`fc-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
            onClick={() => setStep(i)}
          >
            <span className="n">{i < step ? '✓' : i + 1}</span>
            <span className="t">{s}</span>
          </button>
        ))}
      </nav>

      <div className="fc-body" ref={bodyRef}>
        <div className="fc-page">
          {step === 0 && <ShowsStep plan={plan} patch={patch} build={build} />}
          {step === 1 && (
            <MerchStep
              kind="tape"
              title="Custom VHS releases"
              blurb="Tap a run size to add a release. Every tape in the run costs you money up front — only the ones that sell pay you back."
              emoji="📼"
              presets={TAPE_PRESETS}
              lines={result.tapeLines}
              onAdd={addLine}
              onPatch={patchLine}
              onRemove={removeLine}
            />
          )}
          {step === 2 && (
            <MerchStep
              kind="shirt"
              title="T-shirt runs"
              blurb="Same deal as tapes: you pay the printer for the whole order, then sell them off across the year."
              emoji="👕"
              presets={SHIRT_PRESETS}
              lines={result.shirtLines}
              onAdd={addLine}
              onPatch={patchLine}
              onRemove={removeLine}
            />
          )}
          {step === 3 && (
            <ResultsStep
              plan={plan}
              result={result}
              build={build}
              onBuildBooth={() => onBuildBooth(build)}
              onReset={reset}
              onEdit={setStep}
            />
          )}
        </div>
      </div>

      <footer className="fc-foot">
        <button
          className="btn"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Back
        </button>
        <div className="fc-running">
          <span className="l">Year so far</span>
          <span className="v">{money(result.netProfit)}</span>
        </div>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" onClick={() => setStep((s) => s + 1)}>
            {step === 0 ? 'Add releases →' : step === 1 ? 'Add shirts →' : 'See the year →'}
          </button>
        ) : (
          <button className="btn primary" onClick={() => onBuildBooth(build)}>
            Build this booth →
          </button>
        )}
      </footer>
    </div>
  );
}

// ---------- Step 1: shows ----------

function ShowsStep({
  plan,
  patch,
  build,
}: {
  plan: Plan;
  patch: (p: Partial<Plan>) => void;
  build: BoothBuild;
}) {
  return (
    <>
      <h2 className="fc-h">How many shows this year?</h2>
      <p className="fc-p">
        Swap meets, record fairs, flea markets — anywhere you set the tent up.
      </p>

      <Chips
        value={plan.shows}
        options={SHOW_CHIPS.map((v) => ({ v, label: `${v}` }))}
        onPick={(v) => patch({ shows: v })}
      />
      <Stepper
        value={plan.shows}
        min={1}
        step={1}
        suffix="shows"
        onChange={(v) => patch({ shows: v })}
      />

      <h2 className="fc-h">What do you want out of one show?</h2>
      <p className="fc-p">
        Used-tape sales off the tables. This is the number the Booth Builder
        sizes your tent and tables for.
      </p>
      <Chips
        value={plan.takePerShow}
        options={TAKE_CHIPS.map((v) => ({ v, label: money(v) }))}
        onPick={(v) => patch({ takePerShow: v })}
      />
      <Stepper
        value={plan.takePerShow}
        min={0}
        step={25}
        prefix="$"
        suffix="per show"
        onChange={(v) => patch({ takePerShow: v })}
      />

      <h2 className="fc-h">How busy is the crowd?</h2>
      <p className="fc-p">
        How much of what's on the table actually moves in a day. It decides how
        much tape you need on display to hit your number.
      </p>
      <div className="fc-chips wide">
        {CROWD_CHIPS.map((c) => (
          <button
            key={c.v}
            className={`fc-chip tall${plan.boothSellThrough === c.v ? ' on' : ''}`}
            onClick={() => patch({ boothSellThrough: c.v })}
          >
            <span className="cl">{c.label}</span>
            <span className="cs">{c.sub}</span>
          </button>
        ))}
      </div>

      <h2 className="fc-h">What does a show cost you?</h2>
      <p className="fc-p">Booth fee, gas, and whatever else it takes to get there.</p>
      <Stepper
        value={plan.costPerShow}
        min={0}
        step={5}
        prefix="$"
        suffix="per show"
        onChange={(v) => patch({ costPerShow: v })}
      />

      <div className="fc-note">
        <div className="fc-note-h">That's a booth of…</div>
        <div className="fc-note-b">
          <strong>{build.summary}</strong> — {build.totalTapes.toLocaleString()} tapes
          on display, about {money(build.expectedTake)} a show at{' '}
          {Math.round(plan.boothSellThrough * 100)}% sell-through.
          {!build.meetsTarget && (
            <span className="warn">
              {' '}
              That's the biggest booth that fits under a 12′ canopy — {money(plan.takePerShow)}{' '}
              a show is a stretch at this crowd level.
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Steps 2 & 3: merch ----------

function MerchStep({
  kind,
  title,
  blurb,
  emoji,
  presets,
  lines,
  onAdd,
  onPatch,
  onRemove,
}: {
  kind: MerchKind;
  title: string;
  blurb: string;
  emoji: string;
  presets: MerchPreset[];
  lines: LineResult[];
  onAdd: (p: MerchPreset) => void;
  onPatch: (uid: string, p: Partial<MerchLine>) => void;
  onRemove: (uid: string) => void;
}) {
  const made = lines.reduce((a, l) => a + l.qty, 0);
  const profit = lines.reduce((a, l) => a + l.profit, 0);

  return (
    <>
      <h2 className="fc-h">{title}</h2>
      <p className="fc-p">{blurb}</p>

      <div className="fc-presets">
        {presets.map((p) => (
          <button key={p.id} className="fc-preset" onClick={() => onAdd(p)}>
            <span className="pp">+</span>
            <span className="pm">
              <span className="pl">{p.label}</span>
              <span className="pb">{p.blurb}</span>
            </span>
            <span className="pv">
              {money(p.unitCost)} → {money(p.price)}
            </span>
          </button>
        ))}
      </div>

      {lines.length === 0 ? (
        <div className="fc-empty">
          <span className="e">{emoji}</span>
          No {kind === 'tape' ? 'releases' : 'shirt runs'} yet. Tap one above to add
          it — you can tweak the numbers after.
        </div>
      ) : (
        <>
          <div className="fc-lines">
            {lines.map((l) => (
              <LineCard key={l.uid} line={l} onPatch={onPatch} onRemove={onRemove} />
            ))}
          </div>
          <div className="fc-note">
            <div className="fc-note-h">
              {lines.length} {kind === 'tape' ? 'release' : 'run'}
              {lines.length === 1 ? '' : 's'}
            </div>
            <div className="fc-note-b">
              {made.toLocaleString()} units made ·{' '}
              <strong className={profit >= 0 ? 'pos' : 'neg'}>{money(profit)}</strong>{' '}
              profit after production.
            </div>
          </div>
        </>
      )}
    </>
  );
}

function LineCard({
  line,
  onPatch,
  onRemove,
}: {
  line: LineResult;
  onPatch: (uid: string, p: Partial<MerchLine>) => void;
  onRemove: (uid: string) => void;
}) {
  return (
    <div className="fc-line">
      <div className="fl-head">
        <input
          className="fl-name"
          value={line.name}
          onChange={(e) => onPatch(line.uid, { name: e.target.value })}
          aria-label="Name"
        />
        <button
          className="fl-x"
          onClick={() => onRemove(line.uid)}
          aria-label="Remove"
          title="Remove"
        >
          ✕
        </button>
      </div>

      <div className="fl-grid">
        <MiniStepper
          label="Make"
          value={line.qty}
          step={line.kind === 'tape' ? 5 : 6}
          min={0}
          onChange={(v) => onPatch(line.uid, { qty: v })}
        />
        <MiniStepper
          label="Cost each"
          value={line.unitCost}
          step={0.5}
          min={0}
          prefix="$"
          onChange={(v) => onPatch(line.uid, { unitCost: round2(v) })}
        />
        <MiniStepper
          label="Sell for"
          value={line.price}
          step={1}
          min={0}
          prefix="$"
          onChange={(v) => onPatch(line.uid, { price: round2(v) })}
        />
      </div>

      <div className="fl-sell">
        <span className="fl-lbl">Expect to sell</span>
        <div className="fc-chips tight">
          {SELL_CHIPS.map((s) => (
            <button
              key={s}
              className={`fc-chip sm${Math.abs(line.sellThrough - s) < 0.001 ? ' on' : ''}`}
              onClick={() => onPatch(line.uid, { sellThrough: s })}
            >
              {Math.round(s * 100)}%
            </button>
          ))}
        </div>
      </div>

      <div className="fl-out">
        <span>
          {line.unitsSold} sold × {money(line.marginEach)} margin
        </span>
        <span className={line.profit >= 0 ? 'pos' : 'neg'}>{money(line.profit)}</span>
      </div>
      <div className="fl-sub">
        {money(line.revenue)} in, {money(line.cost)} to make
        {line.leftover > 0 && ` · ${line.leftover} left over (${money(line.leftoverValue)} of stock)`}
      </div>
    </div>
  );
}

// ---------- Step 4: results ----------

function ResultsStep({
  plan,
  result,
  build,
  onBuildBooth,
  onReset,
  onEdit,
}: {
  plan: Plan;
  result: ForecastResult;
  build: BoothBuild;
  onBuildBooth: () => void;
  onReset: () => void;
  onEdit: (step: number) => void;
}) {
  const rows = [
    { label: `Booth sales · ${plan.shows} shows`, v: result.boothRevenue, kind: 'in' },
    { label: 'Custom VHS releases', v: sumBy(result.tapeLines, (l) => l.revenue), kind: 'in' },
    { label: 'T-shirts', v: sumBy(result.shirtLines, (l) => l.revenue), kind: 'in' },
    { label: 'Making the merch', v: -result.merchCost, kind: 'out' },
    { label: `Show costs · ${money(plan.costPerShow)} × ${plan.shows}`, v: -result.showCost, kind: 'out' },
  ].filter((r) => r.v !== 0);

  const scale = Math.max(1, ...rows.map((r) => Math.abs(r.v)));

  return (
    <>
      <div className="fc-hero">
        <div className="fh-lbl">Projected profit for the year</div>
        <div className={`fh-num${result.netProfit >= 0 ? '' : ' neg'}`}>
          {money(result.netProfit)}
        </div>
        <div className="fh-sub">
          {money(result.grossRevenue)} in · {money(result.totalCost)} out ·{' '}
          {Math.round(result.marginPct * 100)}% margin
        </div>
      </div>

      <div className="fc-tiles">
        <div className="fc-tile">
          <div className="n">{money(result.perShowNet)}</div>
          <div className="l">profit per show</div>
        </div>
        <div className="fc-tile">
          <div className="n">{result.unitsSold.toLocaleString()}</div>
          <div className="l">merch units sold</div>
        </div>
        <div className="fc-tile">
          <div className="n">
            {result.breakEvenShows === null ? '—' : `#${result.breakEvenShows}`}
          </div>
          <div className="l">break-even show</div>
        </div>
        <div className="fc-tile">
          <div className="n">{money(result.leftoverValue)}</div>
          <div className="l">left-over stock</div>
        </div>
      </div>

      <h2 className="fc-h">Where it comes from</h2>
      <div className="fc-bars">
        {rows.map((r) => (
          <div className={`fc-bar ${r.kind}`} key={r.label}>
            <span className="bl">{r.label}</span>
            <span className="bt">
              <span style={{ width: `${(Math.abs(r.v) / scale) * 100}%` }} />
            </span>
            <span className="bv">
              {r.v < 0 ? '−' : ''}
              {money(Math.abs(r.v))}
            </span>
          </div>
        ))}
      </div>

      {result.lines.length > 0 && (
        <>
          <h2 className="fc-h">Every run</h2>
          <div className="fc-table">
            {result.lines.map((l) => (
              <div className="fc-tr" key={l.uid}>
                <span className="c1">
                  {l.kind === 'tape' ? '📼' : '👕'} {l.name}
                </span>
                <span className="c2">
                  {l.qty} @ {money(l.unitCost)} → {money(l.price)}
                </span>
                <span className={`c3 ${l.profit >= 0 ? 'pos' : 'neg'}`}>
                  {money(l.profit)}
                </span>
              </div>
            ))}
          </div>
          <button className="fc-link" onClick={() => onEdit(1)}>
            Edit the runs
          </button>
        </>
      )}

      <div className="fc-cta">
        <div className="cta-h">Ready to set up?</div>
        <div className="cta-b">
          To pull <strong>{money(plan.takePerShow)}</strong> a show at{' '}
          {Math.round(plan.boothSellThrough * 100)}% sell-through you need about{' '}
          <strong>{build.totalTapes.toLocaleString()} tapes</strong> on display. That's
          a <strong>{build.summary}</strong>.
          {!build.meetsTarget && (
            <span className="warn">
              {' '}
              Even maxed out that booth lands nearer {money(build.expectedTake)} a show —
              add shows, raise prices, or expect a busier crowd.
            </span>
          )}
        </div>
        <div className="cta-stats">
          <span>{build.tentFt}′ × {build.tentFt}′ tent</span>
          <span>{build.tableCount} tables</span>
          {build.rackCount > 0 && <span>{build.rackCount} front racks</span>}
          {build.markedCount > 0 && <span>{build.markedCount} “as marked”</span>}
        </div>
        <button className="btn primary big" onClick={onBuildBooth}>
          🎪 Open this booth in the Builder →
        </button>
      </div>

      <button className="fc-link danger" onClick={onReset}>
        Start the forecast over
      </button>
    </>
  );
}

// ---------- Little inputs ----------

function Chips({
  value,
  options,
  onPick,
}: {
  value: number;
  options: { v: number; label: string }[];
  onPick: (v: number) => void;
}) {
  return (
    <div className="fc-chips">
      {options.map((o) => (
        <button
          key={o.v}
          className={`fc-chip${value === o.v ? ' on' : ''}`}
          onClick={() => onPick(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  step,
  min,
  prefix = '',
  suffix = '',
  onChange,
}: {
  value: number;
  step: number;
  min: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="fc-stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="Less">
        −
      </button>
      <div className="sv">
        <input
          value={value}
          inputMode="numeric"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9.]/g, ''));
            onChange(Number.isFinite(n) ? Math.max(min, n) : min);
          }}
          style={{ width: `${Math.max(2, String(value).length)}ch` }}
          aria-label="Value"
        />
        <span className="pre">{prefix}</span>
        <span className="suf">{suffix}</span>
      </div>
      <button onClick={() => onChange(value + step)} aria-label="More">
        +
      </button>
    </div>
  );
}

function MiniStepper({
  label,
  value,
  step,
  min,
  prefix = '',
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  prefix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="fc-mini">
      <span className="ml">{label}</span>
      <div className="mrow">
        <button onClick={() => onChange(Math.max(min, round2(value - step)))}>−</button>
        <span className="mv">
          {prefix}
          {value}
        </span>
        <button onClick={() => onChange(round2(value + step))}>+</button>
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumBy<T>(xs: T[], f: (x: T) => number): number {
  return xs.reduce((a, x) => a + f(x), 0);
}
