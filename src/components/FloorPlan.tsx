import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  IN_PER_FT,
  RACK_LEAN_DEG,
  TABLE_TOP_HEIGHT_IN,
  itemKindById,
} from '../domain/constants';
import {
  isTable,
  itemFootprintFt,
  rackSideOf,
  rackTapesForTable,
  tableFlatPlacements,
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
  onCycleRack: (uid: string) => void;
  onCycleBanner: (uid: string) => void;
};

// Depth (ground footprint) of a leaned front rack, in feet.
const RACK_DEPTH_FT =
  (TABLE_TOP_HEIGHT_IN / IN_PER_FT) * Math.tan((RACK_LEAN_DEG * Math.PI) / 180);

export function FloorPlan({
  layout,
  selectedUid,
  showTapes,
  onSelect,
  onMove,
  onCycleRack,
  onCycleBanner,
}: Props) {
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

        {layout.items.map((t) => {
          if (itemKindById(t.kindId).prop === 'banner') {
            return (
              <BannerStrip
                key={t.uid}
                item={t}
                tentFt={layout.tentFt}
                pxPerFt={pxPerFt}
                originPx={originPx}
                selected={t.uid === selectedUid}
                onSelectOrCycle={(uid, isSel) =>
                  isSel ? onCycleBanner(uid) : onSelect(uid)
                }
              />
            );
          }
          return (
            <ItemView
              key={t.uid}
              item={t}
              layout={layout}
              pxPerFt={pxPerFt}
              originPx={originPx}
              selected={t.uid === selectedUid}
              dragging={drag.current?.uid === t.uid}
              showTapes={showTapes}
              onPointerDown={(e) => onPointerDownItem(e, t)}
              onCycleRack={onCycleRack}
            />
          );
        })}
      </div>
    </div>
  );
}

function ItemView({
  item,
  layout,
  pxPerFt,
  originPx,
  selected,
  dragging,
  showTapes,
  onPointerDown,
  onCycleRack,
}: {
  item: PlacedItem;
  layout: Layout;
  pxPerFt: number;
  originPx: number;
  selected: boolean;
  dragging: boolean;
  showTapes: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onCycleRack: (uid: string) => void;
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

  const placements = table ? tableFlatPlacements(item, layout) : [];
  const rackTapes = rackTapesForTable(item, layout);

  // Rack strip position depends on which edge it sits on.
  const side = table && item.frontRack ? rackSideOf(item, layout) : 0;
  const depthPx = RACK_DEPTH_FT * pxPerFt;
  const stripStyle: React.CSSProperties =
    side === 0
      ? { top: widPx, left: 0, width: lenPx, height: depthPx }
      : side === 2
        ? { top: -depthPx, left: 0, width: lenPx, height: depthPx }
        : side === 1
          ? { top: 0, left: lenPx, width: depthPx, height: widPx }
          : { top: 0, left: -depthPx, width: depthPx, height: widPx };

  return (
    <div
      className={`item-wrap${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
      style={wrapStyle}
      onPointerDown={onPointerDown}
    >
      {/* Front rack strip on the chosen edge; click to move it around */}
      {table && item.frontRack && (
        <div
          className="rack-strip"
          style={stripStyle}
          title="Click to move the rack to the next edge"
          onPointerDown={(e) => {
            e.stopPropagation();
            onCycleRack(item.uid);
          }}
        >
          <span className="rack-label">▤ {rackTapes}</span>
        </div>
      )}

      <div
        className={`surface ${table ? 'table' : 'prop prop-' + kind.prop}`}
        style={{ background: kind.color }}
      >
        {table && showTapes && pxPerFt >= 16 && (
          <div className="tape-dot-layer">
            {placements.map((p, i) => (
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
          {table ? `${kind.label} · ${placements.length}` : kind.label}
        </span>
      </div>
    </div>
  );
}

function BannerStrip({
  item,
  tentFt,
  pxPerFt,
  originPx,
  selected,
  onSelectOrCycle,
}: {
  item: PlacedItem;
  tentFt: number;
  pxPerFt: number;
  originPx: number;
  selected: boolean;
  onSelectOrCycle: (uid: string, isSelected: boolean) => void;
}) {
  const edge = item.bannerEdge ?? 0;
  const tentPx = tentFt * pxPerFt;
  const tPx = Math.max(7, 0.5 * pxPerFt);
  const style: React.CSSProperties =
    edge === 0
      ? { left: originPx, top: originPx + tentPx - tPx / 2, width: tentPx, height: tPx }
      : edge === 2
        ? { left: originPx, top: originPx - tPx / 2, width: tentPx, height: tPx }
        : edge === 1
          ? { left: originPx + tentPx - tPx / 2, top: originPx, width: tPx, height: tentPx }
          : { left: originPx - tPx / 2, top: originPx, width: tPx, height: tentPx };
  return (
    <div
      className={`banner-strip${selected ? ' selected' : ''}`}
      style={style}
      title="Click to hang the banner on the next tent edge"
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelectOrCycle(item.uid, selected);
      }}
    >
      <span className="banner-label">BANNER</span>
    </div>
  );
}
