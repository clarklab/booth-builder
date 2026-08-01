// Year-ahead forecasting for a VHS booth operation: swap-meet shows plus
// self-released merch (custom tapes, T-shirts).
//
// Money model, deliberately simple so the wizard stays tap-and-go:
//   - A show brings in `takePerShow` from the used-tape booth and costs
//     `costPerShow` (booth fee + gas).
//   - A merch run costs `unitCost x qty` UP FRONT (you pay the duplicator or
//     the screen printer for the whole run), and earns `price` on each unit
//     that actually sells. Unsold units are inventory, valued at cost.

export type MerchKind = 'tape' | 'shirt';

export type MerchLine = {
  uid: string;
  kind: MerchKind;
  name: string;
  qty: number; // units produced for the year
  unitCost: number; // $ to make one
  price: number; // $ you sell it for
  sellThrough: number; // 0..1, fraction of the run you expect to move
};

export type Plan = {
  shows: number;
  costPerShow: number; // booth fee + gas, per show
  takePerShow: number; // used-tape sales per show (drives the booth build)
  boothSellThrough: number; // how much of the display moves at a show
  lines: MerchLine[];
};

export type LineResult = MerchLine & {
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
  marginEach: number;
  leftover: number;
  leftoverValue: number;
};

export type ForecastResult = {
  lines: LineResult[];
  tapeLines: LineResult[];
  shirtLines: LineResult[];
  boothRevenue: number;
  merchRevenue: number;
  grossRevenue: number;
  merchCost: number;
  showCost: number;
  totalCost: number;
  netProfit: number;
  perShowGross: number;
  perShowNet: number;
  unitsMade: number;
  unitsSold: number;
  leftoverValue: number;
  /** Shows needed before the year's spend is paid back (null if never). */
  breakEvenShows: number | null;
  marginPct: number;
};

// ---------- Presets (the tap-to-add buttons) ----------

export type MerchPreset = {
  id: string;
  kind: MerchKind;
  label: string;
  blurb: string;
  qty: number;
  unitCost: number;
  price: number;
  sellThrough: number;
};

export const TAPE_PRESETS: MerchPreset[] = [
  {
    id: 'tape-short',
    kind: 'tape',
    label: 'Short run',
    blurb: '25 tapes · dubbed at home',
    qty: 25,
    unitCost: 6,
    price: 20,
    sellThrough: 0.8,
  },
  {
    id: 'tape-standard',
    kind: 'tape',
    label: 'Standard run',
    blurb: '50 tapes · the usual release',
    qty: 50,
    unitCost: 5,
    price: 20,
    sellThrough: 0.65,
  },
  {
    id: 'tape-big',
    kind: 'tape',
    label: 'Big run',
    blurb: '100 tapes · bulk shells + slipcases',
    qty: 100,
    unitCost: 4,
    price: 20,
    sellThrough: 0.5,
  },
];

export const SHIRT_PRESETS: MerchPreset[] = [
  {
    id: 'shirt-test',
    kind: 'shirt',
    label: 'Test batch',
    blurb: '24 shirts · one design, one color',
    qty: 24,
    unitCost: 9,
    price: 25,
    sellThrough: 0.8,
  },
  {
    id: 'shirt-standard',
    kind: 'shirt',
    label: 'Standard order',
    blurb: '50 shirts · full size run',
    qty: 50,
    unitCost: 8,
    price: 25,
    sellThrough: 0.65,
  },
  {
    id: 'shirt-big',
    kind: 'shirt',
    label: 'Big order',
    blurb: '100 shirts · best per-unit price',
    qty: 100,
    unitCost: 6.5,
    price: 25,
    sellThrough: 0.5,
  },
];

let lineCounter = 0;
export function makeLineUid(): string {
  lineCounter += 1;
  return `m${Date.now().toString(36)}${lineCounter}`;
}

export function lineFromPreset(preset: MerchPreset, index: number): MerchLine {
  return {
    uid: makeLineUid(),
    kind: preset.kind,
    name:
      preset.kind === 'tape' ? `VHS release #${index + 1}` : `Shirt design #${index + 1}`,
    qty: preset.qty,
    unitCost: preset.unitCost,
    price: preset.price,
    sellThrough: preset.sellThrough,
  };
}

// ---------- The math ----------

export function defaultPlan(): Plan {
  return {
    shows: 12,
    costPerShow: 75,
    takePerShow: 200,
    boothSellThrough: 0.25,
    lines: [],
  };
}

function resultForLine(line: MerchLine): LineResult {
  const unitsSold = Math.round(line.qty * line.sellThrough);
  const revenue = unitsSold * line.price;
  const cost = line.qty * line.unitCost;
  const leftover = line.qty - unitsSold;
  return {
    ...line,
    unitsSold,
    revenue,
    cost,
    profit: revenue - cost,
    marginEach: line.price - line.unitCost,
    leftover,
    leftoverValue: leftover * line.unitCost,
  };
}

export function computeForecast(plan: Plan): ForecastResult {
  const lines = plan.lines.map(resultForLine);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const boothRevenue = plan.shows * plan.takePerShow;
  const merchRevenue = sum(lines.map((l) => l.revenue));
  const merchCost = sum(lines.map((l) => l.cost));
  const showCost = plan.shows * plan.costPerShow;
  const grossRevenue = boothRevenue + merchRevenue;
  const totalCost = merchCost + showCost;
  const netProfit = grossRevenue - totalCost;
  const perShowGross = plan.shows > 0 ? grossRevenue / plan.shows : 0;

  // Merch is paid for up front, so break-even is "how many shows until the
  // year's gross covers the year's spend".
  const breakEvenShows =
    perShowGross > 0 ? Math.ceil(totalCost / perShowGross) : null;

  return {
    lines,
    tapeLines: lines.filter((l) => l.kind === 'tape'),
    shirtLines: lines.filter((l) => l.kind === 'shirt'),
    boothRevenue,
    merchRevenue,
    grossRevenue,
    merchCost,
    showCost,
    totalCost,
    netProfit,
    perShowGross,
    perShowNet: plan.shows > 0 ? netProfit / plan.shows : 0,
    unitsMade: sum(lines.map((l) => l.qty)),
    unitsSold: sum(lines.map((l) => l.unitsSold)),
    leftoverValue: sum(lines.map((l) => l.leftoverValue)),
    breakEvenShows:
      breakEvenShows !== null && breakEvenShows > plan.shows ? null : breakEvenShows,
    marginPct: grossRevenue > 0 ? netProfit / grossRevenue : 0,
  };
}

// ---------- Storage ----------

export const FORECAST_KEY = 'booth-builder:forecast:v1';

export function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(FORECAST_KEY);
    if (!raw) return defaultPlan();
    const parsed = JSON.parse(raw) as Partial<Plan>;
    const base = defaultPlan();
    return {
      shows: numOr(parsed.shows, base.shows),
      costPerShow: numOr(parsed.costPerShow, base.costPerShow),
      takePerShow: numOr(parsed.takePerShow, base.takePerShow),
      boothSellThrough: numOr(parsed.boothSellThrough, base.boothSellThrough),
      lines: Array.isArray(parsed.lines) ? (parsed.lines as MerchLine[]) : [],
    };
  } catch {
    return defaultPlan();
  }
}

export function savePlan(plan: Plan): void {
  try {
    localStorage.setItem(FORECAST_KEY, JSON.stringify(plan));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
