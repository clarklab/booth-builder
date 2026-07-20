import {
  TABLE_KINDS,
  TENT_SIZES,
  tableKindById,
  type TentSize,
} from '../domain/constants';
import type { LayoutStats } from '../domain/layout';
import type { Layout } from '../domain/types';

type Props = {
  layout: Layout;
  stats: LayoutStats;
  selectedUid: string | null;
  showTapes: boolean;
  onTentChange: (size: TentSize) => void;
  onAddTable: (kindId: string) => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
  onOpen3D: () => void;
  onToggleTapes: (v: boolean) => void;
};

export function Sidebar({
  layout,
  stats,
  selectedUid,
  showTapes,
  onTentChange,
  onAddTable,
  onRotate,
  onDuplicate,
  onDelete,
  onClear,
  onOpen3D,
  onToggleTapes,
}: Props) {
  const selected = layout.tables.find((t) => t.uid === selectedUid);
  const selectedKind = selected ? tableKindById(selected.kindId) : null;

  return (
    <aside className="sidebar">
      <div className="section">
        <h2>Pop-up Tent</h2>
        <div className="seg">
          {TENT_SIZES.map((s) => (
            <button
              key={s}
              className={layout.tentFt === s ? 'active' : ''}
              onClick={() => onTentChange(s)}
            >
              {s}′×{s}′
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Add a Table</h2>
        <div className="table-buttons">
          {TABLE_KINDS.map((k) => (
            <button key={k.id} className="table-btn" onClick={() => onAddTable(k.id)}>
              <span className="swatch" style={{ background: k.color }} />
              <span className="meta">
                <span className="name">{k.label} table</span>
                <span className="sub">
                  {k.widthFt * k.lengthFt} sq ft
                </span>
              </span>
              <span style={{ fontSize: 18, color: 'var(--muted)' }}>＋</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Selected Table</h2>
        {selected && selectedKind ? (
          <div className="selected-card">
            <div className="title">
              {selectedKind.label} table · {stats.perTable.find((p) => p.uid === selected.uid)?.tapes ?? 0} tapes
            </div>
            <div className="row">
              <button className="btn full" onClick={onRotate}>
                ⟲ Rotate 90°
              </button>
              <button className="btn full" onClick={onDuplicate}>
                ⧉ Duplicate
              </button>
            </div>
            <button className="btn danger full" onClick={onDelete}>
              🗑 Delete table
            </button>
            <div className="hint">Drag on the floor plan to move. Keys: R rotate, Del delete.</div>
          </div>
        ) : (
          <div className="empty-hint">
            Nothing selected. Click a table on the floor plan to rotate, duplicate,
            or delete it.
          </div>
        )}
      </div>

      <div className="section">
        <h2>Capacity</h2>
        <div className="stat-big">
          <div className="num">{stats.totalTapes.toLocaleString()}</div>
          <div className="lbl">VHS tapes fit, face up</div>
        </div>
        <div className="stat-grid">
          <div className="stat-cell">
            <div className="n">{stats.tableCount}</div>
            <div className="l">tables</div>
          </div>
          <div className="stat-cell">
            <div className="n">{stats.usableAreaSqFt} ft²</div>
            <div className="l">table surface</div>
          </div>
        </div>
        {stats.perTable.length > 0 && (
          <div className="per-table">
            {stats.perTable.map((p, i) => (
              <div className="line" key={p.uid}>
                <span>
                  #{i + 1} · {p.label}
                </span>
                <span>{p.tapes} tapes</span>
              </div>
            ))}
          </div>
        )}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            fontSize: 13,
            color: 'var(--muted)',
          }}
        >
          <input
            type="checkbox"
            checked={showTapes}
            onChange={(e) => onToggleTapes(e.target.checked)}
          />
          Show tape mosaic on floor plan
        </label>
      </div>

      <div className="section">
        <button
          className="btn primary full"
          onClick={onOpen3D}
          disabled={layout.tables.length === 0}
        >
          🎡 View in 3D
        </button>
        <button
          className="btn full"
          style={{ marginTop: 8 }}
          onClick={onClear}
          disabled={layout.tables.length === 0}
        >
          Clear layout
        </button>
      </div>

      <div className="footer-note">
        VHS footprint: 187 × 103 mm laid flat (face up). Tapes are packed in a
        solid mosaic, both orientations allowed, to maximize the count per table.
      </div>
    </aside>
  );
}
