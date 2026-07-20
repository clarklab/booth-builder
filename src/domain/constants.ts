// All internal measurements are in INCHES for precision.
// Display is usually in feet. 1 ft = 12 in.

export const IN_PER_FT = 12;
export const MM_PER_IN = 25.4;

/**
 * Standard VHS cassette dimensions.
 * The physical spec is ~187mm x 103mm x 25mm (W x H x thickness).
 * We lay tapes FACE UP (flat on their back), so the footprint on the
 * table is the large face: 187mm x 103mm. Thickness only matters in 3D.
 */
export const VHS = {
  widthIn: 187 / MM_PER_IN, // ~7.362"
  heightIn: 103 / MM_PER_IN, // ~4.055"
  thicknessIn: 25 / MM_PER_IN, // ~0.984"
};

/** Available pop-up tent (canopy) footprints, in feet. */
export const TENT_SIZES = [8, 10, 12] as const;
export type TentSize = (typeof TENT_SIZES)[number];

/** Standard folding-table top height off the ground, in inches. */
export const TABLE_TOP_HEIGHT_IN = 29;
export const TABLE_TOP_THICKNESS_IN = 1.5;

/** Canopy tent heights, in feet (classic EZ-up style). */
export const TENT_EAVE_FT = 6.6; // where the roof meets the legs
export const TENT_PEAK_FT = 9.2; // center peak

export type TableKind = {
  id: string;
  label: string;
  // Nominal size in feet (how people describe them).
  widthFt: number;
  lengthFt: number;
  color: string;
};

/** Table catalog. Sizes are in feet (width x length). */
export const TABLE_KINDS: TableKind[] = [
  { id: '2x4', label: `2' × 4'`, widthFt: 2, lengthFt: 4, color: '#f59e0b' },
  { id: '2x6', label: `2' × 6'`, widthFt: 2, lengthFt: 6, color: '#38bdf8' },
  { id: '3x6', label: `3' × 6'`, widthFt: 3, lengthFt: 6, color: '#a78bfa' },
];

export function tableKindById(id: string): TableKind {
  return TABLE_KINDS.find((t) => t.id === id) ?? TABLE_KINDS[0];
}
