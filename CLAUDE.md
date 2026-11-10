# Train – workout tracker (project notes for Claude)

A personal strength-training tracker that runs as an iPhone home-screen web app (PWA), hosted on GitHub Pages
at `https://process-falcons.github.io/train/`. Plain HTML/CSS/JS, no build step, no framework.

## Rules
- **Never add Claude attribution to commits** (no `Co-Authored-By: Claude…`, no `Claude-Session:` links). The owner asked for this.
- **No personal data in this repository.** It is public. Names, locations, rosters, health notes and training data belong in the private data repo.
- Every change that ships: bump `APP_VERSION` in `app.js`, `VERSION` in `sw.js`, and the `?v=` on `app.js`/`styles.css` in `index.html` (all the same number). Settings shows the version, so the owner can confirm the phone updated.
- Commit to `main` and push **only after the owner has seen the change and said to push** (in dev mode or the iOS Simulator). GitHub Pages publishes in 1–3 minutes.
- Keep the look: near-black background, one lime accent (`--accent #C6F432`), amber for power/warnings, Inter + Space Grotesk, big touch targets (≥44 px), steppers instead of typing where possible.

## Working alongside other chats
Several Claude chats touch these repos: the coaching chat edits `train-data`, and other chats sometimes change this app. To stay out of each other's way:
1. **Pull before starting** (`git pull`) so you build on the latest `main`.
2. **Pull again just before pushing** (`git pull --rebase`). If someone else changed the same lines, keep both changes – never overwrite theirs, never force-push.
3. **Version numbers:** take the next number after whatever is now on `main` (they changed while you worked? bump again).
4. **Run the tests** (`python3 tests/run.py`) after the final pull, and push only if they pass. Add or update tests for what you changed.
5. **No attribution** in commits (see Rules), and commit as the repo's usual author `Train <train@users.noreply.github.com>`.

## Files
| File | Purpose |
|---|---|
| `index.html` | Shell, iOS meta tags, service-worker registration (reloads once when a new worker takes over) |
| `app.js` | Everything: state, GitHub sync, views, actions |
| `styles.css` | All styles; colour tokens on `:root` |
| `sw.js` | Offline support. Network-first with a 3 s limit, cache fallback. Fonts cache-first. Never caches api.github.com |
| `manifest.webmanifest`, `icons/` | Home-screen app metadata and icons |
| `tests/run.py`, `tests/fixtures/` | Automated tests and the made-up data they run on (public: never put real data here) |

## How app.js is organised
- **State `S`**: `cfg` (GitHub owner/repo/token, rest seconds, sound, unit kg/lb), `data` (the data-repo JSON files), `logs`, `queue` (unsynced writes), `active` (in-progress session), view state. Persisted to `localStorage` with the `tr_` prefix.
- **Sync**: `GH` wraps the GitHub contents API. `pushQueue()` uploads queued logs/files, then `pullAll()` refreshes. Local queued file changes win over pulled copies until uploaded. Offline: everything queues and syncs on `online`/app open.
- **Programme helpers**: `EX(id)` exercise lookup (ids starting `custom:` are user-typed), `resolve()` picks the first exercise in a slot whose equipment the current gym has (or the gym's remembered swap), `session(sid)` also returns generated sessions (`gen-*`, daily `snack`).
- **Metrics**: `stats()` (cached until `invalidate()`): per-exercise history, PR scores. `score()`/`e1rm()` use Epley; body-weight lifts add body weight (or 75 kg if none logged).
- **Units**: everything is stored in kg. `W(kg)` converts for display, `toKg(v)` converts input, `stepU()` gives kg or lb stepper increments.
- **Roster**: `rosterDay(d)` reads `roster.json`; `autoPlan(d)` suggests a session for days `schedule.json` leaves empty, from `plan.json` → `rosterRules` (defaults in `RULES_DEFAULT`); `dayPlan(d)` = schedule entry, else the suggestion (`auto: true`, shown as AUTO). `dutyRow()` is the Today duty line with leave-by (report − `leaveMinutes`), shown for working days only. The app never writes `roster.json`: it is built from the AIMS eCrew events in Google Calendar by `train-data/tools/roster_import.py` on GitHub Actions (see that repo's README).
- **Where you are**: `gym()` = the gym in use: on a LAYOVER day the hotel whose `airport` matches the roster's `nightstop`, unless the owner picked a place that day (`tr_hereSet`); otherwise `gyms.current`. `dayGym(d)` previews another day's gym. A gym's `maxDB` (heaviest dumbbell, kg) makes `resolve()` skip dumbbell options whose last top weight is higher, and `prefill()` caps weights at it.
- **Views**: `vToday` (location button, week strip or month grid with duty markers, planned/AUTO session, duty line, chooser button), `vSession` (logging, supersets/circuits, skip, swap, rest timer), `vChoose` (programme cards + quick 10-min generator by location), `vProgress`, `vPlan`, `vGyms`, `vSettings`. Sheets: swap, finish, lift detail, log detail, body weight, gym editor.
- **Events**: one delegated click handler; elements carry `data-a="<action>"` and the action lives in object `A`.
- **iOS notes**: the page scrolls on `body`; `nudgeViewport()` does a 1 px scroll on open/return because iOS home-screen apps can start with the viewport one status bar short (lifts the bottom tab bar). Don't make `body` non-scrolling or move the tab bar with `100lvh` tricks; both were tried and looked wrong on the device.

## Data repository (private): `process-falcons/train-data`
`programme.json` (exercises with `type`, `equip` alternatives, `pattern`, `inc`; sessions with blocks/slots), `gyms.json`,
`schedule.json` (date → planned session + notes), `plan.json` (phases, races, optional `rosterRules`), `roster.json` (date → duty FLY/LAYOVER/OFF/STBH/STBA, report, off, sectors, nightstop, overnight; generated – never hand-edit), `coros.json` (snapshot written by the coaching chat),
`body.json`, `logs/*.json` (one file per workout, written by the app). See that repo's README for formats.
The coaching side (training plans, COROS, calendar) is handled in a separate Claude chat that also edits the data repo – always pull before editing it.

## Testing
- **Automated:** `python3 tests/run.py` (add `--shots` for screenshots in `tests/shots/`). It starts its own server, opens `/?dev=fixtures` in WebKit with an iPhone profile, fixes the clock to 8 Jan 2030 and checks Today, workouts, calendar, roster rules, the duty sheet, layover gyms and dumbbell limits. One-time setup: `pip install playwright && python3 -m playwright install webkit`.
- **By hand:** serve the parent folder of both repos and open `/train/?dev=1`. Dev mode reads `../train-data/*.json` (or `tests/fixtures/` with `?dev=fixtures`), skips GitHub and the service worker, and keeps file edits (roster, gyms…) in this browser only (`tr_devfiles`; Settings → Clear this phone resets them).
- Playwright covers layout and logic. Real home-screen behaviour (status bar, safe areas, viewport) needs the iOS Simulator (Xcode on the owner's Mac) or the phone itself.
