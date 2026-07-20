import { useEffect, useMemo, useState } from 'react';
import { FloorPlan } from './components/FloorPlan';
import { Sidebar } from './components/Sidebar';
import { Scene3D } from './components/Scene3D';
import { tableKindById, type TentSize } from './domain/constants';
import { computeStats } from './domain/layout';
import {
  defaultLayout,
  loadLayout,
  makeUid,
  saveLayout,
  type Layout,
  type TableInstance,
} from './domain/types';

export function App() {
  const [layout, setLayout] = useState<Layout>(() => loadLayout());
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [showTapes, setShowTapes] = useState(true);
  const [show3D, setShow3D] = useState(false);

  const stats = useMemo(() => computeStats(layout), [layout]);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const update = (fn: (l: Layout) => Layout) => setLayout((l) => fn(l));

  const addTable = (kindId: string) => {
    const kind = tableKindById(kindId);
    // Stagger new tables so they don't stack perfectly on top of each other.
    const n = layout.tables.length;
    const jitter = (n % 5) * 0.75;
    const table: TableInstance = {
      uid: makeUid(),
      kindId,
      xFt: Math.min(layout.tentFt / 2 + jitter, layout.tentFt - kind.lengthFt / 2),
      yFt: Math.min(layout.tentFt / 2 + jitter, layout.tentFt - kind.widthFt / 2),
      rotation: 0,
    };
    update((l) => ({ ...l, tables: [...l.tables, table] }));
    setSelectedUid(table.uid);
  };

  const moveTable = (uid: string, xFt: number, yFt: number) =>
    update((l) => ({
      ...l,
      tables: l.tables.map((t) => (t.uid === uid ? { ...t, xFt, yFt } : t)),
    }));

  const rotateSelected = () => {
    if (!selectedUid) return;
    update((l) => ({
      ...l,
      tables: l.tables.map((t) =>
        t.uid === selectedUid ? { ...t, rotation: (t.rotation + 90) % 360 } : t,
      ),
    }));
  };

  const duplicateSelected = () => {
    if (!selectedUid) return;
    const src = layout.tables.find((t) => t.uid === selectedUid);
    if (!src) return;
    const copy: TableInstance = {
      ...src,
      uid: makeUid(),
      xFt: src.xFt + 0.75,
      yFt: src.yFt + 0.75,
    };
    update((l) => ({ ...l, tables: [...l.tables, copy] }));
    setSelectedUid(copy.uid);
  };

  const deleteSelected = () => {
    if (!selectedUid) return;
    update((l) => ({ ...l, tables: l.tables.filter((t) => t.uid !== selectedUid) }));
    setSelectedUid(null);
  };

  const changeTent = (size: TentSize) =>
    update((l) => ({ ...l, tentFt: size }));

  const clearLayout = () => {
    if (layout.tables.length === 0) return;
    if (!confirm('Clear all tables from the layout?')) return;
    setLayout((l) => ({ ...defaultLayout(), tentFt: l.tentFt }));
    setSelectedUid(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (!selectedUid) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rotateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        duplicateSelected();
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
          selectedUid={selectedUid}
          showTapes={showTapes}
          onTentChange={changeTent}
          onAddTable={addTable}
          onRotate={rotateSelected}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onClear={clearLayout}
          onOpen3D={() => setShow3D(true)}
          onToggleTapes={setShowTapes}
        />

        <FloorPlan
          layout={layout}
          selectedUid={selectedUid}
          showTapes={showTapes}
          onSelect={setSelectedUid}
          onMove={moveTable}
        />
      </div>

      {show3D && <Scene3D layout={layout} onClose={() => setShow3D(false)} />}
    </div>
  );
}
