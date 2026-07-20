import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IN_PER_FT, tableKindById } from '../domain/constants';
import { packTable } from '../domain/packing';
import { VHS } from '../domain/constants';
import type { Layout, TableInstance } from '../domain/types';

const MARGIN_FT = 3; // working space around the tent footprint
const SNAP_FT = 0.25;

type Props = {
  layout: Layout;
  selectedUid: string | null;
  showTapes: boolean;
  onSelect: (uid: string | null) => void;
  onMove: (uid: string, xFt: number, yFt: number) => void;
};

/** Length (long side) and width (short side) in feet for a table. */
function dims(table: TableInstance) {
  const k = tableKindById(table.kindId);
  return { lengthFt: k.lengthFt, widthFt: k.widthFt, color: k.color, label: k.label };
}

/** Half extents of the rotated bounding box, in feet. */
function halfExtents(table: TableInstance) {
  const { lengthFt, widthFt } = dims(table);
  const rad = (table.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    hx: (lengthFt * c + widthFt * s) / 2,
    hy: (lengthFt * s + widthFt * c) / 2,
  };
}

export function FloorPlan({ layout, selectedUid, showTapes, onSelect, onMove }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pxPerFt, setPxPerFt] = useState(30);

  const workFt = layout.tentFt + MARGIN_FT * 2;

  // Fit the working area to the available canvas space.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const pad = 48;
      const avail = Math.min(rect.width, rect.height) - pad;
      const px = Math.max(12, Math.min(70, Math.floor(avail / workFt)));
      setPxPerFt(px);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [workFt]);

  const planPx = workFt * pxPerFt;
  const tentPx = layout.tentFt * pxPerFt;
  const originPx = MARGIN_FT * pxPerFt; // tent front-left corner offset within plan

  // Drag state kept in a ref to avoid re-render churn on every pointer move.
  const drag = useRef<{
    uid: string;
    grabDxFt: number;
    grabDyFt: number;
  } | null>(null);

  const clampCenter = useCallback(
    (table: TableInstance, xFt: number, yFt: number) => {
      const { hx, hy } = halfExtents(table);
      const min = -MARGIN_FT;
      const maxX = layout.tentFt + MARGIN_FT;
      const maxY = layout.tentFt + MARGIN_FT;
      const cx = Math.min(Math.max(xFt, min + hx), maxX - hx);
      const cy = Math.min(Math.max(yFt, min + hy), maxY - hy);
      return { cx, cy };
    },
    [layout.tentFt],
  );

  const pointerToFt = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapRef.current!.querySelector('.plan') as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      const xFt = (clientX - rect.left) / pxPerFt - MARGIN_FT;
      const yFt = (clientY - rect.top) / pxPerFt - MARGIN_FT;
      return { xFt, yFt };
    },
    [pxPerFt],
  );

  const onPointerDownTable = (e: React.PointerEvent, table: TableInstance) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect(table.uid);
    const { xFt, yFt } = pointerToFt(e.clientX, e.clientY);
    drag.current = {
      uid: table.uid,
      grabDxFt: xFt - table.xFt,
      grabDyFt: yFt - table.yFt,
    };
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const table = layout.tables.find((t) => t.uid === d.uid);
      if (!table) return;
      const { xFt, yFt } = pointerToFt(e.clientX, e.clientY);
      let nx = xFt - d.grabDxFt;
      let ny = yFt - d.grabDyFt;
      nx = Math.round(nx / SNAP_FT) * SNAP_FT;
      ny = Math.round(ny / SNAP_FT) * SNAP_FT;
      const { cx, cy } = clampCenter(table, nx, ny);
      onMove(d.uid, cx, cy);
    },
    [layout.tables, pointerToFt, clampCenter, onMove],
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  // Keep drag alive even if pointer leaves the element.
  useEffect(() => {
    window.addEventListener('pointerup', endDrag);
    return () => window.removeEventListener('pointerup', endDrag);
  }, [endDrag]);

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="canvas-toolbar">
        <span className="pill">
          Tent {layout.tentFt}′ × {layout.tentFt}′ · grid = 1 ft
        </span>
        {layout.tables.length === 0 && (
          <span className="pill">← add a table to start</span>
        )}
      </div>

      <div
        className="plan"
        style={
          {
            width: planPx,
            height: planPx,
            ['--px-ft' as string]: `${pxPerFt}px`,
          } as React.CSSProperties
        }
        onPointerDown={() => onSelect(null)}
        onPointerMove={onPointerMove}
      >
        {/* Tent footprint */}
        <div
          className="tent-floor"
          style={{
            left: originPx,
            top: originPx,
            width: tentPx,
            height: tentPx,
          }}
        >
          <span className="tent-label">
            pop-up tent · {layout.tentFt}′ × {layout.tentFt}′
          </span>
        </div>
        {/* Corner posts */}
        {[
          [originPx, originPx],
          [originPx + tentPx, originPx],
          [originPx, originPx + tentPx],
          [originPx + tentPx, originPx + tentPx],
        ].map(([px, py], i) => (
          <div className="tent-post" key={i} style={{ left: px, top: py }} />
        ))}

        {/* Tables */}
        {layout.tables.map((t) => (
          <TableView
            key={t.uid}
            table={t}
            pxPerFt={pxPerFt}
            originPx={originPx}
            selected={t.uid === selectedUid}
            dragging={drag.current?.uid === t.uid}
            showTapes={showTapes}
            onPointerDown={(e) => onPointerDownTable(e, t)}
          />
        ))}
      </div>
    </div>
  );
}

function TableView({
  table,
  pxPerFt,
  originPx,
  selected,
  dragging,
  showTapes,
  onPointerDown,
}: {
  table: TableInstance;
  pxPerFt: number;
  originPx: number;
  selected: boolean;
  dragging: boolean;
  showTapes: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const { lengthFt, widthFt, color, label } = dims(table);
  const lenPx = lengthFt * pxPerFt;
  const widPx = widthFt * pxPerFt;
  const cx = originPx + table.xFt * pxPerFt;
  const cy = originPx + table.yFt * pxPerFt;

  // Box is drawn in the length-major frame and rotated about its center.
  const style: React.CSSProperties = {
    width: lenPx,
    height: widPx,
    left: cx - lenPx / 2,
    top: cy - widPx / 2,
    background: color,
    transform: `rotate(${table.rotation}deg)`,
  };

  const pack = packTable(
    widthFt * IN_PER_FT,
    lengthFt * IN_PER_FT,
    VHS.widthIn,
    VHS.heightIn,
  );

  return (
    <div
      className={`table${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
    >
      {showTapes && pxPerFt >= 16 && (
        <div className="tape-dot-layer">
          {pack.placements.map((p, i) => (
            <div
              key={i}
              className="tape-dot"
              style={{
                left: (p.x / IN_PER_FT) * pxPerFt,
                top: (p.y / IN_PER_FT) * pxPerFt,
                width: (p.w / IN_PER_FT) * pxPerFt - 0.5,
                height: (p.h / IN_PER_FT) * pxPerFt - 0.5,
              }}
            />
          ))}
        </div>
      )}
      <span className="table-label">
        {label} · {pack.count} tapes
      </span>
    </div>
  );
}
