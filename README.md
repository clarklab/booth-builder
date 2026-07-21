# 📼 Booth Builder

A swap-meet booth layout planner. Lay out your pop-up tent and tables to
scale on a top-down floor plan, then jump into a 3D view to see the whole
booth — including how many **VHS tapes** fit face-up on your tables.

## What it does

- **To-scale floor plan.** Drag tables around a grid under your pop-up tent.
  Everything is measured in real feet/inches. Snap-to-grid keeps things tidy.
- **Configurable tent.** Switch between **8′×8′**, **10′×10′**, and **12′×12′**
  pop-up canopies.
- **Tables like Lego.** Add **2′×4′**, **2′×6′**, and **3′×6′** tables, drag
  them, rotate them 90°, duplicate, or delete.
- **Display props.** Drop in a **CRT TV** (2′×2′), a **Vinyl display** crate
  (2′×2′), a **Folding chair** (3′×3′, sits on the ground), or a **Banner**
  that hangs along a tent edge at the top of the poles and reads
  “VHSgarage.com”. A TV or crate placed on a table rests on the tabletop and
  **displaces the tapes underneath** (they're removed from the count); chairs
  and banners don't.
- **VHS capacity math.** Tapes are packed in a solid mosaic (both orientations
  allowed) to maximize the count on each table, then centered on the table.
- **Front rack (optional, per table).** Toggle a leaned plywood display board
  that holds tapes standing face-out in 3 rows. Pick which edge it sits on —
  it defaults to facing into the tent; click it on the plan (or the sidebar
  button) to move it to any edge. Its tapes are counted and priced.
- **Revenue estimates.** Standard tapes priced at 3-for-$10 (typical) up to
  $5 each; mark one table **“as marked”** for premium tapes ($7–$50, avg
  adjustable). A **sell-through ladder** shows the estimate at 10/25/50/75/100%.
- **3D preview.** A wireframe pop-up tent (a post on each corner) with your
  tables, front racks, TVs, vinyl crates, and banners set up exactly as laid
  out. Tapes wear randomly generated, heavily pixelated **VHS covers**, and a
  camera-facing price label hovers over each table. Orbit, zoom, and pan.

Layouts auto-save to your browser (localStorage).

## The VHS math

A standard VHS cassette is **187 × 103 × 25 mm**. Laid *face up* (flat on its
back), each tape's footprint on the table is **187 × 103 mm** (~7.36″ × 4.06″).
Tapes are packed with a recursive rectangle-packing heuristic that tries both
orientations and fills leftover strips, reaching ~90% of the theoretical
area-max. Typical counts:

| Table   | Tapes (face up) |
| ------- | --------------- |
| 2′ × 4′ | 33              |
| 2′ × 6′ | 51              |
| 3′ × 6′ | 77              |

Add items by **dragging them from the sidebar** onto the plan (or click to
drop one in). In the **3D view you can click an item to select it** and use the
same keyboard shortcuts — the camera stays put while you edit.

## Keyboard shortcuts

Work in both the floor plan and the 3D view (on the selected item):

- **R** — rotate the selected item 90°
- **D** — duplicate the selected item
- **F** — toggle the front rack (tables only)
- **Delete / Backspace** — remove the selected item

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Tech

- **Vite + React + TypeScript** for the app and 2D editor
- **Three.js** for the 3D scene (instanced meshes for the tapes)
- No backend — everything runs in the browser

## Deploying to Netlify

The app is a static SPA; `netlify.toml` is already configured:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect + long-cache headers for hashed assets

Point Netlify at this repo and it deploys as-is. No serverless functions are
required.
