import {
  IN_PER_FT,
  MARKED_MIN_PRICE,
  MARKED_MAX_PRICE,
  RACK_ROWS,
  TAPE_BUNDLE_RATE,
  TAPE_SINGLE_PRICE,
  VHS,
  VHS_FACE,
  itemKindById,
} from './constants';
import { packTable, type TablePack } from './packing';
import type { Layout, PlacedItem } from './types';

export function isTable(item: PlacedItem): boolean {
  return itemKindById(item.kindId).category === 'table';
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

/** Flat (face-up) VHS pack for a table's top. */
export function flatPackForTable(item: PlacedItem): TablePack {
  const kind = itemKindById(item.kindId);
  return packTable(
    kind.widthFt * IN_PER_FT,
    kind.lengthFt * IN_PER_FT,
    VHS_FACE.widthIn,
    VHS_FACE.heightIn,
  );
}

/**
 * Front-rack capacity: a leaned board with RACK_ROWS rows. Tapes stand
 * face-out (portrait), so each takes its short side (103mm) along the row,
 * and the row length is the table's long (front) edge.
 */
export function rackTapesForTable(item: PlacedItem): number {
  if (!item.frontRack) return 0;
  const kind = itemKindById(item.kindId);
  const rowLenIn = kind.lengthFt * IN_PER_FT;
  const perRow = Math.floor(rowLenIn / VHS.shortIn);
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
    const flat = flatPackForTable(item).count;
    const rack = rackTapesForTable(item);
    const tapes = flat + rack;
    totalTapes += tapes;
    if (item.asMarked) markedTapes += tapes;
    else standardTapes += tapes;
    area += kind.widthFt * kind.lengthFt;
    perTable.push({
      uid: item.uid,
      label: kind.label,
      flat,
      rack,
      tapes,
      asMarked: !!item.asMarked,
      hasRack: !!item.frontRack,
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
  return '$' + Math.round(n).toLocaleString();
}
