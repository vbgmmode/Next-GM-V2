# Dynasty Full UI — Next GM Visual Prototype

Standalone prototype that applies the **Dynasty HQ visual system** to **every Next GM screen** — title, setup, all GameNav tabs, results, and week review. Visual-only: no localStorage, no game simulation.

## Run

```bash
cd "Next GM V2/prototypes/dynasty-game"
npm install
npm run dev
```

Open **http://127.0.0.1:5183**

Build:

```bash
npm run build
```

## Compare

| URL | Purpose |
|-----|---------|
| **http://127.0.0.1:5183** | Full Dynasty UI prototype (this app) |
| **http://127.0.0.1:5182** | Dashboard-only Dynasty HQ reference |
| **http://localhost:5174** | Main Next GM app (unchanged) |

## Playthrough spine

Use the **Playthrough** dropdown and **Next Step** button at the top:

1. **Title Screen** — New Career / Continue
2. **New Career Setup** — Contract → GM → Brand → Rules → Draft
3. **Brand HQ** — week-pressure dashboard fixture
4. **Booking Desk** — card builder + Run Show (advances to results)
5. **Show Results** — post-show fallout fixture
6. **Week Review** — GM office after-action + Advance Week stub
7. **Free Roam** — pick fixture + use GameNav to visit any tab

## Screens included

Title, Setup, Dashboard, Booking, Roster, Market, Profile, Championships, Rivalries, Calendar, Social, Finance, Results, Week Review, Season Review.

All use Dynasty panel chrome, header HUD, real `GameNav` labels, and superstar portraits from `public/superstars/` (shared via Vite `publicDir`).

## Structure

```
src/
  DynastyGameApp.tsx       # router + playthrough
  shell/DynastyShell.tsx   # header HUD + nav
  shell/PlaythroughBar.tsx
  scenes/                  # one file per screen
  adapters/buildDashboardModel.ts
  fixtures/                # live-desk + playthrough phases
  styles/bridge.css        # from dynasty-hq
  styles/pages.css         # per-screen layouts
```

## Validation targets

- 1280×720 and 1100×720: no document scroll on any screen
- Playthrough completes without errors
- All GameNav tabs render Dynasty-styled content
