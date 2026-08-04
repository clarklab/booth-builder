// The season plan: a living list of things that make (or cost) money.
//
// Three kinds of event, all sitting in one list:
//   - swap  — a show you set the booth up at. Costs a booth fee + gas, brings
//             in used-tape sales off the tables.
//   - tape  — a custom VHS release. You pay the duplicator for the WHOLE run
//             up front; only the copies that sell pay you back.
//   - shirt — a screen-print order. Same money shape as a tape run.
//
// Events start out `planned` (a projection). Once one has happened you mark it
// `done` and type what you actually took in — from then on the tally counts
// the real number instead of the guess, so the total is part ledger, part
// forecast and always the best figure available.

export type EventKind = 'swap' | 'tape' | 'shirt';
export type EventStatus = 'planned' | 'done';

type EventBase = {
  id: string;
  name: string;
  /** 'YYYY-MM-DD', or '' for something you know is coming but haven't dated. */
  date: string;
  status: EventStatus;
  notes: string;
  /** What actually came in, once it's done. null = still using the estimate. */
  actualRevenue: number | null;
};

export type SwapEvent = EventBase & {
  kind: 'swap';
  /** Booth fee + gas + whatever else it takes to get there. */
  cost: number;
  /** Expected used-tape sales off the tables. */
  take: number;
  /** 0..1 — how much of the display moves. Drives the booth build. */
  crowd: number;
};

export type MerchEvent = EventBase & {
  kind: 'tape' | 'shirt';
  qty: number;
  unitCost: number;
  price: number;
  sellThrough: number;
};

export type PlanEvent = SwapEvent | MerchEvent;

export type PlanDoc = {
  version: 2;
  /** ISO timestamp of the last edit — the tiebreaker when syncing. */
  updatedAt: string;
  events: PlanEvent[];
};

export const KIND_META: Record<
  EventKind,
  { label: string; plural: string; addLabel: string; emoji: string; color: string }
> = {
  swap: {
    label: 'Swap meet',
    plural: 'Swap meets',
    addLabel: 'Add swap meet',
    emoji: '🎪',
    color: '#38bdf8',
  },
  tape: {
    label: 'VHS release',
    plural: 'VHS releases',
    // Spelled out rather than lower-cased from `label` — "vhs" reads wrong.
    addLabel: 'Add VHS release',
    emoji: '📼',
    color: '#a78bfa',
  },
  shirt: {
    label: 'Shirt run',
    plural: 'Shirt runs',
    addLabel: 'Add shirt run',
    emoji: '👕',
    color: '#34d399',
  },
};

export function isSwap(e: PlanEvent): e is SwapEvent {
  return e.kind === 'swap';
}

// ---------- Ids ----------

let counter = 0;
export function makeEventId(): string {
  counter += 1;
  return `e${Date.now().toString(36)}${counter.toString(36)}`;
}

// ---------- Presets ----------

export type Preset = {
  id: string;
  kind: EventKind;
  label: string;
  blurb: string;
  build: (name: string, date: string) => PlanEvent;
};

function swapPreset(
  id: string,
  label: string,
  blurb: string,
  cost: number,
  take: number,
  crowd: number,
): Preset {
  return {
    id,
    kind: 'swap',
    label,
    blurb,
    build: (name, date) => ({
      id: makeEventId(),
      kind: 'swap',
      name,
      date,
      status: 'planned',
      notes: '',
      actualRevenue: null,
      cost,
      take,
      crowd,
    }),
  };
}

function merchPreset(
  id: string,
  kind: 'tape' | 'shirt',
  label: string,
  blurb: string,
  qty: number,
  unitCost: number,
  price: number,
  sellThrough: number,
): Preset {
  return {
    id,
    kind,
    label,
    blurb,
    build: (name, date) => ({
      id: makeEventId(),
      kind,
      name,
      date,
      status: 'planned',
      notes: '',
      actualRevenue: null,
      qty,
      unitCost,
      price,
      sellThrough,
    }),
  };
}

export const PRESETS: Preset[] = [
  swapPreset('swap-small', 'Small swap', 'one table · $100 day', 40, 100, 0.25),
  swapPreset('swap-regular', 'Regular swap', 'the usual monthly · $200 day', 75, 200, 0.25),
  swapPreset('swap-big', 'Big fair', 'record fair / con · $400 day', 150, 400, 0.25),

  merchPreset('tape-short', 'tape', 'Short run', '25 tapes · dubbed at home', 25, 6, 20, 0.8),
  merchPreset('tape-standard', 'tape', 'Standard run', '50 tapes · the usual release', 50, 5, 20, 0.65),
  merchPreset('tape-big', 'tape', 'Big run', '100 tapes · bulk shells', 100, 4, 20, 0.5),

  merchPreset('shirt-test', 'shirt', 'Test batch', '24 shirts · one design', 24, 9, 25, 0.8),
  merchPreset('shirt-standard', 'shirt', 'Standard order', '50 shirts · full size run', 50, 8, 25, 0.65),
  merchPreset('shirt-big', 'shirt', 'Big order', '100 shirts · best unit price', 100, 6.5, 25, 0.5),
];

export function presetsFor(kind: EventKind): Preset[] {
  return PRESETS.filter((p) => p.kind === kind);
}

/** Next untaken "VHS release #3"-style name for a kind. */
export function nextName(events: PlanEvent[], kind: EventKind): string {
  const n = events.filter((e) => e.kind === kind).length + 1;
  if (kind === 'swap') return `Swap meet #${n}`;
  if (kind === 'tape') return `VHS release #${n}`;
  return `Shirt design #${n}`;
}

// ---------- The math ----------

export type EventResult = {
  event: PlanEvent;
  revenue: number;
  cost: number;
  profit: number;
  /** True when the numbers are still an estimate (not a booked actual). */
  estimated: boolean;
  /** Merch only. */
  unitsSold: number;
  leftover: number;
  leftoverValue: number;
};

export function resultFor(event: PlanEvent): EventResult {
  const booked = event.status === 'done' && event.actualRevenue !== null;

  if (isSwap(event)) {
    const revenue = booked ? event.actualRevenue! : event.take;
    return {
      event,
      revenue,
      cost: event.cost,
      profit: revenue - event.cost,
      estimated: !booked,
      unitsSold: 0,
      leftover: 0,
      leftoverValue: 0,
    };
  }

  // A merch run is paid for in full whatever happens, so cost never moves.
  const cost = event.qty * event.unitCost;
  const projectedSold = Math.round(event.qty * event.sellThrough);
  const revenue = booked ? event.actualRevenue! : projectedSold * event.price;
  // Once booked, back out how many units that revenue implies.
  const unitsSold = booked
    ? Math.min(event.qty, event.price > 0 ? Math.round(revenue / event.price) : 0)
    : projectedSold;
  const leftover = Math.max(0, event.qty - unitsSold);

  return {
    event,
    revenue,
    cost,
    profit: revenue - cost,
    estimated: !booked,
    unitsSold,
    leftover,
    leftoverValue: leftover * event.unitCost,
  };
}

export type Bucket = { revenue: number; cost: number; profit: number; count: number };

const emptyBucket = (): Bucket => ({ revenue: 0, cost: 0, profit: 0, count: 0 });

function addTo(b: Bucket, r: EventResult): void {
  b.revenue += r.revenue;
  b.cost += r.cost;
  b.profit += r.profit;
  b.count += 1;
}

export type MonthPoint = {
  key: string; // 'YYYY-MM' or 'undated'
  label: string;
  profit: number;
  cumulative: number;
};

export type PlanTotals = {
  results: EventResult[];
  all: Bucket;
  booked: Bucket;
  planned: Bucket;
  byKind: Record<EventKind, Bucket>;
  unitsMade: number;
  unitsSold: number;
  leftoverValue: number;
  /** Running profit month by month, in date order, undated last. */
  timeline: MonthPoint[];
  /** Soonest dated show still to come — what the booth build is sized for. */
  nextSwap: SwapEvent | null;
};

export function computeTotals(events: PlanEvent[]): PlanTotals {
  const results = events.map(resultFor);

  const all = emptyBucket();
  const booked = emptyBucket();
  const planned = emptyBucket();
  const byKind: Record<EventKind, Bucket> = {
    swap: emptyBucket(),
    tape: emptyBucket(),
    shirt: emptyBucket(),
  };

  let unitsMade = 0;
  let unitsSold = 0;
  let leftoverValue = 0;

  for (const r of results) {
    addTo(all, r);
    addTo(r.estimated ? planned : booked, r);
    addTo(byKind[r.event.kind], r);
    if (!isSwap(r.event)) {
      unitsMade += r.event.qty;
      unitsSold += r.unitsSold;
      leftoverValue += r.leftoverValue;
    }
  }

  // Running tally by month. Undated events land in one bucket at the end so
  // they still count toward the total without pretending to have a slot.
  const byMonth = new Map<string, number>();
  for (const r of results) {
    const key = r.event.date ? r.event.date.slice(0, 7) : 'undated';
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.profit);
  }
  const keys = [...byMonth.keys()].sort((a, b) => {
    if (a === 'undated') return 1;
    if (b === 'undated') return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  let running = 0;
  const timeline: MonthPoint[] = keys.map((key) => {
    const profit = byMonth.get(key)!;
    running += profit;
    return { key, label: monthLabel(key), profit, cumulative: running };
  });

  const upcomingShows = events
    .filter(isSwap)
    .filter((e) => e.status === 'planned' && e.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    results,
    all,
    booked,
    planned,
    byKind,
    unitsMade,
    unitsSold,
    leftoverValue,
    timeline,
    nextSwap: upcomingShows[0] ?? null,
  };
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function monthLabel(key: string): string {
  if (key === 'undated') return 'Undated';
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  return `${MONTHS[idx] ?? m} ${y}`;
}

/** "Sat Mar 14" — short, no year, for the event rows. */
export function dayLabel(date: string): string {
  if (!date) return 'No date yet';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Sort key: dated events first in date order, undated at the end. */
export function sortEvents(events: PlanEvent[]): PlanEvent[] {
  return [...events].sort((a, b) => {
    if (!a.date && !b.date) return a.name.localeCompare(b.name);
    if (!a.date) return 1;
    if (!b.date) return -1;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function groupByMonth(events: PlanEvent[]): { key: string; label: string; events: PlanEvent[] }[] {
  const out: { key: string; label: string; events: PlanEvent[] }[] = [];
  for (const e of sortEvents(events)) {
    const key = e.date ? e.date.slice(0, 7) : 'undated';
    const last = out[out.length - 1];
    if (last && last.key === key) last.events.push(e);
    else out.push({ key, label: monthLabel(key), events: [e] });
  }
  return out;
}

// ---------- Documents ----------

/**
 * The stamp on a doc nobody has edited yet. It has to sort BEFORE any real
 * save: a fresh device starts with an empty doc, and if that were stamped
 * "now" it would look newer than the plan already in the cloud and overwrite
 * it. Epoch means the cloud always wins until the user actually edits.
 */
export const PRISTINE_STAMP = new Date(0).toISOString();

export function emptyDoc(): PlanDoc {
  return { version: 2, updatedAt: PRISTINE_STAMP, events: [] };
}

/** True while this doc is still the untouched default. */
export function isPristine(doc: PlanDoc): boolean {
  return doc.updatedAt === PRISTINE_STAMP;
}

/** New doc with these events and a fresh edit stamp — the sync tiebreaker. */
export function withEvents(events: PlanEvent[]): PlanDoc {
  return { version: 2, updatedAt: new Date().toISOString(), events };
}

/**
 * Coerce anything (old localStorage, a blob written by another version) into a
 * usable doc. Unknown or malformed events are dropped rather than crashing the
 * page — a plan that half-loads beats a white screen.
 */
export function normalizeDoc(raw: unknown): PlanDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.events)) return null;
  const events = o.events
    .map(normalizeEvent)
    .filter((e): e is PlanEvent => e !== null);
  return {
    version: 2,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date(0).toISOString(),
    events,
  };
}

function normalizeEvent(raw: unknown): PlanEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== 'swap' && kind !== 'tape' && kind !== 'shirt') return null;

  const base = {
    id: str(o.id) || makeEventId(),
    name: str(o.name) || 'Untitled',
    date: isDate(o.date) ? (o.date as string) : '',
    status: o.status === 'done' ? ('done' as const) : ('planned' as const),
    notes: str(o.notes),
    actualRevenue: typeof o.actualRevenue === 'number' && Number.isFinite(o.actualRevenue)
      ? o.actualRevenue
      : null,
  };

  if (kind === 'swap') {
    return {
      ...base,
      kind,
      cost: num(o.cost, 75),
      take: num(o.take, 200),
      crowd: clamp01(num(o.crowd, 0.25)) || 0.25,
    };
  }
  return {
    ...base,
    kind,
    qty: Math.max(0, Math.round(num(o.qty, 0))),
    unitCost: Math.max(0, num(o.unitCost, 0)),
    price: Math.max(0, num(o.price, 0)),
    sellThrough: clamp01(num(o.sellThrough, 0.65)),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
function isDate(v: unknown): boolean {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// ---------- Migration from the v1 one-shot wizard ----------

const LEGACY_KEY = 'booth-builder:forecast:v1';

type LegacyPlan = {
  shows?: number;
  costPerShow?: number;
  takePerShow?: number;
  boothSellThrough?: number;
  lines?: {
    kind?: string;
    name?: string;
    qty?: number;
    unitCost?: number;
    price?: number;
    sellThrough?: number;
  }[];
};

/**
 * Turn a saved v1 wizard plan into events: one swap per show it counted, one
 * merch event per line. Dates are left blank — the old model never had them
 * and guessing would put fiction on the calendar.
 */
export function migrateLegacy(): PlanEvent[] {
  let legacy: LegacyPlan;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    legacy = JSON.parse(raw) as LegacyPlan;
  } catch {
    return [];
  }

  const events: PlanEvent[] = [];
  const shows = Math.min(60, Math.max(0, Math.round(num(legacy.shows, 0))));
  const cost = num(legacy.costPerShow, 75);
  const take = num(legacy.takePerShow, 200);
  const crowd = clamp01(num(legacy.boothSellThrough, 0.25)) || 0.25;

  for (let i = 0; i < shows; i++) {
    events.push({
      id: makeEventId(),
      kind: 'swap',
      name: `Swap meet #${i + 1}`,
      date: '',
      status: 'planned',
      notes: '',
      actualRevenue: null,
      cost,
      take,
      crowd,
    });
  }

  for (const line of legacy.lines ?? []) {
    const kind = line.kind === 'shirt' ? 'shirt' : 'tape';
    events.push({
      id: makeEventId(),
      kind,
      name: str(line.name) || (kind === 'tape' ? 'VHS release' : 'Shirt design'),
      date: '',
      status: 'planned',
      notes: '',
      actualRevenue: null,
      qty: Math.max(0, Math.round(num(line.qty, 0))),
      unitCost: Math.max(0, num(line.unitCost, 0)),
      price: Math.max(0, num(line.price, 0)),
      sellThrough: clamp01(num(line.sellThrough, 0.65)),
    });
  }

  return events;
}

export function clearLegacy(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing to do — the migration already produced its events.
  }
}
