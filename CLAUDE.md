# Train – workout tracker (project notes for Claude)

A personal strength-training tracker that runs as an iPhone home-screen web app (PWA), hosted on GitHub Pages
at `https://process-falcons.github.io/train/`. Plain HTML/CSS/JS, no build step, no framework.

## Rules
- **Never add Claude attribution to commits** (no `Co-Authored-By: Claude…`, no `Claude-Session:` links). The owner asked for this.
- **No personal data in this repository.** It is public. Names, locations, rosters, health notes and training data belong in the private data repo.
- Every change that ships: bump `APP_VERSION` in `app.js`, `VERSION` in `sw.js`, and the `?v=` on `app.js`/`styles.css` in `index.html` (all the same number). Settings shows the version, so the owner can confirm the phone updated.
- Commit to `main` and push. GitHub Pages publishes in about a minute.
- Keep the look: near-black background, one lime accent (`--accent #C6F432`), amber for power/warnings, Inter + Space Grotesk, big touch targets (≥44 px), steppers instead of typing where possible.

## Files
| File | Purpose |
|---|---|
| `index.html` | Shell, iOS meta tags, service-worker registration (reloads once when a new worker takes over) |
| `app.js` | Everything: state, GitHub sync, views, actions |
| `styles.css` | All styles; colour tokens on `:root` |
| `sw.js` | Offline support. Network-first with a 3 s limit, cache fallback. Fonts cache-first. Never caches api.github.com |
| `manifest.webmanifest`, `icons/` | Home-screen app metadata and icons |

## How app.js is organised
- **State `S`**: `cfg` (GitHub owner/repo/token, rest seconds, sound, unit kg/lb), `data` (the data-repo JSON files), `logs`, `queue` (unsynced writes), `active` (in-progress session), view state. Persisted to `localStorage` with the `tr_` prefix.
- **Sync**: `GH` wraps the GitHub contents API. `pushQueue()` uploads queued logs/files, then `pullAll()` refreshes. Local queued file changes win over pulled copies until uploaded. Offline: everything queues and syncs on `online`/app open.
- **Programme helpers**: `EX(id)` exercise lookup (ids starting `custom:` are user-typed), `resolve()` picks the first exercise in a slot whose equipment the current gym has (or the gym's remembered swap), `session(sid)` also returns generated sessions (`gen-*`, daily `snack`).
- **Metrics**: `stats()` (cached until `invalidate()`): per-exercise history, PR scores. `score()`/`e1rm()` use Epley; body-weight lifts add body weight (or 75 kg if none logged).
- **Units**: everything is stored in kg. `W(kg)` converts for display, `toKg(v)` converts input, `stepU()` gives kg or lb stepper increments.
- **Views**: `vToday` (week strip from `schedule.json`, planned session, chooser button), `vSession` (logging, supersets/circuits, skip, swap, rest timer), `vChoose` (programme cards + quick 10-min generator by location), `vProgress`, `vPlan`, `vGyms`, `vSettings`. Sheets: swap, finish, overview, lift detail, log detail, body weight, gym editor.
- **Events**: one delegated click handler; elements carry `data-a="<action>"` and the action lives in object `A`.
- **iOS notes**: the page scrolls on `body`; `nudgeViewport()` does a 1 px scroll on open/return because iOS home-screen apps can start with the viewport one status bar short (lifts the bottom tab bar). Don't make `body` non-scrolling or move the tab bar with `100lvh` tricks; both were tried and looked wrong on the device.

## Data repository (private): `process-falcons/train-data`
`programme.json` (exercises with `type`, `equip` alternatives, `pattern`, `inc`; sessions with blocks/slots), `gyms.json`,
`schedule.json` (date → planned session + notes), `plan.json` (phases, races), `coros.json` (snapshot written by the coaching chat),
`body.json`, `logs/*.json` (one file per workout, written by the app). See that repo's README for formats.
The coaching side (training plans, COROS, calendar) is handled in a separate Claude chat that also edits the data repo – always pull before editing it.

## Testing
- Local: serve the parent folder of both repos (`python3 -m http.server`) and open `/train/?dev=1`. Dev mode reads `../train-data/*.json` and skips GitHub and the service worker.
- Playwright with an iPhone device profile covers layout and logic. Real home-screen behaviour (status bar, safe areas, viewport) needs the iOS Simulator (Xcode on the owner's Mac) or the phone itself.
