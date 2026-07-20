import type { TentSize } from './constants';

/** An item (table or prop) placed in the booth. */
export type PlacedItem = {
  uid: string;
  kindId: string;
  // Center position of the item within the booth, in FEET.
  // Origin (0,0) is the front-left corner of the tent footprint.
  xFt: number;
  yFt: number;
  // Rotation in degrees, clockwise. 0 = length runs left-right (x).
  rotation: number;
  // Table-only options:
  frontRack?: boolean; // leaned plywood display board on the front edge
  asMarked?: boolean; // premium "as marked" table ($7–$50 each)
};

export type Layout = {
  tentFt: TentSize;
  items: PlacedItem[];
};

export const STORAGE_KEY = 'booth-builder:layout:v2';
const LEGACY_KEY = 'booth-builder:layout:v1';

export function defaultLayout(): Layout {
  return {
    tentFt: 12,
    items: [],
  };
}

export function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Layout;
      if (parsed.items && parsed.tentFt) return parsed;
    }
    // Migrate a v1 layout ({ tentFt, tables: [...] }) if present.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as { tentFt?: TentSize; tables?: PlacedItem[] };
      if (old.tables && old.tentFt) {
        return { tentFt: old.tentFt, items: old.tables };
      }
    }
    return defaultLayout();
  } catch {
    return defaultLayout();
  }
}

export function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

let counter = 0;
export function makeUid(): string {
  counter += 1;
  return `t${Date.now().toString(36)}${counter}`;
}
