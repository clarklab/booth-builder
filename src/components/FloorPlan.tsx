import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  IN_PER_FT,
  RACK_LEAN_DEG,
  TABLE_TOP_HEIGHT_IN,
  itemKindById,
} from '../domain/constants';
import {
  flatPackForTable,
  isTable,
  itemFootprintFt,
  rackTapesForTable,
} from '../domain/layout';
import type { Layout, PlacedItem } from '../domain/types';

const MARGIN_FT = 3; // working space around the tent footprint
const SNAP_FT = 0.5; // chunkier grid snap

type Props = {
  layout: Layout;
  selectedUid: string | null;
  showTapes: boolean;
  onSelect: (uid: string | null) => void;
  onMove: (uid: string, xFt: number, yFt: number) => void;
};

// Depth (ground footprint) of a leaned front rack, in feet.
const RACK_DEPTH_FT =
  (TABLE_TOP_HEIGHT_IN / IN_PER_FT) * Math.tan((RACK_LEAN_DEG * Math.PI) / 180);

export function FloorPlan({ layout, selectedUid, showTapes, onSelect, onMove }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pxPerFt, setPxPerFt] = useState(30);

  const workFt = layout.tentFt + MARGIN_FT * 2;

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
  const originPx = MARGIN_FT * pxPerFt;

  const drag = useRef<{ uid: string; grabDxFt: number; grabDyFt: number } | null>(null);

  const clampCenter = useCallback(
    (item: PlacedItem, xFt: number, yFt: number) => {
      const { w, h } = itemFootprintFt(item);
      const hx = w / 2;
      const hy = h / 2;
      const min = -MARGIN_FT;
      const max = layout.tentFt + MARGIN_FT;
      return {
        cx: Math.min(Math.max(xFt, min + hx), max - hx),
        cy: Math.min(Math.max(yFt, min + hy), max - hy),
      };
    },
    [layout.tentFt],
  );

  const pointerToFt = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapRef.current!.querySelector('.plan') as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      return {
        xFt: (clientX - rect.left) / pxPerFt - MARGIN_FT,
        yFt: (clientY - rect.top) / pxPerFt - MARGIN_FT,
      };
    },
    [pxPerFt],
  );

  const onPointerDownItem = (e: React.PointerEvent, item: PlacedItem) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onSelect(item.uid);
    const { xFt, yFt } = pointerToFt(e.clientX, e.clientY);
    drag.current = { uid: item.uid, grabDxFt: xFt - item.xFt, grabDyFt: yFt - item.yFt };
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const item = layout.items.find((t) => t.uid === d.uid);
      if (!item) return;
      const { xFt, yFt } = pointerToFt(e.clientX, e.clientY);
      const nx = Math.round((xFt - d.grabDxFt) / SNAP_FT) * SNAP_FT;
      const ny = Math.round((yFt - d.grabDyFt) / SNAP_FT) * SNAP_FT;
      const { cx, cy } = clampCenter(item, nx, ny);
      onMove(d.uid, cx, cy);
    },
    [layout.items, pointerToFt, clampCenter, onMove],
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointerup', endDrag);
    return () => window.removeEventListener('pointerup', endDrag);
  }, [endDrag]);

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="canvas-toolbar">
        <span className="pill">
          Tent {layout.tentFt}′ × {layout.tentFt}′ · grid = 1 ft · snap {SNAP_FT}′
        </span>
        {layout.items.length === 0 && (
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
        <div
          className="tent-floor"
          style={{ left: originPx, top: originPx, width: tentPx, height: tentPx }}
        >
          <span className="tent-label">
            pop-up tent · {layout.tentFt}′ × {layout.tentFt}′
          </span>
        </div>
        {[
          [originPx, originPx],
          [originPx + tentPx, originPx],
          [originPx, originPx + tentPx],
          [originPx + tentPx, originPx + tentPx],
        ].map(([px, py], i) => (
          <div className="tent-post" key={i} style={{ left: px, top: py }} />
        ))}

        {layout.items.map((t) => (
          <ItemView
            key={t.uid}
            item={t}
            pxPerFt={pxPerFt}
            originPx={originPx}
            selected={t.uid === selectedUid}
            dragging={drag.current?.uid === t.uid}
            showTapes={showTapes}
            onPointerDown={(e) => onPointerDownItem(e, t)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemView({
  item,
  pxPerFt,
  originPx,
  selected,
  dragging,
  showTapes,
  onPointerDown,
}: {
  item: PlacedItem;
  pxPerFt: number;
  originPx: number;
  selected: boolean;
  dragging: boolean;
  showTapes: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const kind = itemKindById(item.kindId);
  const lenPx = kind.lengthFt * pxPerFt;
  const widPx = kind.widthFt * pxPerFt;
  const cx = originPx + item.xFt * pxPerFt;
  const cy = originPx + item.yFt * pxPerFt;
  const table = isTable(item);

  const wrapStyle: React.CSSProperties = {
    width: lenPx,
    height: widPx,
    left: cx - lenPx / 2,
    top: cy - widPx / 2,
    transform: `rotate(${item.rotation}deg)`,
  };

  const pack = table
    ? flatPackForTable(item)
    : { placements: [], count: 0 };
  const rackTapes = rackTapesForTable(item);

  return (
    <div
      className={`item-wrap${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
      style={wrapStyle}
      onPointerDown={onPointerDown}
    >
      {/* Front rack strip on the front (bottom) edge */}
      {table && item.frontRack && (
        <div
          className="rack-strip"
          style={{ top: widPx, height: RACK_DEPTH_FT_PX(pxPerFt) }}
        >
          <span className="rack-label">▤ rack · {rackTapes}</span>
        </div>
      )}

      <div
        className={`surface ${table ? 'table' : 'prop prop-' + kind.prop}`}
        style={{ background: kind.color }}
      >
        {table && showTapes && pxPerFt >= 16 && (
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

        {!table && kind.prop === 'tv' && <div className="tv-screen" />}
        {!table && kind.prop === 'vinyl' && <div className="vinyl-record" />}

        <span className="surface-label">
          {table ? `${kind.label} · ${pack.count}` : kind.label}
        </span>
      </div>
    </div>
  );
}

function RACK_DEPTH_FT_PX(pxPerFt: number): number {
  return RACK_DEPTH_FT * pxPerFt;
}
