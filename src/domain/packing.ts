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
