import { useMemo, useState } from 'react';
import { buildBoothForTarget, type BoothBuild } from '../domain/autoLayout';
import { money } from '../domain/layout';
import {
  KIND_META,
  computeTotals,
  groupByMonth,
  isSwap,
  nextName,
  presetsFor,
  type EventKind,
  type PlanEvent,
  type PlanTotals,
} from '../domain/plan';
import type { SyncState } from '../domain/planStore';
import { usePlan } from '../usePlan';
import { EventCard } from './EventCard';

type Props = {
  onHome: () => void;
  onBuildBooth: (build: BoothBuild) => void;
};

type Filter = 'all' | 'upcoming' | 'booked' | EventKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'upcoming', label: 'Still to come' },
  { id: 'booked', label: 'Booked' },
  { id: 'swap', label: '🎪 Swaps' },
  { id: 'tape', label: '📼 Tapes' },
  { id: 'shirt', label: '👕 Shirts' },
];

export function Forecaster({ onHome, onBuildBooth }: Props) {
  const { doc, sync, setEvents, unlock, retry } = usePlan();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<EventKind | null>(null);
  const [tokenDraft, setTokenDraft] = useState('');

  const totals = useMemo(() => computeTotals(doc.events), [doc.events]);

  const visible = useMemo(() => {
    if (filter === 'all') return doc.events;
    if (filter === 'upcoming') return doc.events.filter((e) => e.status === 'planned');
    if (filter === 'booked') return doc.events.filter((e) => e.status === 'done');
    return doc.events.filter((e) => e.kind === filter);
  }, [doc.events, filter]);

  const groups = useMemo(() => groupByMonth(visible), [visible]);

  const addFromPreset = (kind: EventKind, presetId: string) => {
    const preset = presetsFor(kind).find((p) => p.id === presetId);
    if (!preset) return;
    const event = preset.build(nextName(doc.events, kind), '');
    setEvents((all) => [...all, event]);
    setAdding(null);
    setOpenId(event.id);
    // A brand-new event has no date yet, so make sure it isn't filtered away.
    if (filter === 'booked' || (filter !== 'all' && filter !== 'upcoming' && filter !== kind)) {
      setFilter('all');
    }
  };

  const patch = (id: string, p: Partial<PlanEvent>) =>
    setEvents((all) =>
      all.map((e) => (e.id === id ? ({ ...e, ...p } as PlanEvent) : e)),
    );

  const remove = (id: string) => {
    setEvents((all) => all.filter((e) => e.id !== id));
    if (openId === id) setOpenId(null);
  };

  const duplicate = (id: string) => {
    const src = doc.events.find((e) => e.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: `${src.id}c${Date.now().toString(36)}`,
      name: `${src.name} (copy)`,
      status: 'planned' as const,
      actualRevenue: null,
    };
    setEvents((all) => [...all, copy]);
    setOpenId(copy.id);
  };

  const boothTarget = useMemo(() => targetFor(totals), [totals]);
  const build = useMemo(
    () => buildBoothForTarget(boothTarget.take, boothTarget.crowd),
    [boothTarget],
  );

  return (
    <div className="fc">
      <header className="header">
        <button className="btn ghost back" onClick={onHome}>
          ← Home
        </button>
        <span className="logo">📈</span>
        <h1>Forecaster</h1>
        <span className="tag">season planner</span>
        <div className="spacer" />
        <SyncBadge sync={sync} onRetry={retry} />
        <span className="badge">
          <strong>{money(totals.all.profit)}</strong> projected
        </span>
      </header>

      {sync === 'locked' && (
        <div className="pl-lock">
          <span>🔒 This planner is password-protected.</span>
          <input
            type="password"
            placeholder="Passphrase"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && unlock(tokenDraft)}
          />
          <button className="btn primary" onClick={() => unlock(tokenDraft)}>
            Unlock
          </button>
          <span className="muted">Until then, edits stay on this device.</span>
        </div>
      )}

      <div className="pl-main">
        <div className="pl-list">
          <div className="pl-add">
            {(Object.keys(KIND_META) as EventKind[]).map((kind) => (
              <div className="pl-add-slot" key={kind}>
                <button
                  className={`pl-add-btn${adding === kind ? ' on' : ''}`}
                  onClick={() => setAdding(adding === kind ? null : kind)}
                >
                  <span className="e">{KIND_META[kind].emoji}</span>
                  <span className="t">{KIND_META[kind].addLabel}</span>
                  <span className="c">{adding === kind ? '✕' : '+'}</span>
                </button>
                {adding === kind && (
                  <div className="pl-presets">
                    {presetsFor(kind).map((p) => (
                      <button
                        key={p.id}
                        className="pl-preset"
                        onClick={() => addFromPreset(kind, p.id)}
                      >
                        <span className="pl">{p.label}</span>
                        <span className="pb">{p.blurb}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pl-filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`fc-chip sm${filter === f.id ? ' on' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {doc.events.length === 0 ? (
            <div className="fc-empty">
              <span className="e">🗓️</span>
              Nothing on the calendar yet. Add a swap meet, a VHS release, or a
              shirt run above — the tally builds itself as you go, and everything
              saves to the cloud so it's here next time.
            </div>
          ) : visible.length === 0 ? (
            <div className="fc-empty">
              <span className="e">🔍</span>
              Nothing matches that filter.
            </div>
          ) : (
            groups.map((group) => (
              <section className="pl-group" key={group.key}>
                <h3 className="pl-month">
                  <span>{group.label}</span>
                  <span className="pm-sum">
                    {money(
                      group.events.reduce(
                        (a, e) =>
                          a + (totals.results.find((r) => r.event.id === e.id)?.profit ?? 0),
                        0,
                      ),
                    )}
                  </span>
                </h3>
                {group.events.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    result={totals.results.find((r) => r.event.id === e.id)!}
                    open={openId === e.id}
                    onToggle={() => setOpenId(openId === e.id ? null : e.id)}
                    onPatch={(p) => patch(e.id, p)}
                    onRemove={() => remove(e.id)}
                    onDuplicate={() => duplicate(e.id)}
                    onBuildBooth={
                      isSwap(e)
                        ? () => onBuildBooth(buildBoothForTarget(e.take, e.crowd))
                        : undefined
                    }
                  />
                ))}
              </section>
            ))
          )}
        </div>

        <TotalsRail
          totals={totals}
          build={build}
          target={boothTarget}
          onBuildBooth={() => onBuildBooth(build)}
        />
      </div>
    </div>
  );
}

// ---------- Totals rail ----------

function TotalsRail({
  totals,
  build,
  target,
  onBuildBooth,
}: {
  totals: PlanTotals;
  build: BoothBuild;
  target: { take: number; crowd: number; label: string };
  onBuildBooth: () => void;
}) {
  const kinds = (Object.keys(KIND_META) as EventKind[]).filter(
    (k) => totals.byKind[k].count > 0,
  );
  const peak = Math.max(1, ...totals.timeline.map((t) => Math.abs(t.cumulative)));

  return (
    <aside className="pl-rail">
      <div className="fc-hero">
        <div className="fh-lbl">Running tally</div>
        <div className={`fh-num${totals.all.profit >= 0 ? '' : ' neg'}`}>
          {money(totals.all.profit)}
        </div>
        <div className="fh-sub">
          {money(totals.all.revenue)} in · {money(totals.all.cost)} out ·{' '}
          {totals.all.count} event{totals.all.count === 1 ? '' : 's'}
        </div>
        {totals.partners.length > 0 && (
          <div className="fh-yours">
            <strong>{money(totals.yourTake)}</strong> yours after splits
          </div>
        )}
      </div>

      <div className="pl-split">
        <div className="pl-split-cell booked">
          <div className="n">{money(totals.booked.profit)}</div>
          <div className="l">booked · {totals.booked.count}</div>
        </div>
        <div className="pl-split-cell planned">
          <div className="n">{money(totals.planned.profit)}</div>
          <div className="l">still projected · {totals.planned.count}</div>
        </div>
      </div>

      {kinds.length > 0 && (
        <div className="pl-card">
          <h4>Where it comes from</h4>
          <div className="fc-bars">
            {kinds.map((k) => {
              const b = totals.byKind[k];
              const scale = Math.max(
                1,
                ...kinds.map((kk) => Math.abs(totals.byKind[kk].profit)),
              );
              return (
                <div className={`fc-bar ${b.profit < 0 ? 'out' : 'in'}`} key={k}>
                  <span className="bl">
                    {KIND_META[k].emoji} {KIND_META[k].plural} · {b.count}
                  </span>
                  <span className="bt">
                    <span style={{ width: `${(Math.abs(b.profit) / scale) * 100}%` }} />
                  </span>
                  <span className="bv">{money(b.profit)}</span>
                </div>
              );
            })}
          </div>
          {totals.unitsMade > 0 && (
            <div className="pl-foot">
              {totals.unitsSold.toLocaleString()} of{' '}
              {totals.unitsMade.toLocaleString()} units move ·{' '}
              {money(totals.leftoverValue)} left in stock
            </div>
          )}
        </div>
      )}

      {totals.partners.length > 0 && (
        <div className="pl-card">
          <h4>Splits</h4>
          <div className="pl-partners">
            {totals.partners.map((p) => (
              <div className="pl-partner" key={p.key}>
                <span className="pn">{p.name}</span>
                <span className="pe">
                  {p.events} run{p.events === 1 ? '' : 's'}
                </span>
                <span className="pa">{money(p.amount)}</span>
              </div>
            ))}
            <div className="pl-partner you">
              <span className="pn">You</span>
              <span className="pe">everything else</span>
              <span className="pa">{money(totals.yourTake)}</span>
            </div>
          </div>
          <div className="pl-foot">
            {money(totals.splitOut)} of {money(totals.all.profit)} goes to other
            people. Losses aren't shared.
          </div>
        </div>
      )}

      {totals.timeline.length > 1 && (
        <div className="pl-card">
          <h4>Month by month</h4>
          <div className="pl-timeline">
            {totals.timeline.map((t) => (
              <div className="pl-tl-row" key={t.key}>
                <span className="tl">{t.label}</span>
                <span className="tb">
                  <span
                    className={t.cumulative >= 0 ? 'pos' : 'neg'}
                    style={{ width: `${(Math.abs(t.cumulative) / peak) * 100}%` }}
                  />
                </span>
                <span className="tv">{money(t.cumulative)}</span>
              </div>
            ))}
          </div>
          <div className="pl-foot">Running profit, cumulative.</div>
        </div>
      )}

      <div className="fc-cta">
        <div className="cta-h">Build the booth</div>
        <div className="cta-b">
          {target.label} — <strong>{money(target.take)}</strong> a show at{' '}
          {Math.round(target.crowd * 100)}% sell-through needs about{' '}
          <strong>{build.totalTapes.toLocaleString()} tapes</strong> on display.
          {!build.meetsTarget && (
            <span className="warn">
              {' '}
              A maxed-out 12′ canopy lands nearer {money(build.expectedTake)} — worth
              a second look at that number.
            </span>
          )}
        </div>
        <div className="cta-stats">
          <span>
            {build.tentFt}′ × {build.tentFt}′ tent
          </span>
          <span>{build.tableCount} tables</span>
          {build.rackCount > 0 && <span>{build.rackCount} front racks</span>}
          {build.markedCount > 0 && <span>{build.markedCount} “as marked”</span>}
        </div>
        <button className="btn primary big" onClick={onBuildBooth}>
          🎪 Open in the Builder →
        </button>
      </div>
    </aside>
  );
}

/** Which show the rail's booth build should be sized for. */
function targetFor(totals: PlanTotals): { take: number; crowd: number; label: string } {
  const next = totals.nextSwap;
  if (next) {
    return { take: next.take, crowd: next.crowd, label: `Next up: ${next.name}` };
  }
  // No dated show coming — size for the biggest one still on the books.
  const swaps = totals.results
    .map((r) => r.event)
    .filter(isSwap)
    .filter((e) => e.status === 'planned');
  if (swaps.length > 0) {
    const biggest = swaps.reduce((a, b) => (b.take > a.take ? b : a));
    return { take: biggest.take, crowd: biggest.crowd, label: `Biggest show: ${biggest.name}` };
  }
  return { take: 200, crowd: 0.25, label: 'No shows booked — sizing for a typical day' };
}

// ---------- Sync badge ----------

const SYNC_COPY: Record<SyncState, { dot: string; text: string }> = {
  idle: { dot: 'idle', text: '' },
  loading: { dot: 'busy', text: 'Loading…' },
  saving: { dot: 'busy', text: 'Saving…' },
  synced: { dot: 'ok', text: 'Saved to cloud' },
  local: { dot: 'warn', text: 'On this device' },
  locked: { dot: 'warn', text: 'Locked' },
  error: { dot: 'bad', text: 'Sync failed' },
};

function SyncBadge({ sync, onRetry }: { sync: SyncState; onRetry: () => void }) {
  const copy = SYNC_COPY[sync];
  if (!copy.text) return null;
  const retryable = sync === 'local' || sync === 'error';
  return (
    <button
      className={`pl-sync ${copy.dot}`}
      onClick={retryable ? onRetry : undefined}
      title={
        retryable
          ? 'Saved here, but not to the cloud. Click to try again.'
          : 'Your plan syncs to Netlify Blobs.'
      }
      disabled={!retryable}
    >
      <span className="dot" />
      <span className="t">{copy.text}</span>
    </button>
  );
}
