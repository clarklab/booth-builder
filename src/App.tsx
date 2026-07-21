import { useEffect, useMemo, useState } from 'react';
import { FloorPlan } from './components/FloorPlan';
import { Sidebar } from './components/Sidebar';
import { Scene3D } from './components/Scene3D';
import {
  MARKED_DEFAULT_AVG,
  itemKindById,
  type TentSize,
} from './domain/constants';
import {
  computePricing,
  computeStats,
  defaultRackSide,
  isTable,
  itemsOverlap,
  rackSideOf,
} from './domain/layout';
import {
  defaultLayout,
  loadLayout,
  makeUid,
  saveLayout,
  type Layout,
  type PlacedItem,
} from './domain/types';

export function App() {
  const [layout, setLayout] = useState<Layout>(() => loadLayout());
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [showTapes, setShowTapes] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [markedAvg, setMarkedAvg] = useState(MARKED_DEFAULT_AVG);

  const stats = useMemo(() => computeStats(layout), [layout]);
  const pricing = useMemo(() => computePricing(stats, markedAvg), [stats, markedAvg]);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const update = (fn: (l: Layout) => Layout) => setLayout((l) => fn(l));

  const addItem = (kindId: string) => {
    const kind = itemKindById(kindId);
    const n = layout.items.length;
    const jitter = (n % 5) * 0.75;
    const item: PlacedItem = {
      uid: makeUid(),
      kindId,
      xFt: Math.min(layout.tentFt / 2 + jitter, layout.tentFt - kind.lengthFt / 2),
      yFt: Math.min(layout.tentFt / 2 + jitter, layout.tentFt - kind.widthFt / 2),
      rotation: 0,
    };
    if (kind.prop === 'banner') item.bannerEdge = 2; // default: back edge (backdrop)
    update((l) => ({ ...l, items: [...l.items, item] }));
    setSelectedUid(item.uid);
  };

  // Drop an item at a specific spot (drag-and-drop from the sidebar).
  const addItemAt = (kindId: string, xFt: number, yFt: number) => {
    const kind = itemKindById(kindId);
    const item: PlacedItem = { uid: makeUid(), kindId, xFt, yFt, rotation: 0 };
    if (kind.prop === 'banner') {
      // Snap to the nearest tent edge.
      const t = layout.tentFt;
      const d = [t - yFt, t - xFt, yFt, xFt]; // front, right, back, left
      item.bannerEdge = d.indexOf(Math.min(...d));
    } else {
      const M = 3; // working margin
      const hw = kind.lengthFt / 2;
      const hh = kind.widthFt / 2;
      item.xFt = Math.min(Math.max(xFt, -M + hw), layout.tentFt + M - hw);
      item.yFt = Math.min(Math.max(yFt, -M + hh), layout.tentFt + M - hh);
    }
    update((l) => ({ ...l, items: [...l.items, item] }));
    setSelectedUid(item.uid);
  };

  const moveItem = (uid: string, xFt: number, yFt: number) =>
    update((l) => ({
      ...l,
      items: l.items.map((t) => (t.uid === uid ? { ...t, xFt, yFt } : t)),
    }));

  const patchSelected = (patch: Partial<PlacedItem>) => {
    if (!selectedUid) return;
    update((l) => ({
      ...l,
      items: l.items.map((t) => (t.uid === selectedUid ? { ...t, ...patch } : t)),
    }));
  };

  const rotateSelected = () => {
    if (!selectedUid) return;
    const sel = layout.items.find((t) => t.uid === selectedUid);
    if (!sel) return;

    // Rotating a table carries any TV/vinyl resting on it, so they stay put
    // relative to the table instead of being stranded on the floor.
    const carried = new Set<string>();
    if (isTable(sel)) {
      for (const it of layout.items) {
        const p = itemKindById(it.kindId).prop;
        if ((p === 'tv' || p === 'vinyl') && itemsOverlap(it, sel)) carried.add(it.uid);
      }
    }
    const cx = sel.xFt;
    const cy = sel.yFt;

    update((l) => ({
      ...l,
      items: l.items.map((t) => {
        if (t.uid === sel.uid) return { ...t, rotation: (t.rotation + 90) % 360 };
        if (carried.has(t.uid)) {
          // Rotate the prop's position 90° clockwise about the table center.
          return {
            ...t,
            xFt: cx - (t.yFt - cy),
            yFt: cy + (t.xFt - cx),
            rotation: (t.rotation + 90) % 360,
          };
        }
        return t;
      }),
    }));
  };

  const toggleRack = () => {
    const src = layout.items.find((t) => t.uid === selectedUid);
    if (!src) return;
    const enabling = !src.frontRack;
    patchSelected({
      frontRack: enabling,
      rackSide: enabling ? src.rackSide ?? defaultRackSide(src, layout) : src.rackSide,
    });
  };

  const cycleRack = (uid: string) => {
    const src = layout.items.find((t) => t.uid === uid);
    if (!src) return;
    const next = (rackSideOf(src, layout) + 1) % 4;
    update((l) => ({
      ...l,
      items: l.items.map((t) => (t.uid === uid ? { ...t, rackSide: next } : t)),
    }));
    setSelectedUid(uid);
  };

  const cycleBanner = (uid: string) => {
    const src = layout.items.find((t) => t.uid === uid);
    if (!src) return;
    const next = ((src.bannerEdge ?? 0) + 1) % 4;
    update((l) => ({
      ...l,
      items: l.items.map((t) => (t.uid === uid ? { ...t, bannerEdge: next } : t)),
    }));
    setSelectedUid(uid);
  };
  const toggleMarked = () => {
    const src = layout.items.find((t) => t.uid === selectedUid);
    if (src) patchSelected({ asMarked: !src.asMarked });
  };

  const duplicateSelected = () => {
    if (!selectedUid) return;
    const src = layout.items.find((t) => t.uid === selectedUid);
    if (!src) return;
    const copy: PlacedItem = {
      ...src,
      uid: makeUid(),
      xFt: src.xFt + 0.75,
      yFt: src.yFt + 0.75,
    };
    update((l) => ({ ...l, items: [...l.items, copy] }));
    setSelectedUid(copy.uid);
  };

  const deleteSelected = () => {
    if (!selectedUid) return;
    update((l) => ({ ...l, items: l.items.filter((t) => t.uid !== selectedUid) }));
    setSelectedUid(null);
  };

  const changeTent = (size: TentSize) => update((l) => ({ ...l, tentFt: size }));

  const clearLayout = () => {
    if (layout.items.length === 0) return;
    if (!confirm('Clear everything from the layout?')) return;
    setLayout((l) => ({ ...defaultLayout(), tentFt: l.tentFt }));
    setSelectedUid(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (!selectedUid) return;
      const sel = layout.items.find((t) => t.uid === selectedUid);
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rotateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        duplicateSelected();
      } else if ((e.key === 'f' || e.key === 'F') && sel && isTable(sel)) {
        e.preventDefault();
        toggleRack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUid, layout]);

  return (
    <div className="app">
      <header className="header">
        <span className="logo">📼</span>
        <h1>Booth Builder</h1>
        <span className="tag">swap-meet layout planner</span>
        <div className="spacer" />
        <span className="badge">
          <strong>{stats.totalTapes.toLocaleString()}</strong> tapes ·{' '}
          {stats.tableCount} tables
        </span>
      </header>

      <div className="main">
        <Sidebar
          layout={layout}
          stats={stats}
          pricing={pricing}
          markedAvg={markedAvg}
          selectedUid={selectedUid}
          showTapes={showTapes}
          onTentChange={changeTent}
          onAddItem={addItem}
          onRotate={rotateSelected}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onToggleRack={toggleRack}
          onCycleRackSide={() => selectedUid && cycleRack(selectedUid)}
          onCycleBannerEdge={() => selectedUid && cycleBanner(selectedUid)}
          onToggleMarked={toggleMarked}
          onClear={clearLayout}
          onToggleTapes={setShowTapes}
          onMarkedAvgChange={setMarkedAvg}
        />

        <FloorPlan
          layout={layout}
          selectedUid={selectedUid}
          showTapes={showTapes}
          onSelect={setSelectedUid}
          onMove={moveItem}
          onCycleRack={cycleRack}
          onCycleBanner={cycleBanner}
          onAddAt={addItemAt}
          onOpen3D={() => setShow3D(true)}
          canOpen3D={layout.items.length > 0}
        />
      </div>

      {show3D && (
        <Scene3D
          layout={layout}
          markedAvg={markedAvg}
          selectedUid={selectedUid}
          onSelect={setSelectedUid}
          onClose={() => setShow3D(false)}
        />
      )}
    </div>
  );
}
