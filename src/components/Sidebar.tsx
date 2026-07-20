import {
  MARKED_MAX_PRICE,
  MARKED_MIN_PRICE,
  PROP_KINDS,
  TABLE_KINDS,
  TENT_SIZES,
  itemKindById,
  type TentSize,
} from '../domain/constants';
import { isTable, money, type LayoutStats, type Pricing } from '../domain/layout';
import type { Layout } from '../domain/types';

type Props = {
  layout: Layout;
  stats: LayoutStats;
  pricing: Pricing;
  markedAvg: number;
  selectedUid: string | null;
  showTapes: boolean;
  onTentChange: (size: TentSize) => void;
  onAddItem: (kindId: string) => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleRack: () => void;
  onToggleMarked: () => void;
  onClear: () => void;
  onOpen3D: () => void;
  onToggleTapes: (v: boolean) => void;
  onMarkedAvgChange: (v: number) => void;
};

export function Sidebar(props: Props) {
  const {
    layout,
    stats,
    pricing,
    markedAvg,
    selectedUid,
    showTapes,
    onTentChange,
    onAddItem,
    onRotate,
    onDuplicate,
    onDelete,
    onToggleRack,
    onToggleMarked,
    onClear,
    onOpen3D,
    onToggleTapes,
    onMarkedAvgChange,
  } = props;

  const selected = layout.items.find((t) => t.uid === selectedUid);
  const selectedKind = selected ? itemKindById(selected.kindId) : null;
  const selectedStat = stats.perTable.find((p) => p.uid === selectedUid);
  const selectedIsTable = selected ? isTable(selected) : false;

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
            <button key={k.id} className="table-btn" onClick={() => onAddItem(k.id)}>
              <span className="swatch" style={{ background: k.color }} />
              <span className="meta">
                <span className="name">{k.label} table</span>
                <span className="sub">{k.widthFt * k.lengthFt} sq ft</span>
              </span>
              <span className="plus">＋</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Add a Display Prop</h2>
        <div className="table-buttons">
          {PROP_KINDS.map((k) => (
            <button key={k.id} className="table-btn" onClick={() => onAddItem(k.id)}>
              <span className="swatch prop-icon" style={{ background: k.color }}>
                {k.prop === 'tv' ? '📺' : '🎵'}
              </span>
              <span className="meta">
                <span className="name">{k.label}</span>
                <span className="sub">
                  {k.widthFt}′ × {k.lengthFt}′ footprint
                </span>
              </span>
              <span className="plus">＋</span>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Selected</h2>
        {selected && selectedKind ? (
          <div className="selected-card">
            <div className="title">
              {selectedKind.label}
              {selectedIsTable ? ' table' : ''}
              {selectedStat ? ` · ${selectedStat.tapes} tapes` : ''}
            </div>
            {selectedIsTable && selectedStat && (
              <div className="hint">
                {selectedStat.flat} face-up on top
                {selectedStat.rack > 0 ? ` + ${selectedStat.rack} on front rack` : ''}
              </div>
            )}
            <div className="row">
              <button className="btn full" onClick={onRotate}>
                ⟲ Rotate 90°
              </button>
              <button className="btn full" onClick={onDuplicate}>
                ⧉ Duplicate
              </button>
            </div>

            {selectedIsTable && (
              <>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!selected.frontRack}
                    onChange={onToggleRack}
                  />
                  <span>
                    Front rack <span className="muted">(leaned display board)</span>
                  </span>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!selected.asMarked}
                    onChange={onToggleMarked}
                  />
                  <span>
                    “As marked” table{' '}
                    <span className="muted">
                      (${MARKED_MIN_PRICE}–${MARKED_MAX_PRICE})
                    </span>
                  </span>
                </label>
              </>
            )}

            <button className="btn danger full" onClick={onDelete}>
              🗑 Delete
            </button>
            <div className="hint">
              Drag to move. Keys: R rotate, D duplicate
              {selectedIsTable ? ', F front rack' : ''}, Del delete.
            </div>
          </div>
        ) : (
          <div className="empty-hint">
            Nothing selected. Click a table or prop on the floor plan to edit it.
          </div>
        )}
      </div>

      <div className="section">
        <h2>Capacity</h2>
        <div className="stat-big">
          <div className="num">{stats.totalTapes.toLocaleString()}</div>
          <div className="lbl">VHS tapes on display</div>
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
                  {p.hasRack ? ' + rack' : ''}
                  {p.asMarked ? ' ★' : ''}
                </span>
                <span>{p.tapes} tapes</span>
              </div>
            ))}
          </div>
        )}
        <label className="toggle" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={showTapes}
            onChange={(e) => onToggleTapes(e.target.checked)}
          />
          <span>Show tape mosaic on floor plan</span>
        </label>
      </div>

      <div className="section">
        <h2>Revenue Estimate</h2>
        <div className="stat-big money">
          <div className="num">{money(pricing.typical)}</div>
          <div className="lbl">typical gross if it all sells</div>
          <div className="range">
            range {money(pricing.low)} – {money(pricing.high)}
          </div>
        </div>
        <div className="price-lines">
          <div className="line">
            <span>{stats.standardTapes} standard tapes</span>
            <span>
              {money(pricing.standardTypical)}
              <span className="muted"> – {money(pricing.standardHigh)}</span>
            </span>
          </div>
          {stats.markedTapes > 0 && (
            <div className="line">
              <span>{stats.markedTapes} “as marked” tapes</span>
              <span>
                {money(pricing.markedLow)}
                <span className="muted"> – {money(pricing.markedHigh)}</span>
              </span>
            </div>
          )}
        </div>
        <label className="marked-avg">
          <span>Avg “as marked” price</span>
          <span className="input-wrap">
            $
            <input
              type="number"
              min={MARKED_MIN_PRICE}
              max={MARKED_MAX_PRICE}
              value={markedAvg}
              onChange={(e) => onMarkedAvgChange(Number(e.target.value) || 0)}
            />
          </span>
        </label>
        <div className="footer-note" style={{ borderTop: 'none', paddingTop: 4 }}>
          Standard tapes priced at 3 for $10 (typical) up to $5 each. Mark one
          table “as marked” for premium tapes.
        </div>
      </div>

      <div className="section">
        <button
          className="btn primary full"
          onClick={onOpen3D}
          disabled={layout.items.length === 0}
        >
          🎡 View in 3D
        </button>
        <button
          className="btn full"
          style={{ marginTop: 8 }}
          onClick={onClear}
          disabled={layout.items.length === 0}
        >
          Clear layout
        </button>
      </div>

      <div className="footer-note">
        VHS footprint: 187 × 103 mm. Face-up tapes are packed in a solid mosaic;
        front-rack tapes stand face-out in 3 rows.
      </div>
    </aside>
  );
}
