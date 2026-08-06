// Mosaic packing of identical rectangles (VHS tapes, face up) onto a
// rectangular table top. Both orientations are allowed. The algorithm
// returns concrete placements so the count and the 3D render stay in sync.

export type Placement = {
  x: number; // inches, top-left corner within the table (long axis = x)
  y: number; // inches
  w: number; // placed footprint width (inches)
  h: number; // placed footprint height (inches)
  rotated: boolean;
};

const EPS = 1e-6;

/**
 * Pack a W x H area with w x h items, rotation allowed.
 *
 * Strategy: for each orientation, fill a full grid block in one corner,
 * then recurse into the two leftover strips (an L-shaped remainder). We
 * try both ways of splitting the L and keep whichever packs more. Item
 * sizes are large relative to the table, so leftover strips shrink below
 * one item within a level or two and recursion terminates quickly. A depth
 * cap guards against pathological inputs.
 */
export function packRect(
  W: number,
  H: number,
  w: number,
  h: number,
  depth = 0,
): Placement[] {
  if (W < Math.min(w, h) - EPS || H < Math.min(w, h) - EPS) return [];
  if (depth > 6) return gridFill(W, H, w, h);

  let best: Placement[] = [];

  for (const [pw, ph, rotated] of [
    [w, h, false],
    [h, w, true],
  ] as const) {
    if (pw > W + EPS || ph > H + EPS) continue;

    const nx = Math.floor((W + EPS) / pw);
    const ny = Math.floor((H + EPS) / ph);
    if (nx < 1 || ny < 1) continue;

    const block: Placement[] = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        block.push({ x: i * pw, y: j * ph, w: pw, h: ph, rotated });
      }
    }

    const usedW = nx * pw;
    const usedH = ny * ph;
    const rightW = W - usedW;
    const topH = H - usedH;

    // Split A: right strip spans full height; top strip spans used width.
    const a = [
      ...block,
      ...offset(packRect(rightW, H, w, h, depth + 1), usedW, 0),
      ...offset(packRect(usedW, topH, w, h, depth + 1), 0, usedH),
    ];

    // Split B: right strip spans used height; top strip spans full width.
    const b = [
      ...block,
      ...offset(packRect(rightW, usedH, w, h, depth + 1), usedW, 0),
      ...offset(packRect(W, topH, w, h, depth + 1), 0, usedH),
    ];

    const better = a.length >= b.length ? a : b;
    if (better.length > best.length) best = better;
  }

  return best;
}

function offset(list: Placement[], dx: number, dy: number): Placement[] {
  if (dx === 0 && dy === 0) return list;
  return list.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
}

/** Simple single-orientation grid fill (recursion base fallback). */
function gridFill(W: number, H: number, w: number, h: number): Placement[] {
  const optionsWithCounts = [
    { pw: w, ph: h, rotated: false },
    { pw: h, ph: w, rotated: true },
  ].map((o) => ({
    ...o,
    count: Math.floor((W + EPS) / o.pw) * Math.floor((H + EPS) / o.ph),
  }));
  const opt = optionsWithCounts[0].count >= optionsWithCounts[1].count
    ? optionsWithCounts[0]
    : optionsWithCounts[1];
  const nx = Math.floor((W + EPS) / opt.pw);
  const ny = Math.floor((H + EPS) / opt.ph);
  const out: Placement[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      out.push({ x: i * opt.pw, y: j * opt.ph, w: opt.pw, h: opt.ph, rotated: opt.rotated });
  return out;
}

/**
 * Pack a circle of diameter D with w x h items, rotation allowed. Coordinates
 * are in the circle's bounding box, so a round top drops into the same local
 * frame as a rectangular one.
 *
 * Rows, not a grid: stack rows of one item-height and center each row on its
 * own chord. A row of chord length c holds at most floor(c / itemWidth) items
 * and centering always reaches that, so this beats any rigid grid — a grid
 * forces every row onto the same x-phase and loses items at the rim. Both
 * orientations are tried, and the whole stack is slid through the vertical
 * slack the circle leaves over it.
 */
export function packCircle(D: number, w: number, h: number): Placement[] {
  const r = D / 2;
  const PHASES = 16;
  let best: Placement[] = [];
  let bestOff = Infinity;

  for (const [pw, ph, rotated] of [
    [w, h, false],
    [h, w, true],
  ] as const) {
    const rows = Math.floor((D + EPS) / ph);
    if (rows < 1 || pw > D + EPS) continue;
    const slack = D - rows * ph;

    for (let i = 0; i <= PHASES; i++) {
      const y0 = (slack * i) / PHASES;
      const out: Placement[] = [];
      for (let j = 0; j < rows; j++) {
        const yTop = y0 + j * ph;
        // A row is only as wide as the circle at whichever of its two edges
        // sits farther from the center.
        const dy = Math.max(Math.abs(yTop - r), Math.abs(yTop + ph - r));
        const half = Math.sqrt(Math.max(0, r * r - dy * dy));
        const n = Math.floor((2 * half + EPS) / pw);
        const x0 = r - (n * pw) / 2;
        for (let k = 0; k < n; k++)
          out.push({ x: x0 + k * pw, y: yTop, w: pw, h: ph, rotated });
      }
      if (out.length === 0) continue;
      const off = packOffCenter(out, r);
      if (out.length > best.length || (out.length === best.length && off < bestOff)) {
        best = out;
        bestOff = off;
      }
    }
  }

  return best;
}

/** How far the pack's bounding box sits off the circle's center. */
function packOffCenter(list: Placement[], r: number): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of list) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  }
  return Math.hypot((minX + maxX) / 2 - r, (minY + maxY) / 2 - r);
}

export type TablePack = {
  placements: Placement[];
  count: number;
};

/** Cache packs by table dimensions — the layout only has a few distinct sizes. */
const packCache = new Map<string, TablePack>();

export function packTable(
  tableWidthIn: number,
  tableLengthIn: number,
  itemW: number,
  itemH: number,
): TablePack {
  // Normalize so the long side is the packing width (x axis).
  const W = Math.max(tableWidthIn, tableLengthIn);
  const H = Math.min(tableWidthIn, tableLengthIn);
  const key = `${W.toFixed(3)}x${H.toFixed(3)}:${itemW.toFixed(3)}x${itemH.toFixed(3)}`;
  const cached = packCache.get(key);
  if (cached) return cached;
  const placements = packRect(W, H, itemW, itemH);
  const pack = { placements, count: placements.length };
  packCache.set(key, pack);
  return pack;
}

export function packRoundTable(
  diameterIn: number,
  itemW: number,
  itemH: number,
): TablePack {
  const key = `round${diameterIn.toFixed(3)}:${itemW.toFixed(3)}x${itemH.toFixed(3)}`;
  const cached = packCache.get(key);
  if (cached) return cached;
  const placements = packCircle(diameterIn, itemW, itemH);
  const pack = { placements, count: placements.length };
  packCache.set(key, pack);
  return pack;
}
