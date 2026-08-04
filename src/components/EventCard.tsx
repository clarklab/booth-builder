import { money } from '../domain/layout';
import {
  KIND_META,
  dayLabel,
  isSwap,
  type EventResult,
  type PlanEvent,
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
