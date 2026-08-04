import { money } from '../domain/layout';
import {
  KIND_META,
  dayLabel,
  isSwap,
  makeSplitId,
  type EventResult,
  type MerchEvent,
  type PlanEvent,
  type Split,
} from '../domain/plan';

const CROWD_CHIPS = [
  { v: 0.1, label: 'Slow' },
  { v: 0.25, label: 'Typical' },
  { v: 0.5, label: 'Busy' },
];
const SELL_CHIPS = [0.5, 0.65, 0.8, 1];

type Props = {
  event: PlanEvent;
  result: EventResult;
  open: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<PlanEvent>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  /** Swap events only. */
  onBuildBooth?: () => void;
};

export function EventCard({
  event,
  result,
  open,
  onToggle,
  onPatch,
  onRemove,
  onDuplicate,
  onBuildBooth,
}: Props) {
  const meta = KIND_META[event.kind];
  const done = event.status === 'done';

  return (
    <div className={`pl-event${open ? ' open' : ''}${done ? ' done' : ''}`}>
      <button className="pe-row" onClick={onToggle} aria-expanded={open}>
        <span className="pe-emoji" style={{ borderColor: meta.color }}>
          {meta.emoji}
        </span>
        <span className="pe-id">
          <span className="pe-name">{event.name}</span>
          <span className="pe-sub">
            {dayLabel(event.date)}
            {done ? ' · booked' : ''}
            {!isSwap(event) && ` · ${result.unitsSold}/${event.qty} sold`}
          </span>
        </span>
        <span className="pe-money">
          <span className={`pe-profit ${result.profit >= 0 ? 'pos' : 'neg'}`}>
            {money(result.profit)}
          </span>
          <span className="pe-flow">
            {money(result.revenue)} in · {money(result.cost)} out
          </span>
        </span>
        <span className="pe-caret">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="pe-body">
          <div className="pe-line">
            <label className="pe-field grow">
              <span className="pf-l">Name</span>
              <input
                value={event.name}
                onChange={(e) => onPatch({ name: e.target.value })}
              />
            </label>
            <label className="pe-field">
              <span className="pf-l">Date</span>
              <input
                type="date"
                value={event.date}
                onChange={(e) => onPatch({ date: e.target.value })}
              />
            </label>
          </div>

          {isSwap(event) ? (
            <>
              <div className="fl-grid two">
                <Mini
                  label="Expected take"
                  value={event.take}
                  step={25}
                  prefix="$"
                  onChange={(take) => onPatch({ take } as Partial<PlanEvent>)}
                />
                <Mini
                  label="Cost to attend"
                  value={event.cost}
                  step={5}
                  prefix="$"
                  onChange={(cost) => onPatch({ cost } as Partial<PlanEvent>)}
                />
              </div>
              <div className="fl-sell">
                <span className="fl-lbl">Crowd</span>
                <div className="fc-chips tight">
                  {CROWD_CHIPS.map((c) => (
                    <button
                      key={c.v}
                      className={`fc-chip sm${event.crowd === c.v ? ' on' : ''}`}
                      onClick={() => onPatch({ crowd: c.v } as Partial<PlanEvent>)}
                    >
                      {c.label} {Math.round(c.v * 100)}%
                    </button>
                  ))}
                </div>
              </div>
              {onBuildBooth && (
                <button className="btn full" onClick={onBuildBooth}>
                  🎪 Build the booth for this show
                </button>
              )}
            </>
          ) : (
            <>
              <div className="fl-grid">
                <Mini
                  label="Make"
                  value={event.qty}
                  step={event.kind === 'tape' ? 5 : 6}
                  onChange={(qty) => onPatch({ qty } as Partial<PlanEvent>)}
                />
                <Mini
                  label="Cost each"
                  value={event.unitCost}
                  step={0.5}
                  prefix="$"
                  onChange={(unitCost) => onPatch({ unitCost } as Partial<PlanEvent>)}
                />
                <Mini
                  label="Sell for"
                  value={event.price}
                  step={1}
                  prefix="$"
                  onChange={(price) => onPatch({ price } as Partial<PlanEvent>)}
                />
              </div>
              <div className="fl-sell">
                <span className="fl-lbl">Expect to sell</span>
                <div className="fc-chips tight">
                  {SELL_CHIPS.map((s) => (
                    <button
                      key={s}
                      className={`fc-chip sm${
                        Math.abs(event.sellThrough - s) < 0.001 ? ' on' : ''
                      }`}
                      onClick={() =>
                        onPatch({ sellThrough: s } as Partial<PlanEvent>)
                      }
                    >
                      {Math.round(s * 100)}%
                    </button>
                  ))}
                </div>
              </div>
              {result.leftover > 0 && (
                <div className="pe-note">
                  {result.leftover} left over — {money(result.leftoverValue)} of stock
                  you've already paid for.
                </div>
              )}

              <SplitEditor
                event={event}
                result={result}
                onChange={(splits) => onPatch({ splits } as Partial<PlanEvent>)}
              />
            </>
          )}

          <div className="pe-status">
            <label className="toggle">
              <input
                type="checkbox"
                checked={done}
                onChange={(e) =>
                  onPatch({
                    status: e.target.checked ? 'done' : 'planned',
                    // Seed the actual with the estimate so it's one edit, not two.
                    actualRevenue: e.target.checked
                      ? Math.round(result.revenue)
                      : null,
                  } as Partial<PlanEvent>)
                }
              />
              <span>
                It happened{' '}
                <span className="muted">— swap the estimate for the real number</span>
              </span>
            </label>
            {done && (
              <Mini
                label="Actually took in"
                value={event.actualRevenue ?? 0}
                step={10}
                prefix="$"
                onChange={(actualRevenue) =>
                  onPatch({ actualRevenue } as Partial<PlanEvent>)
                }
              />
            )}
          </div>

          <label className="pe-field">
            <span className="pf-l">Notes</span>
            <input
              value={event.notes}
              placeholder="Venue, table number, who's coming…"
              onChange={(e) => onPatch({ notes: e.target.value })}
            />
          </label>

          <div className="pe-actions">
            <button className="btn" onClick={onDuplicate}>
              ⧉ Duplicate
            </button>
            <button className="btn danger" onClick={onRemove}>
              🗑 Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Who else gets a cut of this run. You're never a row — whatever the named
 * parties don't take is yours, shown live at the bottom.
 */
function SplitEditor({
  event,
  result,
  onChange,
}: {
  event: MerchEvent;
  result: EventResult;
  onChange: (splits: Split[]) => void;
}) {
  const splits = event.splits;
  const over = result.splitPercent > 100;
  const yourPercent = 100 - result.splitPercent;

  const patch = (id: string, p: Partial<Split>) =>
    onChange(splits.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const add = () =>
    onChange([
      ...splits,
      {
        id: makeSplitId(),
        // First person gets an even split. After that, offer HALF of what's
        // still yours — handing over the whole remainder would silently zero
        // you out just for adding someone to the row.
        name: '',
        percent:
          splits.length === 0 ? 50 : Math.max(0, Math.floor(yourPercent / 2)),
      },
    ]);

  return (
    <div className="pe-splits">
      <div className="ps-head">
        <span className="pf-l">Split</span>
        {splits.length > 0 && (
          <span className={`ps-you${over || result.profit <= 0 ? ' warn' : ''}`}>
            {result.profit <= 0
              ? // The percentage would read as a share of nothing. On a losing
                // run you're carrying the whole thing, so say that instead.
                `You absorb all of it · ${money(result.yourTake)}`
              : `You keep ${round1(yourPercent)}% · ${money(result.yourTake)}`}
          </span>
        )}
      </div>

      {splits.length === 0 ? (
        <button className="ps-add empty" onClick={add}>
          + Split this run with someone
        </button>
      ) : (
        <>
          {splits.map((s) => {
            const share = result.shares.find((x) => x.id === s.id);
            return (
              <div className="ps-row" key={s.id}>
                <input
                  className="ps-name"
                  value={s.name}
                  placeholder="Who?"
                  onChange={(e) => patch(s.id, { name: e.target.value })}
                  aria-label="Name"
                />
                <div className="ps-pct">
                  <button
                    onClick={() => patch(s.id, { percent: clampPct(s.percent - 5) })}
                    aria-label="Less"
                  >
                    −
                  </button>
                  <span className="pv">
                    <input
                      value={s.percent}
                      inputMode="decimal"
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9.]/g, ''));
                        patch(s.id, { percent: clampPct(Number.isFinite(n) ? n : 0) });
                      }}
                      aria-label="Percent"
                    />
                    <span className="pu">%</span>
                  </span>
                  <button
                    onClick={() => patch(s.id, { percent: clampPct(s.percent + 5) })}
                    aria-label="More"
                  >
                    +
                  </button>
                </div>
                <span className="ps-amt">{money(share?.amount ?? 0)}</span>
                <button
                  className="ps-x"
                  onClick={() => onChange(splits.filter((x) => x.id !== s.id))}
                  aria-label="Remove split"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            );
          })}
          <button className="ps-add" onClick={add}>
            + Add someone
          </button>
          {over && (
            <div className="pe-note warn">
              Splits add up to {round1(result.splitPercent)}% — more than there is,
              so your own take goes negative.
            </div>
          )}
          {!over && result.profit <= 0 && (
            <div className="pe-note">
              No profit to split yet, so everyone's cut is $0. A run that loses
              money is yours alone — nobody pays you back.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function Mini({
  label,
  value,
  step,
  prefix = '',
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  prefix?: string;
  onChange: (v: number) => void;
}) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return (
    <div className="fc-mini">
      <span className="ml">{label}</span>
      <div className="mrow">
        <button onClick={() => onChange(Math.max(0, round2(value - step)))}>−</button>
        <span className="mv">
          {prefix && <span className="mpre">{prefix}</span>}
          <input
            value={value}
            inputMode="decimal"
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9.]/g, ''));
              onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
            }}
            aria-label={label}
          />
        </span>
        <button onClick={() => onChange(round2(value + step))}>+</button>
      </div>
    </div>
  );
}
