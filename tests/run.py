"""Train app tests: WebKit with an iPhone profile, against the made-up data in tests/fixtures.

Run from anywhere:  python3 tests/run.py          (add --shots to save screenshots in tests/shots/)
Needs:              pip install playwright  &&  python3 -m playwright install webkit

The page is opened as /?dev=fixtures, so nothing touches GitHub or the real data repo,
and the clock is fixed to Tuesday 8 January 2030 so the sample schedule and roster line up.
"""
import functools
import http.server
import re
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "tests" / "shots"
SAVE_SHOTS = "--shots" in sys.argv
VERSION = re.search(r"APP_VERSION = '([^']+)'", (ROOT / "app.js").read_text()).group(1)
results, errors = [], []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


def serve():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/?dev=fixtures"


def iphone(p):
    for name in ("iPhone 17 Pro", "iPhone 16 Pro", "iPhone 15 Pro", "iPhone 14 Pro"):
        if name in p.devices:
            return p.devices[name]
    return p.devices["iPhone 13"]


def open_app(browser, p, url, day, hour=8):
    ctx = browser.new_context(**iphone(p), timezone_id="Europe/London")
    page = ctx.new_page()
    page.clock.set_fixed_time(datetime(2030, 1, day, hour, 0, tzinfo=timezone.utc))
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and "favicon" not in m.text and errors.append(f"console: {m.text}"))
    page.goto(url)
    page.wait_for_selector(".day")
    page.wait_for_timeout(400)
    return ctx, page


def wait(page, ms=300):
    page.wait_for_timeout(ms)


def shot(page, name):
    if SAVE_SHOTS:
        SHOTS.mkdir(exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"))


def pick_day(page, k):
    page.locator(f'[data-a="selDay"][data-d="{k}"]').first.tap()
    wait(page)


def month(page):
    return page.evaluate("""() => Object.fromEntries([...document.querySelectorAll('.mday')].map(e =>
        [e.dataset.d, { lb: e.querySelector('.lb').textContent, dt: (e.querySelector('.dt') || {}).textContent || '', auto: e.classList.contains('auto') }]))""")


def t_basics(page):
    check("app version matches app.js", page.evaluate("APP_VERSION") == VERSION)
    check("sw.js and index.html carry the same version",
          f"train-{VERSION}" in (ROOT / "sw.js").read_text() and (ROOT / "index.html").read_text().count(f"?v={VERSION}") == 2)
    check("Today shows the planned session", page.locator(".hero h2").inner_text() == "Lower + pull")
    check("planned session is tagged PLANNED", page.locator(".hero .tag").first.inner_text().startswith("PLANNED"))
    check("location button on Today", "Home gym" in page.locator(".herepill").inner_text())
    check("lime labels really are lime", page.evaluate("getComputedStyle(document.querySelector('.label.acc') || document.body).color") in ("rgb(198, 244, 50)",)
          or page.locator(".label.acc").count() == 0)
    check("no sideways scrolling on Today", page.evaluate("document.scrollingElement.scrollWidth <= innerWidth"))
    check("day off: no duty line (the schedule note already says so)", page.locator(".loc.duty").count() == 0)
    pick_day(page, "2030-01-10")
    check("no roster entry: no duty line and no prompt", page.locator(".loc.duty").count() == 0)
    pick_day(page, "2030-01-08")
    shot(page, "today")


def t_workout(page):
    page.locator('[data-a="start"]').tap(); wait(page, 500)
    n = page.evaluate("P().sessions.find((s) => s.id === 's1').blocks.reduce((k, b) => k + b.items.length, 0)")
    check("workout screen lists every exercise", page.locator(".excard").count() == n, (page.locator(".excard").count(), n))
    check("supersets are grouped", page.locator(".exglabel").count() == 2, page.locator(".exglabel").count())
    check("first set editor open on the first exercise", page.locator(".excard.cur h2").inner_text() == "Kettlebell swing")
    for _ in range(3):
        page.locator(".excard.cur [data-a='logSet']").tap(); wait(page, 250)
    check("after the last swing set the editor moves to the leg press", page.locator(".excard.cur h2").inner_text() == "Leg press")
    page.locator(".excard.cur [data-a='logSet']").tap(); wait(page, 250)
    check("superset alternates to the partner exercise", page.locator(".excard.cur h2").inner_text() == "Pallof press")
    check("sets logged counter", "4 of" in page.locator(".session").inner_text())
    check("rest timer shows", page.locator("#rest.on").count() == 1)
    shot(page, "workout")
    page.locator('[data-a="finish"]').tap(); wait(page, 400)
    page.locator('[data-a="rpe"][data-n="7"]').tap(); wait(page, 150)
    page.locator('[data-a="saveSession"]').tap(); wait(page, 500)
    check("saved workout appears on Today", "Lower + pull" in page.locator(".last").inner_text())
    page.evaluate("A.go({v:'progress'})"); wait(page, 400)
    check("Progress counts the session", page.locator(".tile b").first.inner_text() == "1")
    check("Progress rows use their own style (not .lift)", page.locator("#app .lift").count() == 0)
    page.evaluate("A.go({v:'today'})"); wait(page)


def t_calendar(page):
    page.locator('[data-a="calMode"]').tap(); wait(page)
    check("month grid has 5 or 6 weeks", page.locator(".mday").count() in (35, 42), page.locator(".mday").count())
    check("month heading", "January 2030" in page.locator(".weekhead span").first.inner_text())
    pick_day(page, "2030-01-10")
    check("tapping a day shows its plan", page.locator(".hero h2").inner_text() == "Upper + hips")
    page.locator('[data-a="calMode"]').tap(); wait(page)
    check("back to the week strip on the picked day's week", page.locator(".day.on").get_attribute("data-d") == "2030-01-10")
    page.locator('[data-a="calMode"]').tap(); wait(page)


def t_roster(page):
    m = month(page)
    expect = {
        "2030-01-09": ("S2", True),     # home standby -> next session in the rotation (S1 was just logged)
        "2030-01-11": ("Snack", True),  # early report
        "2030-01-12": ("", False),      # normal report: no rule
        "2030-01-13": ("Hotel", True),  # layover
        "2030-01-14": ("Rest", True),   # overnight duty
        "2030-01-15": ("Rest", True),   # day after an overnight
        "2030-01-17": ("", False),      # 10:20 report: no rule
    }
    for k, (lb, auto) in expect.items():
        got = m.get(k, {})
        check(f"auto plan {k[-2:]} Jan = {lb or 'none'}", got.get("lb") == lb and got.get("auto") == auto, got)
    check("schedule wins over the roster (10 Jan stays PLANNED)", m["2030-01-10"]["lb"] == "S2" and not m["2030-01-10"]["auto"])
    check("duty markers", (m["2030-01-09"]["dt"], m["2030-01-11"]["dt"], m["2030-01-13"]["dt"], m["2030-01-16"]["dt"]) == ("SBH", "FLY", "ORD", "SBA"),
          [m[k]["dt"] for k in ("2030-01-09", "2030-01-11", "2030-01-13", "2030-01-16")])
    pick_day(page, "2030-01-11")
    duty = page.locator(".loc.duty").inner_text()
    check("duty line: report, leave-by, sectors, off", all(s in duty for s in ("report 05:45", "Leave by 03:45", "2 sectors", "off 12:30")), duty)
    check("auto day tagged AUTO", page.locator(".hero .tag").first.inner_text().startswith("AUTO"))
    pick_day(page, "2030-01-17")
    check("route shows on the duty line", "ORD-DEN" in page.locator(".loc.duty").inner_text())
    shot(page, "month")
    pick_day(page, "2030-01-18")
    d18 = page.locator(".loc.duty").inner_text()
    check("layover flying home: wake-up and pickup from the airport's pickup time", "Wake-up 14:15 · pickup 15:15" in d18 and "Leave by" not in d18, d18)
    pick_day(page, "2030-01-21")
    check("layover at an airport without a pickup time says so", "pickup time for DEN not set" in page.locator(".loc.duty").inner_text(), page.locator(".loc.duty").inner_text())
    pick_day(page, "2030-01-17")
    check("duty line is information only (no button, no sheet)", page.evaluate("document.querySelector('.loc.duty').tagName") == "DIV"
          and page.locator(".loc.duty [data-a]").count() == 0)
    check("no 'Duty changed' anywhere", "Duty changed" not in page.content())
    m = month(page)
    check("layover day with an overnight flight home: hotel session wins", m["2030-01-18"]["lb"] == "Hotel" and m["2030-01-18"]["auto"], m.get("2030-01-18"))
    check("…and the day after the overnight is rest", m["2030-01-19"]["lb"] == "Rest" and m["2030-01-19"]["auto"], m.get("2030-01-19"))


def t_layover_gym(browser, p, url):
    ctx, page = open_app(browser, p, url, 13)
    pill = page.locator(".herepill").inner_text()
    check("layover day: location switches to the ORD hotel", "Sample hotel ORD" in pill and "layover" in pill, pill)
    check("layover day: Hotel session suggested", page.locator(".hero h2").inner_text() == "Hotel – no gym")
    check("layover day: workout card uses the hotel's equipment", "Sample hotel ORD" in page.locator(".loc:not(.duty)").inner_text())
    page.locator('[data-a="start"]').tap(); wait(page, 400)
    check("workout started at the hotel", page.evaluate("S.active.gymId") == "ord-hotel")
    page.evaluate("S.active = null; save('active'); A.go({v:'today'})"); wait(page)
    page.locator(".herepill").tap(); wait(page)
    page.locator('[data-a="setGym"][data-g="home"]').tap(); wait(page, 400)
    pill = page.locator(".herepill").inner_text()
    check("choosing a place yourself wins for the day", "Home gym" in pill and "layover" not in pill, pill)
    shot(page, "layover")
    ctx.close()
    ctx, page = open_app(browser, p, url, 12)
    pick_day(page, "2030-01-13")
    check("future layover day previews the hotel gym", "Sample hotel ORD" in page.locator(".loc:not(.duty)").inner_text())
    check("…while today's location is unchanged", "Home gym" in page.locator(".herepill").inner_text())
    ctx.close()


def t_dumbbells(page):
    out = page.evaluate("""() => {
      const g = gym('ord-hotel'), item = P().sessions.find((s) => s.id === 'hotel').blocks[0].items[1]; // A2: one-arm DB row, then push-up
      S.logs['zz.json'] = { id: 'zz', start: new Date(Date.now() - 86400000).toISOString(), end: new Date().toISOString(), minutes: 30, sid: 'hotel', name: 't', gymName: 't',
        sets: [{ ex: 'db_row', slot: 'A2', n: 1, kg: 30, reps: 10 }], volume: 300 };
      invalidate();
      const r = resolve('hotel', item, g);
      const capped = prefill({ sets: 3, lo: 8, hi: 10 }, 'db_press', Object.assign({}, g, { equip: ['dumbbells'] }));
      S.logs['zy.json'] = { ...S.logs['zz.json'], id: 'zy', sets: [{ ex: 'db_press', slot: 'B1', n: 1, kg: 26, reps: 8 }] }; invalidate();
      const cap2 = prefill({ sets: 3, lo: 8, hi: 10 }, 'db_press', g);
      delete S.logs['zz.json']; delete S.logs['zy.json']; invalidate();
      return { ex: r.ex, why: r.why, kgs: cap2.sets.map((s) => s.kg), tip: cap2.tip && cap2.tip.kind, first: capped.tip && capped.tip.kind };
    }""")
    check("over the hotel's heaviest dumbbell: slot moves on", out["ex"] == "pushup" and "only go to 20" in out["why"], out)
    check("…or the weight is capped with a tip", max(out["kgs"]) == 20 and out["tip"] == "cap", out)
    check("no history: nothing capped", out["first"] == "first", out)
    # kg/lb switch in the gym editor
    page.evaluate("A.go({v:'gyms'})"); wait(page)
    page.locator('[data-a="editGym"][data-g="ord-hotel"]').tap(); wait(page, 400)
    check("dumbbell field shows 20 kg", page.locator("#gMax").input_value() == "20")
    page.locator('[data-a="gymUnit"][data-u="lb"]').tap(); wait(page, 200)
    lb = page.locator("#gMax").input_value()
    page.locator('[data-a="gymUnit"][data-u="kg"]').tap(); wait(page, 200)
    check("kg → lb → kg without drift", lb == "44" and page.locator("#gMax").input_value() == "20", lb)
    page.evaluate("closeSheet(); A.go({v:'today'})"); wait(page)


def main():
    srv, url = serve()
    with sync_playwright() as p:
        browser = p.webkit.launch()
        ctx, page = open_app(browser, p, url, 8)
        for t in (t_basics, t_workout, t_calendar, t_roster, t_dumbbells):
            try:
                t(page)
            except Exception as e:  # keep going so one failure doesn't hide the rest
                check(f"{t.__name__} ran to the end", False, repr(e)[:300])
        ctx.close()
        try:
            t_layover_gym(browser, p, url)
        except Exception as e:
            check("t_layover_gym ran to the end", False, repr(e)[:300])
        browser.close()
    srv.shutdown()
    for name, ok, detail in results:
        print(("PASS " if ok else "FAIL ") + name + ("" if ok or detail == "" else f"  -> {str(detail)[:300]}"))
    print("page errors:", errors or "none")
    fails = sum(1 for _, ok, _ in results if not ok)
    print(f"{len(results) - fails}/{len(results)} passed")
    return 1 if fails or errors else 0


if __name__ == "__main__":
    sys.exit(main())
