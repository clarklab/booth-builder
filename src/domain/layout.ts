import { IN_PER_FT, VHS, tableKindById } from './constants';
import { packTable, type TablePack } from './packing';
import type { Layout, TableInstance } from './types';

/**
 * Footprint of a table in feet after rotation, as an axis-aligned bounding
 * box. For 90° rotations this is exact; for other angles it's the AABB
 * (used only for loose bounds/hints, since we snap rotation to 90°).
 */
export function tableFootprintFt(table: TableInstance): { w: number; h: number } {
  const kind = tableKindById(table.kindId);
  const rad = (table.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  // width runs along x at rotation 0; length runs along... we treat length as x.
  const lengthFt = kind.lengthFt;
  const widthFt = kind.widthFt;
  return {
    w: lengthFt * c + widthFt * s,
    h: lengthFt * s + widthFt * c,
  };
}

/** VHS pack for a given table kind (independent of rotation/position). */
export function tapesForTable(table: TableInstance): TablePack {
  const kind = tableKindById(table.kindId);
  return packTable(
    kind.widthFt * IN_PER_FT,
    kind.lengthFt * IN_PER_FT,
    VHS.widthIn,
    VHS.heightIn,
  );
}

export type LayoutStats = {
  tableCount: number;
  totalTapes: number;
  usableAreaSqFt: number;
  perTable: { uid: string; label: string; tapes: number }[];
};

export function computeStats(layout: Layout): LayoutStats {
  let totalTapes = 0;
  let area = 0;
  const perTable = layout.tables.map((t) => {
    const kind = tableKindById(t.kindId);
    const pack = tapesForTable(t);
    totalTapes += pack.count;
    area += kind.widthFt * kind.lengthFt;
    return { uid: t.uid, label: kind.label, tapes: pack.count };
  });
  return {
    tableCount: layout.tables.length,
    totalTapes,
    usableAreaSqFt: area,
    perTable,
  };
}
