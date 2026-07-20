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
- **VHS capacity math.** Tapes are packed in a solid mosaic (both orientations
  allowed) to maximize the count on each table. The total updates live.
- **3D preview.** A wireframe pop-up tent (a post on each corner) with your
  tables set up underneath exactly as laid out, covered in a colorful VHS
  mosaic. Orbit, zoom, and pan.

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

## Keyboard shortcuts

- **R** — rotate the selected table 90°
- **D** — duplicate the selected table
- **Delete / Backspace** — remove the selected table

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
