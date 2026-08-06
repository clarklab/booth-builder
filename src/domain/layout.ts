import {
  IN_PER_FT,
  MARKED_MIN_PRICE,
  MARKED_MAX_PRICE,
  RACK_LEAN_DEG,
  RACK_ROWS,
  TAPE_BUNDLE_RATE,
  TAPE_SINGLE_PRICE,
  VHS,
  VHS_FACE,
  itemKindById,
  tableAreaSqFt,
  tableTopHeightIn,
  type ItemKind,
} from './constants';
import {
  packRoundTable,
  packTable,
  type Placement,
  type TablePack,
} from './packing';
import type { Layout, PlacedItem } from './types';

export function isTable(item: PlacedItem): boolean {
  return itemKindById(item.kindId).category === 'table';
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

function rectsOverlap(a: Rect, b: Rect, eps = 0): boolean {
  return (
    a.x0 < b.x1 - eps &&
    a.x1 > b.x0 + eps &&
    a.y0 < b.y1 - eps &&
    a.y1 > b.y0 + eps
  );
}

/** Axis-aligned footprint of an item in booth feet (rotation-aware). */
export function itemWorldAABB(item: PlacedItem): Rect {
  const { w, h } = itemFootprintFt(item);
  return {
    x0: item.xFt - w / 2,
    y0: item.yFt - h / 2,
    x1: item.xFt + w / 2,
    y1: item.yFt + h / 2,
  };
}

/** Do two items' footprints overlap? */
export function itemsOverlap(a: PlacedItem, b: PlacedItem): boolean {
  return rectsOverlap(itemWorldAABB(a), itemWorldAABB(b));
}

/**
 * Height (in feet) of the surface a prop rests on: the top of the tallest
 * table it overlaps, or null when it's standing on the ground. A bartop is a
 * foot higher than a folding table, so this can't be a single constant.
 */
export function propSupportHeightFt(prop: PlacedItem, layout: Layout): number | null {
  const pr = itemWorldAABB(prop);
  let top: number | null = null;
  for (const it of layout.items) {
    if (it.uid === prop.uid || !isTable(it)) continue;
    if (!rectsOverlap(pr, itemWorldAABB(it))) continue;
    const hFt = tableTopHeightIn(itemKindById(it.kindId)) / IN_PER_FT;
    if (top === null || hFt > top) top = hFt;
  }
  return top;
}

/** Ground footprint depth of this kind's leaned front rack, in feet. */
export function rackDepthFt(kind: ItemKind): number {
  return (
    (tableTopHeightIn(kind) / IN_PER_FT) * Math.tan((RACK_LEAN_DEG * Math.PI) / 180)
  );
}

/**
 * Transform a world-space (feet) axis-aligned rect into a table's local
 * packing frame, in inches (x along length, y along width). Rotations are
 * multiples of 90°, so the result stays axis-aligned.
 */
function worldRectToTableLocalIn(
  wr: Rect,
  table: PlacedItem,
  Lft: number,
  Wft: number,
): Rect {
  const corners: [number, number][] = [
    [wr.x0, wr.y0],
    [wr.x1, wr.y0],
    [wr.x1, wr.y1],
    [wr.x0, wr.y1],
  ];
  let lx0 = Infinity, ly0 = Infinity, lx1 = -Infinity, ly1 = -Infinity;
  const rot = ((table.rotation % 360) + 360) % 360;
  for (const [px, py] of corners) {
    const dx = px - table.xFt;
    const dy = py - table.yFt;
    let u: number, v: number; // centered feet, u along length, v along width
    if (rot === 0) { u = dx; v = dy; }
    else if (rot === 90) { u = dy; v = -dx; }
    else if (rot === 180) { u = -dx; v = -dy; }
    else { u = -dy; v = dx; }
    const lx = (u + Lft / 2) * IN_PER_FT;
    const ly = (v + Wft / 2) * IN_PER_FT;
    lx0 = Math.min(lx0, lx); lx1 = Math.max(lx1, lx);
    ly0 = Math.min(ly0, ly); ly1 = Math.max(ly1, ly);
  }
  return { x0: lx0, y0: ly0, x1: lx1, y1: ly1 };
}

/**
 * Face-up tape placements on a table's top, with any tapes under a prop
 * (TV, vinyl crate) removed — props sitting on the table displace tapes.
 */
export function tableFlatPlacements(table: PlacedItem, layout: Layout): Placement[] {
  const kind = itemKindById(table.kindId);
  const base = flatPackForTable(table).placements;

  // Center the whole packed block within the table so leftover slack is
  // split evenly instead of all landing on one edge. Offset is derived from
  // the FULL packing, then applied after prop-filtering so holes stay put.
  // A round pack is already centered by the packer, and nudging it would push
  // rim tapes off the edge.
  const Lin = kind.lengthFt * IN_PER_FT;
  const Win = kind.widthFt * IN_PER_FT;
  const off =
    kind.shape === 'round' ? { x: 0, y: 0 } : centerOffset(base, Lin, Win);

  const tableAABB = itemWorldAABB(table);
  const blockers: Rect[] = [];
  for (const it of layout.items) {
    if (it.uid === table.uid || isTable(it)) continue;
    // Only props that rest on a table (TV, vinyl crate) displace tapes;
    // banners hang overhead and chairs sit on the ground.
    const p = itemKindById(it.kindId).prop;
    if (p !== 'tv' && p !== 'vinyl') continue;
    const pr = itemWorldAABB(it);
    if (!rectsOverlap(pr, tableAABB)) continue;
    blockers.push(worldRectToTableLocalIn(pr, table, kind.lengthFt, kind.widthFt));
  }

  const survivors =
    blockers.length === 0
      ? base
      : base.filter(
          (p) =>
            !blockers.some((b) =>
              rectsOverlap({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h }, b, 0.25),
            ),
        );

  if (off.x === 0 && off.y === 0) return survivors;
  return survivors.map((p) => ({ ...p, x: p.x + off.x, y: p.y + off.y }));
}

function centerOffset(placements: Placement[], W: number, H: number): { x: number; y: number } {
  if (placements.length === 0) return { x: 0, y: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of placements) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  }
  return {
    x: (W - (maxX - minX)) / 2 - minX,
    y: (H - (maxY - minY)) / 2 - minY,
  };
}

/**
 * Axis-aligned bounding box of an item in feet after rotation.
 * Exact for 90° rotations; AABB otherwise (we snap to 90°).
 */
export function itemFootprintFt(item: PlacedItem): { w: number; h: number } {
  const kind = itemKindById(item.kindId);
  const rad = (item.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    w: kind.lengthFt * c + kind.widthFt * s,
    h: kind.lengthFt * s + kind.widthFt * c,
  };
}

/**
 * Flat (face-up) VHS pack for a table's top. The pack only depends on the
 * table kind, so it's cached — the forecaster scores dozens of candidate
 * layouts at once and would otherwise re-run the packer for each one.
 */
const packCache = new Map<string, TablePack>();
export function flatPackForTable(item: PlacedItem): TablePack {
  const kind = itemKindById(item.kindId);
  const hit = packCache.get(kind.id);
  if (hit) return hit;
  const pack =
    kind.shape === 'round'
      ? packRoundTable(kind.lengthFt * IN_PER_FT, VHS_FACE.widthIn, VHS_FACE.heightIn)
      : packTable(
          kind.widthFt * IN_PER_FT,
          kind.lengthFt * IN_PER_FT,
          VHS_FACE.widthIn,
          VHS_FACE.heightIn,
        );
  packCache.set(kind.id, pack);
  return pack;
}

/**
 * Which table edge the rack sits on, in the table's local frame:
 *   0 = front (+width), 1 = right (+length), 2 = back (-width), 3 = left (-length).
 * The default faces the tent interior.
 */
export function defaultRackSide(table: PlacedItem, layout: Layout): number {
  let dx = layout.tentFt / 2 - table.xFt;
  let dy = layout.tentFt / 2 - table.yFt;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = 1; // centered → arbitrary
  const rot = ((table.rotation % 360) + 360) % 360;
  let u: number, v: number; // u along length, v along width (local)
  if (rot === 0) { u = dx; v = dy; }
  else if (rot === 90) { u = dy; v = -dx; }
  else if (rot === 180) { u = -dx; v = -dy; }
  else { u = -dy; v = dx; }
  if (Math.abs(v) >= Math.abs(u)) return v >= 0 ? 0 : 2;
  return u >= 0 ? 1 : 3;
}

export function rackSideOf(item: PlacedItem, layout: Layout): number {
  return item.rackSide ?? defaultRackSide(item, layout);
}

/**
 * Front-rack capacity: a leaned board with RACK_ROWS rows. Tapes stand
 * face-out (portrait), so each takes its short side (103mm) along the row.
 * The row length is the length of whichever table edge the rack sits on.
 */
export function rackTapesForTable(item: PlacedItem, layout: Layout): number {
  if (!item.frontRack) return 0;
  const kind = itemKindById(item.kindId);
  if (!kind.supportsRack) return 0;
  const side = rackSideOf(item, layout);
  const onLongEdge = side === 0 || side === 2;
  const edgeLenIn = (onLongEdge ? kind.lengthFt : kind.widthFt) * IN_PER_FT;
  const perRow = Math.floor(edgeLenIn / VHS.shortIn);
  return perRow * RACK_ROWS;
}

export type TableStat = {
  uid: string;
  label: string;
  flat: number;
  rack: number;
  tapes: number; // flat + rack
  asMarked: boolean;
  hasRack: boolean;
};

export type LayoutStats = {
  tableCount: number;
  propCount: number;
  totalTapes: number;
  standardTapes: number; // on non-marked tables
  markedTapes: number; // on "as marked" tables
  usableAreaSqFt: number;
  perTable: TableStat[];
};

export function computeStats(layout: Layout): LayoutStats {
  let totalTapes = 0;
  let standardTapes = 0;
  let markedTapes = 0;
  let area = 0;
  let propCount = 0;
  const perTable: TableStat[] = [];

  for (const item of layout.items) {
    const kind = itemKindById(item.kindId);
    if (kind.category !== 'table') {
      propCount++;
      continue;
    }
    const flat = tableFlatPlacements(item, layout).length;
    const rack = rackTapesForTable(item, layout);
    const tapes = flat + rack;
    totalTapes += tapes;
    if (item.asMarked) markedTapes += tapes;
    else standardTapes += tapes;
    area += tableAreaSqFt(kind);
    perTable.push({
      uid: item.uid,
      label: kind.label,
      flat,
      rack,
      tapes,
      asMarked: !!item.asMarked,
      hasRack: rack > 0,
    });
  }

  return {
    tableCount: perTable.length,
    propCount,
    totalTapes,
    standardTapes,
    markedTapes,
    usableAreaSqFt: area,
    perTable,
  };
}

export type Pricing = {
  typical: number; // realistic gross: bundle rate + marked avg
  low: number;
  high: number;
  standardTypical: number;
  standardHigh: number;
  markedTypical: number;
  markedLow: number;
  markedHigh: number;
};

/** Estimate gross revenue if everything sells. markedAvg is $/tape for the
 *  "as marked" tables (defaults live in constants). */
export function computePricing(stats: LayoutStats, markedAvg: number): Pricing {
  const standardTypical = stats.standardTapes * TAPE_BUNDLE_RATE;
  const standardHigh = stats.standardTapes * TAPE_SINGLE_PRICE;
  const markedTypical = stats.markedTapes * markedAvg;
  const markedLow = stats.markedTapes * MARKED_MIN_PRICE;
  const markedHigh = stats.markedTapes * MARKED_MAX_PRICE;
  return {
    typical: standardTypical + markedTypical,
    low: standardTypical + markedLow,
    high: standardHigh + markedHigh,
    standardTypical,
    standardHigh,
    markedTypical,
    markedLow,
    markedHigh,
  };
}

export function money(n: number): string {
  // Sign goes outside the symbol: -$61, not $-61.
  const r = Math.round(n);
  return (r < 0 ? '-$' : '$') + Math.abs(r).toLocaleString();
}

/** Typical gross for a single table (bundle rate, or marked avg if "as marked"). */
export function tableTypicalPrice(stat: TableStat, markedAvg: number): number {
  return stat.asMarked ? stat.tapes * markedAvg : stat.tapes * TAPE_BUNDLE_RATE;
}
