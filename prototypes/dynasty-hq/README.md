# Dynasty HQ — Next GM Context Prototype

Standalone prototype that applies the **Dynasty visual shell** to **real Next GM game content** (fixtures + read models). Use it as the clean reference for Brand HQ layout quality.

## Run

```bash
cd "Next GM V2/prototypes/dynasty-hq"
npm install
npm run dev
```

Open **http://127.0.0.1:5182**

Build check:

```bash
npm run build
```

## Fixtures

Use the prototype bar at the top to switch between three live-desk scenarios:

| Fixture | Scenario |
|---------|----------|
| Week Pressure | Raw, incomplete card, rivalry heat |
| Go-Home PLE | PLE urgency |
| Post-Show Fallout | Resolved show + title/rivalry fallout |

All panel data comes from the same `@game` read models as the main app's Brand HQ screen. **This prototype does not read localStorage saves** — fixtures only.

## Compare with main app

Run the main app on **http://localhost:5174** and compare side-by-side:

- **Content** should match game logic (wrestler names, nav labels, show card, pressure readouts)
- **Style/layout** should be cleaner here: no page scroll, contained panel scroll, ellipsis on long names, fixed right-rail heights

Navigation clicks show a stub toast — use the main app for real screen routing.

The Dynasty controller footer (A/B/? prompts, ticker, Online status) is intentionally removed to give the dashboard grid more vertical space.

## Portraits

Superstar photos load from the main app's `public/superstars/` folder via the shared Vite `publicDir` (`../../public`). The prototype uses `@components/SuperstarPortrait` — same pipeline as `:5174`. Missing PNGs fall back to initials.

## Structure

```
src/
  DynastyHQApp.tsx          # fixture picker + toast shell
  adapters/buildDashboardModel.ts
  scenes/DynastyDashboardScene.tsx
  fixtures/                 # copied from live-desk
  components/DynastyPortrait.tsx # wraps SuperstarPortrait at dynasty sizes
```

Dynasty CSS/components are reused via the `@dynasty` alias → `../wrestling-gm-dynasty/src`.

## Validation targets

- 1280×720 and 1100×720: no document scrollbar
- All 3 fixtures render without panel overlap
- Brand skin changes between Raw (week-pressure) and NXT (post-show-fallout)
