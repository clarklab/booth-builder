// All internal measurements are in INCHES for precision.
// Display is usually in feet. 1 ft = 12 in.

export const IN_PER_FT = 12;
export const MM_PER_IN = 25.4;

/**
 * Standard VHS cassette dimensions.
 * The physical spec is ~187mm x 103mm x 25mm (long x short x thickness).
 *
 * - FLAT on the table (face up, on its back): footprint = 187 x 103 mm.
 * - STANDING on a shelf, face-out (Blockbuster style): the sleeve stands
 *   portrait, so along a row each tape takes its short side (103mm) and
 *   stands 187mm tall.
 */
export const VHS = {
  longIn: 187 / MM_PER_IN, // ~7.362"
  shortIn: 103 / MM_PER_IN, // ~4.055"
  thicknessIn: 25 / MM_PER_IN, // ~0.984"
};
// Back-compat aliases used by the flat-packing math (face up).
export const VHS_FACE = {
  widthIn: VHS.longIn,
  heightIn: VHS.shortIn,
};

/** Front rack: a leaned plywood board with this many display rows. */
export const RACK_ROWS = 3;
/** Lean of the front rack from vertical, in degrees. */
export const RACK_LEAN_DEG = 18;

/** Available pop-up tent (canopy) footprints, in feet. */
export const TENT_SIZES = [8, 10, 12] as const;
export type TentSize = (typeof TENT_SIZES)[number];

/** Standard folding-table top height off the ground, in inches. */
export const TABLE_TOP_HEIGHT_IN = 29;
export const TABLE_TOP_THICKNESS_IN = 1.5;

/** Canopy tent heights, in feet (classic EZ-up style). */
export const TENT_EAVE_FT = 6.6; // where the roof meets the legs
export const TENT_PEAK_FT = 9.2; // center peak

// ---------- Pricing ----------
export const TAPE_SINGLE_PRICE = 5; // $5 each
export const TAPE_BUNDLE_QTY = 3; // 3 for $10
export const TAPE_BUNDLE_PRICE = 10;
export const TAPE_BUNDLE_RATE = TAPE_BUNDLE_PRICE / TAPE_BUNDLE_QTY; // ~$3.33/tape
export const MARKED_MIN_PRICE = 7; // "as marked" table range
export const MARKED_MAX_PRICE = 50;
export const MARKED_DEFAULT_AVG = 20;

/** Sell-through scenarios for the revenue estimator (fraction of tapes sold). */
export const SELL_THROUGH_LEVELS = [0.1, 0.25, 0.5, 0.75, 1] as const;

// ---------- Item catalog ----------
export type ItemCategory = 'table' | 'prop';

export type ItemKind = {
  id: string;
  label: string;
  category: ItemCategory;
  // Nominal size in feet. lengthFt = long/front edge, widthFt = short/depth.
  widthFt: number;
  lengthFt: number;
  color: string;
  supportsRack?: boolean; // tables can carry a leaned front rack
  prop?: 'tv' | 'vinyl' | 'banner' | 'chair'; // render hint for non-table props
};

export const ITEM_KINDS: ItemKind[] = [
  { id: '2x4', label: `2' × 4'`, category: 'table', widthFt: 2, lengthFt: 4, color: '#f59e0b', supportsRack: true },
  { id: '2x6', label: `2' × 6'`, category: 'table', widthFt: 2, lengthFt: 6, color: '#38bdf8', supportsRack: true },
  { id: '3x6', label: `3' × 6'`, category: 'table', widthFt: 3, lengthFt: 6, color: '#a78bfa', supportsRack: true },
  { id: 'tv', label: 'CRT TV', category: 'prop', widthFt: 2, lengthFt: 2, color: '#9ca3af', prop: 'tv' },
  { id: 'vinyl', label: 'Vinyl display', category: 'prop', widthFt: 2, lengthFt: 2, color: '#c084fc', prop: 'vinyl' },
  { id: 'banner', label: 'Banner', category: 'prop', widthFt: 0.3, lengthFt: 0.3, color: '#ef4444', prop: 'banner' },
  { id: 'chair', label: 'Folding chair', category: 'prop', widthFt: 3, lengthFt: 3, color: '#64748b', prop: 'chair' },
];

/** Banner: hangs at the top of the poles (eave), this tall, in feet. */
export const BANNER_HEIGHT_FT = 2;

export const TABLE_KINDS = ITEM_KINDS.filter((k) => k.category === 'table');
export const PROP_KINDS = ITEM_KINDS.filter((k) => k.category === 'prop');

export function itemKindById(id: string): ItemKind {
  return ITEM_KINDS.find((k) => k.id === id) ?? ITEM_KINDS[0];
}
