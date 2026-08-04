# 📼 VHS Garage

Two tools for running a VHS booth, behind one home screen:

- **Booth Builder** — lay out your pop-up tent and tables to scale on a
  top-down floor plan, then jump into a 3D view to see the whole booth,
  including how many **VHS tapes** fit face-up on your tables.
- **Forecaster** — a running list of upcoming swap meets, custom VHS releases,
  and T-shirt runs, with a live tally of what the year makes. Releases can be
  split with collaborators. It syncs to the cloud, and any show on it can hand
  you a booth layout built to hit its number.

---

# Booth Builder

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
- Hash routing (`#/`, `#/booth`, `#/forecast`) — no router dependency
- **Netlify Blobs** behind one function for the season plan; the booth layout
  and a local mirror of the plan live in the browser

---

# Forecaster

A living list of everything that makes (or costs) money, with a running tally
that updates as you add to it. Not a one-shot calculator — you keep it around
and edit it all year.

Three kinds of event share one list:

- **🎪 Swap meets** — a show you set the booth up at. Costs a booth fee and gas,
  brings in used-tape sales off the tables. Each one carries its own crowd
  level, so a busy record fair and a slow Sunday market aren't forced to share
  an assumption.
- **📼 VHS releases** — a custom run. Make them for $5, sell them for $20; the
  margin is on the card.
- **👕 Shirt runs** — same money shape, different presets.

Tap **Add**, pick a run size, and you get a card pre-filled with sensible
numbers. Everything on it is editable: name, date, quantity, unit cost, sale
price, expected sell-through. Events group by month with a per-month subtotal,
and filter by kind or by whether they've happened yet.

Merch is costed the way it actually works: you pay for the **whole run** up
front, and only the units that sell pay you back. Unsold units are carried as
inventory at cost, not written off as a loss.

## Splitting a release

Tapes and shirts can be split with other people — an artist, a co-label, a
designer. Add a name and a percentage of that run's profit; you're never a row
in the list, because whatever the named parties don't take is yours. A run with
no splits is simply 100% yours.

Two rules the split math follows, both deliberate:

- **A loss is never shared.** Nobody hands money back on a release that didn't
  sell, so shares floor at zero and the shortfall lands on you. The card says
  so rather than showing negative payouts.
- **Over-committing isn't silently clamped.** Put 70% and 60% on the same run
  and your own take goes negative, with a warning explaining it. Quietly
  rewriting the numbers you typed would hide the mistake.

The rail totals everyone up across the year — the same person on two releases
is one payout line, matched case-insensitively — so you can see what you owe
whom, and what's actually yours after everyone's cut.

## Projections become actuals

Every event starts as a projection. Once one has happened, tick **"It
happened"** and type what you actually took in — the tally counts the real
number from then on. The rail keeps the two apart so you can always see how
much of the total is banked and how much is still a guess:

- **Running tally** — the whole year, best figure available for each event
- **Booked vs. still projected** — money in hand vs. money hoped for
- **Where it comes from** — profit split across swaps, tapes and shirts
- **Month by month** — cumulative profit, so you can see when you're ahead
- **Splits** — what each collaborator is owed, and what's left for you

Booking an actual never changes a merch run's cost. You already paid the
duplicator, whether or not the tapes moved.

## Where it's stored

Local-first, cloud-synced:

- **localStorage** is what the UI reads and writes, so edits never wait on the
  network. The planner works offline, and on `vite dev` where the function
  doesn't exist — the header badge just says "On this device".
- **Netlify Blobs** is the shared copy, pulled on load and pushed on a debounce
  after edits (with a hard ceiling so a long editing session still syncs). The
  newest edit wins, and the server refuses a write older than what it already
  holds, so a stale tab can't clobber a newer save.

The endpoint is `GET`/`PUT /api/plan` (`netlify/functions/plan.ts`).

> **Worth knowing:** with no `PLANNER_TOKEN` set the endpoint is open — anyone
> who finds the URL can read and overwrite the plan. That's the zero-config
> default so it works out of the box. Set a `PLANNER_TOKEN` environment
> variable in your Netlify project to require a passphrase; the app prompts for
> it once and remembers it.

If you'd used the old one-shot wizard, its saved plan is migrated into events
on first load — one swap per show it counted, one event per merch line.

## From a number to a booth

Every swap meet card has a **"Build the booth for this show"** button, and the
rail carries one sized for your next show. Say a show should bring in
**$200** — it hands you a floor plan already set up to do it: the right tent
size, the right tables, front racks where they help, and a premium "as marked"
table when the standard 3-for-$10 bins can't get there on their own.

Under the hood (`src/domain/autoLayout.ts`) it scores a ladder of hand-laid
booth shapes — one table, L-shape, U-shape, wide U, U-with-an-island, each
with and without front racks and with 0–N "as marked" tables — using the same
pricing math the Booth Builder shows in its sidebar. It picks the **smallest**
booth whose take at your crowd level clears your target, so you don't haul
four tables to a show that only needs one. If even a maxed-out 12′ canopy
can't reach the number, it says so instead of pretending.

Tables and racks in every generated shape are laid out to fit inside the
canopy without overlapping, and racks face outward so customers can browse
them.

---

## Deploying to Netlify

`netlify.toml` is already configured — a static SPA plus one function:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- `/api/plan` → the planner function, declared **before** the SPA catch-all so
  it doesn't get rewritten to `index.html`
- Long-cache headers for hashed assets

Point Netlify at this repo and it deploys as-is. Netlify Blobs needs no setup;
the store is created on first write. Set `PLANNER_TOKEN` in the project's
environment variables if you want the planner passphrase-protected.
