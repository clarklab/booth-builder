// Build a booth layout that hits a dollar target.
//
// The forecaster knows what you want out of a single show ("$200 a show").
// This turns that into an actual tent + tables + racks arrangement: score a
// ladder of hand-laid-out booth shapes (smallest first) with the same pricing
// math the Booth Builder uses, and return the first one that clears the bar.

import { MARKED_DEFAULT_AVG, type TentSize } from './constants';
import { computePricing, computeStats } from './layout';
import { makeUid, type Layout, type PlacedItem } from './types';

type Slot = {
  kindId: string;
  xFt: number;
  yFt: number;
  rotation: number;
  /**
   * Which table edge a front rack leans on, in the table's local frame
   * (0 = +width, 2 = -width). Always the outward-facing long edge: a rack of
   * face-out tapes is for the customer to browse, and pointing it inward
   * would lean it into the neighbouring table.
   */
  rackSide: number;
};

type Shape = {
  id: string;
  /** How the arrangement reads on the plan, e.g. "U-shape". */
  form: string;
  tentFt: TentSize;
  slots: Slot[];
};

// Coordinates are in booth feet from the tent's back-left corner. The
// customer side (front) is the high-y edge, so front tables sit near y = tent
// and the wings run back from them along the side edges.
const SHAPES: Shape[] = [
  {
    id: 'single-8',
    form: 'One table',
    tentFt: 8,
    slots: [{ kindId: '2x6', xFt: 4, yFt: 6, rotation: 0, rackSide: 0 }],
  },
  {
    id: 'single-10',
    form: 'One wide table',
    tentFt: 10,
    slots: [{ kindId: '3x6', xFt: 5, yFt: 7.5, rotation: 0, rackSide: 0 }],
  },
  {
    id: 'L-10',
    form: 'L-shape',
    tentFt: 10,
    slots: [
      { kindId: '3x6', xFt: 5, yFt: 7.5, rotation: 0, rackSide: 0 },
      { kindId: '2x6', xFt: 2, yFt: 3, rotation: 90, rackSide: 0 },
    ],
  },
  {
    id: 'U-10',
    form: 'U-shape',
    tentFt: 10,
    slots: [
      { kindId: '3x6', xFt: 5, yFt: 7.5, rotation: 0, rackSide: 0 },
      { kindId: '2x6', xFt: 2, yFt: 3, rotation: 90, rackSide: 0 },
      { kindId: '2x6', xFt: 8, yFt: 3, rotation: 90, rackSide: 2 },
    ],
  },
  {
    id: 'U-12',
    form: 'Wide U-shape',
    tentFt: 12,
    slots: [
      { kindId: '3x6', xFt: 3, yFt: 9.5, rotation: 0, rackSide: 0 },
      { kindId: '3x6', xFt: 9, yFt: 9.5, rotation: 0, rackSide: 0 },
      { kindId: '3x6', xFt: 2.5, yFt: 5, rotation: 90, rackSide: 0 },
      { kindId: '3x6', xFt: 9.5, yFt: 5, rotation: 90, rackSide: 2 },
    ],
  },
  {
    id: 'U-island-12',
    form: 'U-shape + island',
    tentFt: 12,
    slots: [
      { kindId: '3x6', xFt: 3, yFt: 9.5, rotation: 0, rackSide: 0 },
      { kindId: '3x6', xFt: 9, yFt: 9.5, rotation: 0, rackSide: 0 },
      { kindId: '3x6', xFt: 2.5, yFt: 5, rotation: 90, rackSide: 0 },
      { kindId: '3x6', xFt: 9.5, yFt: 5, rotation: 90, rackSide: 2 },
      { kindId: '2x4', xFt: 6, yFt: 5, rotation: 0, rackSide: 0 },
    ],
  },
];

export type BoothBuild = {
  layout: Layout;
  /** Human summary: "12′ tent · U-shape · 4 tables + racks · 1 as-marked". */
  summary: string;
  tentFt: TentSize;
  tableCount: number;
  rackCount: number;
  markedCount: number;
  totalTapes: number;
  /** Gross if every tape on display sells. */
  fullTake: number;
  /** Gross at the sell-through the forecast assumes — what we match to target. */
  expectedTake: number;
  /** False when even the biggest shape can't reach the target. */
  meetsTarget: boolean;
};

type Candidate = {
  shape: Shape;
  racks: boolean;
  markedCount: number;
};

/**
 * Every shape x rack x as-marked-count combination. "As marked" tables are
 * capped at half the booth — premium stock is a table you add next to the
 * cheap bins, so a one-table all-premium booth isn't a real option even
 * though the arithmetic would happily pick it.
 */
function candidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const shape of SHAPES) {
    const maxMarked = Math.floor(shape.slots.length / 2);
    for (const racks of [false, true]) {
      for (let marked = 0; marked <= maxMarked; marked++) {
        out.push({ shape, racks, markedCount: marked });
      }
    }
  }
  return out;
}

function layoutFor(c: Candidate): Layout {
  const items: PlacedItem[] = c.shape.slots.map((slot, i) => ({
    uid: makeUid(),
    kindId: slot.kindId,
    xFt: slot.xFt,
    yFt: slot.yFt,
    rotation: slot.rotation,
    frontRack: c.racks,
    rackSide: slot.rackSide,
    // Mark the front tables first — premium stock belongs where people look.
    asMarked: i < c.markedCount,
  }));

  // A backdrop banner on the back edge: free, and it makes the 3D view read
  // as an actual booth instead of bare tables.
  items.push({
    uid: makeUid(),
    kindId: 'banner',
    xFt: c.shape.tentFt / 2,
    yFt: 0,
    rotation: 0,
    bannerEdge: 2,
  });

  return { tentFt: c.shape.tentFt, items };
}

function describe(c: Candidate, tables: number): string {
  const parts = [
    `${c.shape.tentFt}′ tent`,
    c.shape.form,
    `${tables} table${tables === 1 ? '' : 's'}${c.racks ? ' + front racks' : ''}`,
  ];
  if (c.markedCount > 0) {
    parts.push(`${c.markedCount} “as marked”`);
  }
  return parts.join(' · ');
}

/**
 * Smallest booth whose take at `sellThrough` covers `targetPerShow`.
 * Falls back to the biggest booth in the ladder when the target is out of
 * reach, with `meetsTarget: false` so the UI can say so.
 */
export function buildBoothForTarget(
  targetPerShow: number,
  sellThrough: number,
  markedAvg: number = MARKED_DEFAULT_AVG,
): BoothBuild {
  const scored = candidates()
    .map((c) => {
      const layout = layoutFor(c);
      const stats = computeStats(layout);
      const pricing = computePricing(stats, markedAvg);
      return {
        c,
        layout,
        stats,
        fullTake: pricing.typical,
        expectedTake: pricing.typical * sellThrough,
      };
    })
    // Cheapest booth that does the job wins, so sort by what it takes in and
    // break ties toward fewer tables.
    .sort(
      (a, b) =>
        a.expectedTake - b.expectedTake ||
        a.stats.tableCount - b.stats.tableCount,
    );

  const pick =
    scored.find((s) => s.expectedTake >= targetPerShow) ?? scored[scored.length - 1];

  return {
    layout: pick.layout,
    summary: describe(pick.c, pick.stats.tableCount),
    tentFt: pick.c.shape.tentFt,
    tableCount: pick.stats.tableCount,
    rackCount: pick.c.racks ? pick.stats.tableCount : 0,
    markedCount: pick.c.markedCount,
    totalTapes: pick.stats.totalTapes,
    fullTake: pick.fullTake,
    expectedTake: pick.expectedTake,
    meetsTarget: pick.expectedTake >= targetPerShow,
  };
}
