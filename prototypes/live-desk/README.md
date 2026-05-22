# Next GM — Live Desk Prototype

Standalone broadcast command-center prototype. Does not replace the main app.

## Run

```bash
cd prototypes/live-desk
npm install
npm run dev
```

Open http://127.0.0.1:5175/

## Fixtures

| Fixture | Scene | Purpose |
|---------|-------|---------|
| Week Pressure | Brand HQ | Normal TV week, incomplete card, title/rivalry pressure |
| Go-Home PLE | Production Rundown | Go-home urgency, card nearly ready |
| Post-Show Fallout | Post-Show Package | Resolved broadcast recap with title/rivalry/injury beats |

Use the **PROTOTYPE** controls (top-right) to switch fixtures and scenes.

## Notes

- Curated fixtures only — no live save mirroring
- Read-only presentation wired to real game read-models from `src/game/`
- Pre-show scenes never show predicted grades or fan fallout
