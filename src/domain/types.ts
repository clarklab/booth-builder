import type { TentSize } from './constants';

/** A table instance placed in the booth. */
export type TableInstance = {
  uid: string;
  kindId: string;
  // Center position of the table within the booth, in FEET.
  // Origin (0,0) is the front-left corner of the tent footprint.
  xFt: number;
  yFt: number;
  // Rotation in degrees, clockwise. 0 = length runs left-right (x).
  rotation: number;
};

export type Layout = {
  tentFt: TentSize;
  tables: TableInstance[];
};

export const STORAGE_KEY = 'booth-builder:layout:v1';

export function defaultLayout(): Layout {
  return {
    tentFt: 12,
    tables: [],
  };
}

export function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout();
    const parsed = JSON.parse(raw) as Layout;
    if (!parsed.tables || !parsed.tentFt) return defaultLayout();
    return parsed;
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
