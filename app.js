'use strict';
/* Train – workout tracker. Data lives in a private GitHub repo; this device keeps a copy and a queue of changes. */

const APP_VERSION = '1.9.2';
const DEV = /[?&]dev\b/.test(location.search);
const DEV_BASE = /[?&]dev=fixtures\b/.test(location.search) ? 'tests/fixtures/' : '../train-data/';
const FILES = ['programme', 'gyms', 'plan', 'coros', 'body', 'schedule', 'roster'];
const DAY = 86400000;

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('tr_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tr_' + k, JSON.stringify(v)); } catch (e) { toast('Storage full – export a backup'); } },
};
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fmtNum = (n) => (n == null || isNaN(n)) ? '–' : (Math.round(n * 10) / 10).toString();
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const LB = 2.20462;
const U = () => (S.cfg.unit === 'lb' ? 'lb' : 'kg');
const W = (kg) => (kg == null || isNaN(kg) ? kg : U() === 'lb' ? Math.round(kg * LB * 2) / 2 : Math.round(kg * 10) / 10);
const toKg = (v) => (v == null || isNaN(v) ? v : U() === 'lb' ? Math.round((v / LB) * 1000) / 1000 : v);
const lbStep = (incKg) => { const x = incKg * LB; return x < 4 ? 2.5 : Math.round(x / 5) * 5; };
const stepU = (incKg) => (U() === 'lb' ? lbStep(incKg) : incKg);
function fmtVol(v) { if (U() === 'lb') { const w = v * LB; return w >= 10000 ? (w / 1000).toFixed(1) + 'k lb' : Math.round(w) + ' lb'; } return v >= 1000 ? fmtNum(v / 1000) + ' t' : Math.round(v) + ' kg'; }
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shortDate = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const ago = (ts) => { if (!ts) return 'never'; const m = Math.round((Date.now() - ts) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; return Math.round(h / 24) + ' d ago'; };
function b64enc(s) { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]); return btoa(bin); }
function b64dec(s) { const bin = atob(String(s).replace(/\s/g, '')); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); }

const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>', check: '<path d="M5 12l5 5L20 7"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>', up: '<path d="M12 19V5M5 12l7-7 7 7"/>', play: '',
  today: '<path d="M6.5 6.5h11M6.5 17.5h11M3 9v6M21 9v6M6.5 6.5v11M17.5 6.5v11"/>', progress: '<path d="M4 19l5-6 4 3 7-9"/>',
  plan: '<path d="M8 3v18M4 7h8M16 3v18M12 15h8"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  plane: '<path d="M10.5 4.5a1.5 1.5 0 0 1 3 0V10l7 4.5v2l-7-2.5v4.5l2 1.5v1.5L12 20.5 8.5 21.5V20l2-1.5V14l-7 2.5v-2l7-4.5z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 13 3.5 3.5 0 0 0 6 19z"/>',
};
const ic = (n, sz = 20, sw = 2.2, extra = '') => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${I[n]}</svg>`;
const playIc = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';

const EQUIP = [['dumbbells', 'Dumbbells'], ['bench', 'Bench'], ['barbell', 'Barbell'], ['cable', 'Cable'], ['lat_pulldown', 'Lat pulldown'], ['smith', 'Smith'], ['leg_press', 'Leg press'], ['hack_squat', 'Hack squat'], ['leg_curl', 'Leg curl'], ['leg_ext', 'Leg extension'], ['ghd', 'GHD'], ['back_ext', 'Back extension'], ['pullup_bar', 'Pull-up bar'], ['dip_station', 'Dip station'], ['kettlebell', 'Kettlebells'], ['box', 'Plyo box'], ['med_ball', 'Med ball'], ['band', 'Bands'], ['vest', 'Weight vest'], ['calf_machine', 'Calf machine'], ['seated_calf', 'Seated calf'], ['hip_thrust', 'Hip thrust'], ['row_machine', 'Row machine'], ['chest_press', 'Chest press'], ['shoulder_press', 'Shoulder press'], ['pec_deck', 'Pec deck'], ['trap_bar', 'Trap bar'], ['rack', 'Squat rack'], ['ab_wheel', 'Ab wheel'], ['bike', 'Bike'], ['rower', 'Rower'], ['treadmill', 'Treadmill']];
const EQ_NAME = Object.fromEntries(EQUIP);

/* ---------- state ---------- */
const S = {
  cfg: Object.assign({ owner: '', repo: 'train-data', token: '', rest: 90, sound: true, unit: 'kg' }, LS.get('cfg', {})),
  data: LS.get('data', null),
  logs: LS.get('logs', {}),
  queue: LS.get('queue', []),
  active: LS.get('active', null),
  lastSync: LS.get('lastSync', null),
  syncErr: null, syncing: false,
  view: 'today', pick: null, gen: LS.get('gen', null), cal: LS.get('cal', 'week'), progFilter: 'main', editing: null, sheet: null, cache: null,
};
function save(...keys) { for (const k of keys) LS.set(k, S[k]); }
const configured = () => DEV || (S.cfg.owner && S.cfg.repo && S.cfg.token);
function invalidate() { S.cache = null; }

/* ---------- GitHub ---------- */
const GH = {
  url(path) { return `https://api.github.com/repos/${encodeURIComponent(S.cfg.owner)}/${encodeURIComponent(S.cfg.repo)}/contents/${path}`; },
  async req(path, opt = {}) {
    const headers = { Authorization: 'Bearer ' + S.cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.body) headers['Content-Type'] = 'application/json';
    return fetch(this.url(path) + (opt.method ? '' : `?t=${Date.now()}`), { ...opt, headers, cache: 'no-store' });
  },
  async get(path) {
    const r = await this.req(path);
    if (r.status === 404) return null;
    if (!r.ok) { const e = new Error(r.status === 401 ? 'GitHub key rejected' : 'GitHub error ' + r.status); e.status = r.status; throw e; }
    return r.json();
  },
  async put(path, obj, sha, msg) {
    const body = { message: msg || 'Update ' + path, content: b64enc(JSON.stringify(obj, null, 1) + '\n') };
    if (sha) body.sha = sha;
    const r = await this.req(path, { method: 'PUT', body: JSON.stringify(body) });
    if (!r.ok) { const e = new Error('GitHub error ' + r.status); e.status = r.status; throw e; }
    return r.json();
  },
};

async function pullAll() {
  const next = Object.assign({}, S.data || {});
  if (DEV) {
    for (const f of FILES) { try { const r = await fetch(DEV_BASE + f + '.json', { cache: 'no-store' }); if (r.ok) next[f] = await r.json(); } catch (e) { /* offline */ } }
    Object.assign(next, LS.get('devfiles', {})); // dev mode: file edits saved in this browser, never sent to GitHub
  } else {
    const got = await Promise.all(FILES.map((f) => GH.get(f + '.json').then((j) => [f, j])));
    for (const [f, j] of got) if (j && j.content) next[f] = JSON.parse(b64dec(j.content));
    const list = await GH.get('logs');
    if (Array.isArray(list)) {
      const missing = list.filter((it) => it.name.endsWith('.json') && !S.logs[it.name]);
      for (let i = 0; i < missing.length; i += 6) {
        const batch = await Promise.all(missing.slice(i, i + 6).map((it) => GH.get('logs/' + it.name).then((j) => [it.name, j])));
        for (const [n, j] of batch) if (j && j.content) S.logs[n] = JSON.parse(b64dec(j.content));
      }
    }
  }
  for (const q of S.queue) if (q.kind === 'file') next[q.name] = q.data; // local changes not yet uploaded win
  if (!next.body) next.body = { entries: [] };
  S.data = next; save('data', 'logs'); invalidate();
}

async function pushQueue() {
  while (S.queue.length) {
    const q = S.queue[0];
    if (DEV) { if (q.kind === 'file') { const o = LS.get('devfiles', {}); o[q.name] = q.data; LS.set('devfiles', o); } S.queue.shift(); save('queue'); continue; }
    if (q.kind === 'log') {
      const path = 'logs/' + q.name;
      try { await GH.put(path, q.data, null, 'Log ' + q.name); }
      catch (e) { if (e.status === 422 || e.status === 409) { const ex = await GH.get(path); await GH.put(path, q.data, ex && ex.sha, 'Log ' + q.name); } else throw e; }
    } else {
      const ex = await GH.get(q.name + '.json');
      await GH.put(q.name + '.json', q.data, ex && ex.sha, 'Update ' + q.name + ' from app');
    }
    S.queue.shift(); save('queue');
  }
}

function enqueue(item) {
  if (item.kind === 'file') S.queue = S.queue.filter((q) => !(q.kind === 'file' && q.name === item.name));
  S.queue.push(item); save('queue'); syncSoon();
}

let syncTimer = null;
function syncSoon(ms = 400) { clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms); }
async function sync(manual) {
  if (!configured()) { if (manual) toast('Connect GitHub in Settings first'); return; }
  if (!navigator.onLine && !DEV) { if (manual) toast('Offline – will sync when you have signal'); renderStatus(); return; }
  if (S.syncing) return;
  S.syncing = true; renderStatus();
  try {
    await pushQueue();
    await pullAll();
    S.lastSync = Date.now(); S.syncErr = null; save('lastSync');
    if (manual) toast('Synced');
    if (!S.active || S.view !== 'session') render();
  } catch (e) {
    S.syncErr = e.message || 'Sync failed';
    if (manual) toast(S.syncErr);
  } finally { S.syncing = false; renderStatus(); }
}
window.addEventListener('online', () => syncSoon(800));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncSoon(1200); wake(); tick(); setTimeout(nudgeViewport, 60); } });

/* ---------- programme helpers ---------- */
const P = () => S.data.programme;
function EX(id) {
  if (id && id.startsWith('custom:')) return { name: id.slice(7), type: 'load', equip: [[]], inc: 2.5, custom: true };
  return (P().exercises[id]) || { name: id, type: 'load', equip: [[]], inc: 2.5 };
}
const gyms = () => S.data.gyms.gyms;
function gym(id) { const g = S.data.gyms; return g.gyms.find((x) => x.id === (id || hereId())) || g.gyms[0]; }
/* where you are: on a layover day the roster's nightstop picks the hotel with that airport code, unless you chose a place yourself today */
function rosterGymId(d) {
  const r = S.data.roster && S.data.roster.days ? S.data.roster.days[ymd(d)] : null;
  if (!r || r.duty !== 'LAYOVER' || !r.nightstop) return null;
  const code = String(r.nightstop).trim().toUpperCase(), x = S.data.gyms.gyms.find((y) => !y.archived && (y.airport || '').toUpperCase() === code);
  return x ? x.id : null;
}
const hereAuto = () => (LS.get('hereSet', null) === ymd(today0()) ? null : rosterGymId(today0()));
const hereId = () => hereAuto() || S.data.gyms.current;
const dayGym = (d) => (ymd(d) === ymd(today0()) ? gym() : gym(rosterGymId(d) || undefined));
const hasEquip = (ex, g) => (ex.equip || [[]]).some((req) => req.every((e) => (g.equip || []).includes(e)));
function missingFor(ex, g) { const req = (ex.equip || [[]])[0] || []; return req.filter((e) => !(g.equip || []).includes(e)).map((e) => EQ_NAME[e] || e); }
/* dumbbell limit: the equipment option this gym uses for an exercise, and whether your last top weight is beyond its heaviest dumbbell */
const usesDB = (ex, g) => { const req = (ex.equip || [[]]).find((r) => r.every((e) => (g.equip || []).includes(e))); return !!(req && req.includes('dumbbells')); };
function overDB(id, g) {
  if (!(g.maxDB > 0) || !usesDB(EX(id), g)) return false;
  const last = lastFor(id); return !!last && Math.max(...last.sets.map((s) => s.kg || 0)) > g.maxDB;
}
function resolve(sid, item, g) {
  const key = sid + ':' + item.slot;
  const rem = g.swaps && g.swaps[key];
  if (rem && (rem.startsWith('custom:') || hasEquip(EX(rem), g))) return { ex: rem, swapped: rem !== item.ex[0], why: 'your choice here' };
  const avail = item.ex.filter((id) => hasEquip(EX(id), g));
  const fits = avail.find((id) => !overDB(id, g)) || avail[0];
  if (fits) {
    const skipped = item.ex.slice(0, item.ex.indexOf(fits));
    const why = !skipped.length ? '' : skipped.some((id) => hasEquip(EX(id), g)) ? `dumbbells here only go to ${fmtNum(W(g.maxDB))} ${U()}` : 'no ' + missingFor(EX(item.ex[0]), g).join(', ').toLowerCase();
    return { ex: fits, swapped: fits !== item.ex[0], why };
  }
  const lastEx = item.ex[item.ex.length - 1];
  return { ex: lastEx, swapped: item.ex.length > 1, why: 'needs ' + missingFor(EX(lastEx), g).join(', ').toLowerCase() };
}
const session = (sid) => { if (S.gen && S.gen.id === sid && S.gen.gymId !== gym().id) generate(S.gen.focus); return sessionRaw(sid); };
const sessionRaw = (sid) => (sid === 'snack' ? (S.snackShuffle && S.snackShuffle.key === 'snack-' + ymd(today0()) + '-' + gym().id ? S.snackShuffle : dailySnack()) : S.gen && S.gen.id === sid ? S.gen : P().sessions.find((s) => s.id === sid));
const GEN = {
  full: { name: 'Full body', slots: [['squat', 'glute'], ['hpush'], ['hinge', 'hamstring', 'glute'], ['hpull', 'vpull'], ['core', 'antirot']] },
  upper: { name: 'Upper body', slots: [['hpush'], ['hpull'], ['vpush'], ['vpull', 'reardelt'], ['core', 'antirot']] },
  lower: { name: 'Lower body', slots: [['squat'], ['hinge', 'glute'], ['squat', 'hamstring'], ['calf'], ['core', 'antirot']] },
  snack: { name: 'Strength snack', slots: [['hpush', 'vpush'], ['hpull', 'vpull'], ['core', 'antirot', 'carry']], sets: 3, minutes: 10 },
  core: { name: 'Core & carry', slots: [['antirot'], ['core'], ['carry'], ['core'], ['reardelt', 'glute']] },
};
function seeded(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
function dailySnack() {
  const key = 'snack-' + ymd(today0()) + '-' + gym().id;
  if (S.snack && S.snack.key === key) return S.snack;
  const keep = S.gen; generate('snack', seeded(key)); S.snack = { ...S.gen, key, id: 'snack' }; S.gen = keep; LS.set('gen', keep);
  return S.snack;
}
function generate(focus, rnd) {
  rnd = rnd || Math.random;
  const g = gym(), all = P().exercises, def = GEN[focus] || GEN.full;
  const recent = new Set(stats().logs.filter((l) => Date.now() - new Date(l.start).getTime() < 2 * DAY).flatMap((l) => l.sets.map((s) => s.ex)));
  const used = new Set(), usedPat = new Set(); const items = [];
  def.slots.forEach((pats, i) => {
    const ok = (id, pt) => all[id].pattern === pt && !all[id].power && id !== 'dead_hang' && hasEquip(all[id], g) && !used.has(id);
    let pool = [];
    for (const pt of pats) { if (usedPat.has(pt) && pats.length > 1) continue; pool = Object.keys(all).filter((id) => ok(id, pt)); if (pool.length) { usedPat.add(pt); break; } }
    if (!pool.length) pool = Object.keys(all).filter((id) => pats.some((pt) => ok(id, pt)));
    const fresh = pool.filter((id) => !recent.has(id)); if (fresh.length) pool = fresh;
    if (!pool.length) return;
    const id = pool[Math.floor(rnd() * pool.length)]; used.add(id);
    const ex = all[id];
    const t = ex.type === 'time' ? { target: '30 s', lo: 30, hi: 40 } : ex.type === 'carry' ? { target: '30 m', lo: 30, hi: 40 } : { target: '8–12', lo: 8, hi: 12 };
    items.push({ slot: String.fromCharCode(65 + i), ex: [id], sets: def.sets || 2, ...t });
  });
  S.lastGen = S.gen = { gymId: g.id, id: 'gen-' + focus, name: focus === 'snack' ? 'Strength snack' : '10-min ' + def.name.toLowerCase(), label: focus === 'snack' ? 'Snack' : 'Quick workout', minutes: def.minutes || 10, quick: true, focus, blocks: [{ key: 'C', circuit: true, items }] };
  LS.set('gen', S.gen);
  return S.gen.id;
}

/* ---------- history & metrics ---------- */
function logsSorted() { return Object.values(S.logs).sort((a, b) => (a.start < b.start ? 1 : -1)); }
function bodyKg() { const e = (S.data.body && S.data.body.entries) || []; return e.length ? e[e.length - 1].kg : null; }
function score(exId, s) {
  const ex = EX(exId);
  switch (ex.type) {
    case 'load': return (s.kg || 0) > 0 && s.reps ? s.kg * (1 + s.reps / 30) : (s.reps || 0) * 0.01;
    case 'bw': return ((bodyKg() || 75) + (s.kg || 0)) * (1 + (s.reps || 0) / 30);
    case 'carry': return (s.kg || 0) * (s.m || 0);
    case 'time': return s.sec || 0;
    default: return s.reps || 0;
  }
}
function e1rm(exId, s) { const ex = EX(exId); if (ex.type === 'load' && s.kg && s.reps) return s.kg * (1 + s.reps / 30); if (ex.type === 'bw' && s.reps) return ((bodyKg() || 75) + (s.kg || 0)) * (1 + s.reps / 30); return null; }
function volume(log) {
  let v = 0;
  for (const s of log.sets) { const ex = EX(s.ex); if ((ex.type === 'load') && s.kg && s.reps) v += s.kg * s.reps * (ex.perDB ? 2 : 1) * (ex.perSide ? 2 : 1); if (ex.type === 'bw' && s.reps) v += ((bodyKg() || 75) + (s.kg || 0)) * s.reps; }
  return v;
}
function stats() {
  if (S.cache) return S.cache;
  const logs = logsSorted();
  const byEx = {}; // ex -> [{date, best, sets}]
  for (const l of [...logs].reverse()) {
    const per = {};
    for (const s of l.sets) { (per[s.ex] = per[s.ex] || []).push(s); }
    for (const [ex, sets] of Object.entries(per)) {
      let best = null, bs = 0;
      for (const s of sets) { const sc = score(ex, s); if (sc > bs) { bs = sc; best = s; } }
      (byEx[ex] = byEx[ex] || []).push({ date: l.start, score: bs, best, sets, e1: best ? e1rm(ex, best) : null, log: l.id });
    }
  }
  const prs = {};
  for (const [ex, arr] of Object.entries(byEx)) { let m = 0; for (const h of arr) { if (h.score > m) { if (m > 0) h.pr = true; m = h.score; } } prs[ex] = m; }
  S.cache = { logs, byEx, prs };
  return S.cache;
}
function lastFor(exId) { for (const l of stats().logs) { const sets = l.sets.filter((s) => s.ex === exId).sort((a, b) => a.n - b.n); if (sets.length) return { log: l, sets }; } return null; }

function prefill(item, exId, g) {
  const pf = prefillRaw(item, exId);
  if (!g || !(g.maxDB > 0) || !usesDB(EX(exId), g)) return pf;
  const want = Math.max(0, ...pf.sets.map((s) => s.kg || 0));
  if (want <= g.maxDB) return pf;
  pf.sets.forEach((s) => { if ((s.kg || 0) > g.maxDB) s.kg = g.maxDB; });
  pf.tip = { kind: 'cap', exId, max: g.maxDB, want };
  return pf;
}
function prefillRaw(item, exId) {
  const ex = EX(exId), last = lastFor(exId), n = item.sets;
  const lo = item.lo || 8, hi = item.hi || lo;
  const out = []; let tip = null, progress = false;
  if (!last) {
    for (let i = 0; i < n; i++) {
      if (ex.type === 'time') out.push({ sec: lo });
      else if (ex.type === 'carry') out.push({ kg: 0, m: lo });
      else if (ex.type === 'reps') out.push({ reps: lo });
      else out.push({ kg: 0, reps: lo });
    }
    tip = { kind: 'first', exId };
    return { sets: out, tip };
  }
  const L = last.sets;
  const metric = (s) => ex.type === 'time' ? s.sec : ex.type === 'carry' ? s.m : s.reps;
  progress = L.length >= Math.min(n, L.length) && L.every((s) => (metric(s) || 0) >= hi);
  const topKg = Math.max(...L.map((s) => s.kg || 0));
  const inc = ex.inc || 2.5;
  const nextKg = U() === 'lb' ? toKg(Math.round(topKg * LB / 2.5) * 2.5 + lbStep(inc)) : topKg + inc;
  for (let i = 0; i < n; i++) {
    const p = L[i] || L[L.length - 1];
    if (ex.type === 'time') out.push({ sec: progress ? (p.sec || lo) + 5 : (p.sec || lo) });
    else if (ex.type === 'reps') out.push({ reps: progress ? (p.reps || lo) + 1 : (p.reps || lo) });
    else if (ex.type === 'carry') out.push({ kg: progress ? nextKg : (p.kg ?? topKg), m: p.m || lo });
    else out.push({ kg: progress ? nextKg : (p.kg ?? topKg), reps: progress ? lo : (p.reps || lo) });
  }
  tip = progress ? { kind: 'up', exId, hi, nextKg } : { kind: 'info', exId, date: last.log.start, sets: L };
  return { sets: out, tip, last: L };
}
function tipHtml(t) {
  if (!t) return '';
  const ex = EX(t.exId);
  if (t.kind === 'first') return esc(ex.cue ? ex.cue + ' First time logged – start steady.' : (ex.type === 'load' || ex.type === 'carry' ? 'First time logged. Pick a weight that leaves 1–2 reps in reserve.' : 'First time logged.'));
  if (t.kind === 'cap') return `Heaviest dumbbell here is ${fmtNum(W(t.max))} ${U()} (you'd go ${fmtNum(W(t.want))}). <b>Use ${fmtNum(W(t.max))} and add reps or slow the lowering.</b>`;
  if (t.kind === 'up') {
    if (['load', 'carry', 'bw'].includes(ex.type)) return `Hit ${t.hi} on every set last time. <b>Go to ${ex.type === 'bw' ? '+' : ''}${fmtNum(W(t.nextKg))} ${U()}${ex.perDB ? ' per dumbbell' : ''}.</b>`;
    return `Hit the top of the range last time. <b>Add a rep or ${ex.type === 'time' ? '5 s' : 'slow it down'}.</b>`;
  }
  return `Last time (${shortDate(t.date)}): ${esc(t.sets.map((s) => setText(t.exId, s, true)).join(', '))}. Beat one set today.`;
}
function setText(exId, s, short) {
  const ex = EX(exId);
  switch (ex.type) {
    case 'load': return `${fmtNum(W(s.kg))}${short ? '' : ' ' + U()} × ${s.reps ?? '–'}`;
    case 'bw': return `${s.kg ? '+' + fmtNum(W(s.kg)) : 'BW'} × ${s.reps ?? '–'}`;
    case 'carry': return `${fmtNum(W(s.kg))} ${U()} · ${s.m ?? '–'} m`;
    case 'time': return `${s.sec ?? '–'} s`;
    default: return `${s.reps ?? '–'} reps`;
  }
}

/* ---------- plan helpers ---------- */
function phaseNow() {
  const plan = S.data.plan; if (!plan) return null;
  const t = today0();
  const i = plan.phases.findIndex((p) => t >= parseD(p.start) && t <= parseD(p.end));
  if (i < 0) return null;
  const p = plan.phases[i];
  const total = Math.max(1, Math.round((parseD(p.end) - parseD(p.start) + DAY) / (7 * DAY)));
  const wk = Math.min(total, Math.floor((t - parseD(p.start)) / (7 * DAY)) + 1);
  return { ...p, index: i, wk, total, frac: Math.min(1, (t - parseD(p.start) + DAY) / (parseD(p.end) - parseD(p.start) + DAY)) };
}
function nextSessionId() {
  const rot = P().rotation || ['s1', 's2', 's3'];
  const last = stats().logs.find((l) => rot.includes(l.sid));
  if (!last) return rot[0];
  return rot[(rot.indexOf(last.sid) + 1) % rot.length];
}
function doneThisBlock() { const since = Date.now() - 8 * DAY; return stats().logs.filter((l) => new Date(l.start).getTime() >= since && (P().rotation || []).includes(l.sid)).length; }

const toTop = () => window.scrollTo(0, 0);
/* iOS home-screen apps can start with a viewport one status-bar short, which lifts the bottom bar.
   A tiny scroll makes iOS re-measure the screen. */
function nudgeViewport() { if (S.sheet) return; const y = window.scrollY; window.scrollTo(0, y + 1); requestAnimationFrame(() => window.scrollTo(0, y)); }
window.addEventListener('pageshow', () => setTimeout(nudgeViewport, 60));
window.addEventListener('orientationchange', () => setTimeout(nudgeViewport, 300));
/* ---------- render: shell ---------- */
function render() {
  if (!S.data || !S.data.programme) { S.view = configured() ? 'loading' : 'settings'; }
  const app = $('#app');
  const v = S.view;
  let html = '';
  if (v === 'loading') html = `<div class="empty" style="padding-top:38vh">Loading your programme…</div>`;
  else if (v === 'today') html = vToday();
  else if (v === 'session') html = vSession();
  else if (v === 'progress') html = vProgress();
  else if (v === 'plan') html = vPlan();
  else if (v === 'gyms') html = vGyms();
  else if (v === 'settings') html = vSettings();
  else if (v === 'choose') html = vChoose();
  app.innerHTML = html;
  if (v === S.shown && app.firstElementChild) app.firstElementChild.classList.add('still');
  S.shown = v;
  renderNav(); renderRest();
  if (S.follow) { const jump = S.follow === 'jump'; S.follow = false; if (v === 'session') requestAnimationFrame(() => followCur(jump)); }
}
function renderNav() {
  const nav = $('#nav');
  const show = ['today', 'progress', 'plan'].includes(S.view) && S.data && S.data.programme;
  nav.style.display = show ? '' : 'none';
  if (!show) return;
  nav.innerHTML = [['today', 'Today'], ['progress', 'Progress'], ['plan', 'Plan']].map(([k, l]) =>
    `<button data-a="go" data-v="${k}" class="${S.view === k ? 'on' : ''}" aria-current="${S.view === k ? 'page' : 'false'}">${ic(k, 22, 2)}${l}</button>`).join('');
}
function statusLine() {
  if (!configured()) return `<button class="row small mute" data-a="go" data-v="settings" style="padding:14px 6px"><span class="syncdot off"></span>Not connected to GitHub – tap to set up</button>`;
  const n = S.queue.length;
  const dot = S.syncErr ? 'pend' : n ? 'pend' : '';
  const txt = S.syncing ? 'Syncing…' : S.syncErr ? `${esc(S.syncErr)}${n ? ` · ${n} waiting` : ''}` : n ? `${n} change${n > 1 ? 's' : ''} waiting to sync` : `Synced ${ago(S.lastSync)}`;
  return `<button class="row small mute" data-a="sync" style="padding:14px 6px;width:100%"><span class="syncdot ${dot}"></span><span class="grow" style="text-align:left">${txt}</span>${DEV ? '<span class="tag amb">DEV</span>' : ''}</button>`;
}
function renderStatus() { const el = $('#status'); if (el) el.innerHTML = statusLine(); }

/* ---------- view: today ---------- */
const unitSeg = () => `<div class="seg" role="group" aria-label="Weight unit"><button data-a="unit" data-u="kg" class="${U() === 'kg' ? 'on' : ''}">kg</button><button data-a="unit" data-u="lb" class="${U() === 'lb' ? 'on' : ''}">lb</button></div>`;
const SHORT = { s1: 'S1', s2: 'S2', s3: 'S3', hotel: 'Hotel', snack: 'Snack' };
function schedDay(d) { const s = S.data.schedule; return s && s.days ? s.days[ymd(d)] || null : null; }
/* ---------- roster: duties from roster.json, and sessions suggested from them ---------- */
const DUTY = { FLY: 'Flying', LAYOVER: 'Layover', OFF: 'Day off', STBH: 'Home standby', STBA: 'Airport standby' };
const DUTY_TAG = { FLY: 'FLY', LAYOVER: 'LAY', STBH: 'SBH', STBA: 'SBA' };
const RULES_DEFAULT = { earlyReportBefore: '07:00', early: 'snack', layover: 'hotel', overnight: 'rest', standby: 'rotation', leaveMinutes: 120 };
const rules = () => Object.assign({}, RULES_DEFAULT, (S.data.plan && S.data.plan.rosterRules) || {});
function rosterDay(d) { const r = S.data.roster; return r && r.days ? r.days[ymd(d)] || null : null; }
const hm = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
const hmStr = (min) => { min = ((min % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); };
const leaveBy = (r) => { const m = hm(r && r.report); return m == null ? null : hmStr(m - (+rules().leaveMinutes || 120)); };
/* flying home from a layover: hotel pickup = departure − that airport's pickupBeforeDeparture; wake-up call = pickup − wakeBeforePickup */
function pickup(r) {
  const R = rules(), dep = hm(r.dep), before = hm((R.pickupBeforeDeparture || {})[String(r.nightstop || '').toUpperCase()]);
  if (dep == null || before == null) return { known: false };
  const p = dep - before, wake = hm(R.wakeBeforePickup || '1:00') ?? 60;
  return { known: true, pickup: hmStr(p), wake: hmStr(p - wake) };
}
const sectorCount = (s) => (Array.isArray(s) ? s.length : +s || 0);
function sectorsText(r) {
  const n = sectorCount(r.sectors); if (!n) return '';
  return (Array.isArray(r.sectors) ? r.sectors.join(' · ') + ' · ' : '') + `${n} sector${n > 1 ? 's' : ''}`;
}
/* a suggestion for days schedule.json leaves empty, from the duty rules in plan.json "rosterRules" */
function autoPlan(d) {
  const r = rosterDay(d), prev = new Date(d); prev.setDate(d.getDate() - 1);
  const pr = rosterDay(prev), R = rules();
  let act = null, why = '';
  if (r && r.duty === 'LAYOVER') { act = R.layover; why = 'Layover' + (r.nightstop ? ' · ' + r.nightstop : ''); } // waking up away: the hotel session, even before an overnight home
  else if (r && r.overnight) { act = R.overnight; why = 'Overnight duty'; }
  else if (pr && pr.overnight) { act = R.overnight; why = 'Day after an overnight duty'; }
  else if (!r) return null;
  else if (r.duty === 'FLY') { const m = hm(r.report), e = hm(R.earlyReportBefore); if (m == null || e == null || m >= e) return null; act = R.early; why = 'Early report ' + r.report; }
  else if (r.duty === 'STBH' || r.duty === 'STBA') { act = R[r.duty] || R.standby; why = DUTY[r.duty]; }
  else return null;
  if (act == null) return null;
  const sid = act === 'rest' ? null : act === 'rotation' ? nextSessionId() : P().sessions.some((s) => s.id === act) ? act : null;
  return { sid, rest: act === 'rest', why };
}
/* what a day holds: the coach's schedule entry wins; otherwise the roster suggestion, marked auto */
function dayPlan(d) { const sd = schedDay(d); if (sd) return sd; const ap = autoPlan(d); return ap ? { sid: ap.sid, note: ap.why, auto: true, rest: ap.rest } : null; }
function dutyTag(d) {
  const r = rosterDay(d); if (!r || !DUTY_TAG[r.duty]) return '';
  const txt = r.duty === 'LAYOVER' && r.nightstop ? String(r.nightstop).slice(0, 4) : DUTY_TAG[r.duty];
  return `<span class="dt ${r.duty.toLowerCase()}">${esc(txt)}</span>`;
}
function dutyRow(d) {
  const r = rosterDay(d);
  // the roster comes from the calendar (train-data/tools/roster_import.py); days off are already in the schedule note
  if (!r || r.duty === 'OFF') return '';
  let main = DUTY[r.duty] || r.duty;
  if (r.duty === 'LAYOVER' && r.nightstop) main += ' · ' + r.nightstop;
  const standby = r.duty === 'STBH' || r.duty === 'STBA';
  if (r.report) main += standby ? ` · ${r.report}${r.off ? '–' + r.off : ''}` : ` · report ${r.report}`;
  const sub = [];
  if (r.duty === 'LAYOVER' && sectorCount(r.sectors)) {
    const pk = pickup(r);
    sub.push(pk.known ? `<span class="leave">Wake-up ${pk.wake} · pickup ${pk.pickup}</span>` : `<span>pickup time for ${esc(r.nightstop || 'this airport')} not set</span>`);
  } else {
    const lb = r.report && ['FLY', 'STBA'].includes(r.duty) ? leaveBy(r) : null;
    if (lb) sub.push(`<span class="leave">Leave by ${lb}</span>`);
  }
  const sec = sectorsText(r); if (sec) sub.push(esc(sec));
  if (r.off && !standby) sub.push(`off ${esc(r.off)}${r.overnight ? ' next day' : ''}`);
  else if (r.overnight) sub.push('overnight');
  return `<div class="loc duty" role="note" aria-label="Duty: ${esc(main)}">${ic('plane', 18, 2, `style="color:var(--${r.duty === 'OFF' ? 'mute' : 'amber'})"`)}<span class="grow"><span style="display:block;font-size:15px;font-weight:600">${esc(main)}</span>${sub.length ? `<span class="small mute" style="display:block;margin-top:2px">${sub.join(' · ')}</span>` : ''}</span></div>`;
}
function loggedOn(d) { const k = ymd(d); return stats().logs.filter((l) => ymd(new Date(l.start)) === k); }
const dayLabel = (sd) => sd && sd.sid ? SHORT[sd.sid] || sd.sid : sd ? (/bike|ride|spin/i.test(sd.other || '') ? 'Ride' : 'Rest') : '';
const calBtn = () => `<button class="iconbtn sm calbtn ${S.cal === 'month' ? 'on' : ''}" data-a="calMode" aria-label="${S.cal === 'month' ? 'Show one week' : 'Show the whole month'}" aria-pressed="${S.cal === 'month'}">${ic('cal', 16)}</button>`;
function weekStrip(t0, sel) {
  if (S.cal === 'month') return monthGrid(t0, sel);
  const ws = weekStart(t0); ws.setDate(ws.getDate() + 7 * (S.weekOff || 0));
  let h = `<div class="weekhead"><button class="iconbtn sm" data-a="weekNav" data-d="-1" aria-label="Previous week">${ic('back', 16)}</button><span class="small mute grow" style="text-align:center">${S.weekOff ? (S.weekOff > 0 ? 'Next week' : 'Last week') : 'This week'} · ${ws.getDate()} ${MON[ws.getMonth()]}</span><button class="iconbtn sm" data-a="weekNav" data-d="1" aria-label="Next week">${ic('chev', 16)}</button>${calBtn()}</div><div class="week">`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws); d.setDate(ws.getDate() + i);
    const sd = dayPlan(d), done = loggedOn(d).length, k = ymd(d);
    h += `<button class="day ${k === ymd(sel) ? 'on' : ''} ${k === ymd(t0) ? 'today' : ''} ${sd && sd.sid ? 'lift' : ''} ${sd && sd.auto ? 'auto' : ''}" data-a="selDay" data-d="${k}"><span class="dl">${DOW[d.getDay()][0]}</span><span class="dn">${d.getDate()}</span><span class="lb">${dayLabel(sd)}</span>${dutyTag(d)}${done ? '<i class="done"></i>' : ''}</button>`;
  }
  return h + '</div>';
}
/* month calendar: Monday-first grid of the whole month, same labels and tap-to-select as the week strip */
function monthGrid(t0, sel) {
  const m0 = new Date(t0.getFullYear(), t0.getMonth() + (S.monthOff || 0), 1);
  const gs = weekStart(m0), end = new Date(m0.getFullYear(), m0.getMonth() + 1, 0);
  const weeks = Math.ceil((end - gs + DAY) / (7 * DAY));
  let h = `<div class="weekhead"><button class="iconbtn sm" data-a="monthNav" data-d="-1" aria-label="Previous month">${ic('back', 16)}</button><span class="small mute grow" style="text-align:center">${S.monthOff ? '' : 'This month · '}${MONTH[m0.getMonth()]} ${m0.getFullYear()}</span><button class="iconbtn sm" data-a="monthNav" data-d="1" aria-label="Next month">${ic('chev', 16)}</button>${calBtn()}</div>
    <div class="month">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span class="mdow">${x}</span>`).join('')}`;
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(gs); d.setDate(gs.getDate() + i);
    const sd = dayPlan(d), done = loggedOn(d).length, k = ymd(d), out = d.getMonth() !== m0.getMonth(), rd = rosterDay(d);
    h += `<button class="mday ${out ? 'out' : ''} ${k === ymd(sel) ? 'on' : ''} ${k === ymd(t0) ? 'today' : ''} ${sd && sd.sid ? 'lift' : ''} ${sd && sd.auto ? 'auto' : ''}" data-a="selDay" data-d="${k}" aria-label="${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}${rd ? ' · ' + (DUTY[rd.duty] || rd.duty) : ''}${sd ? ' · ' + dayLabel(sd) + (sd.auto ? ' (auto)' : '') : ''}${done ? ' · logged' : ''}"><span class="dn">${d.getDate()}</span><span class="lb">${dayLabel(sd)}</span>${dutyTag(d)}${done ? '<i class="done"></i>' : ''}</button>`;
  }
  return h + '</div>';
}
function vToday() {
  const d = new Date(), t0 = today0();
  const sel = S.selDay ? parseD(S.selDay) : t0;
  const isToday = ymd(sel) === ymd(t0);
  const selName = isToday ? 'today' : `${DOW[sel.getDay()].slice(0, 3)} ${sel.getDate()} ${MON[sel.getMonth()]}`;
  const ph = phaseNow();
  const ring = ph ? (() => { const c = 2 * Math.PI * 24, f = ph.wk / ph.total; return `<div class="ring-wrap" aria-label="Week ${ph.wk} of ${ph.total} in ${esc(ph.name)}"><svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="#1C2027" stroke-width="5"/><circle cx="28" cy="28" r="24" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/></svg><div class="lab"><b>${ph.wk}/${ph.total}</b><small>WEEK</small></div></div>`; })() : '';
  let h = `<div class="view"><div class="head"><div><div class="sub">${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}</div><h1>Today</h1></div><div class="row" style="gap:10px"><button class="iconbtn" data-a="go" data-v="settings" aria-label="Settings">${ic('gear', 20, 2)}</button>${ring}</div></div><div class="stack">`;

  if (S.active) {
    const a = S.active, done = a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
    h += `<button class="card pad row" data-a="resume" style="border:1px solid var(--accent);text-align:left"><div class="grow"><div class="label acc">In progress · ${fmtTime((Date.now() - a.start) / 1000)}</div><div style="font-size:18px;font-weight:700;margin-top:4px">${esc(a.name)}</div><div class="small mute">${done} sets logged · ${esc(a.gymName)}</div></div><span class="btn sm" style="width:auto;padding:0 18px">Resume</span></button>`;
  }
  const here = gym(), auto = !!hereAuto();
  h += `<button class="herepill" data-a="go" data-v="gyms" aria-label="Training at ${esc(here.name)}. Change location">${ic('pin', 16, 2.2, 'style="color:var(--accent)"')}<span class="mute">Training at</span><b>${esc(here.name)}</b>${here.unset ? '<span class="amb small">· set up</span>' : auto ? '<span class="small" style="color:var(--amber)">· layover</span>' : ''}<span class="mute">${ic('chev', 14)}</span></button>`;
  h += weekStrip(t0, sel);

  const sd0 = schedDay(sel), ap = sd0 ? null : autoPlan(sel), sd = sd0 || (ap ? { sid: ap.sid, note: 'Suggested from your roster: ' + ap.why.charAt(0).toLowerCase() + ap.why.slice(1) } : null);
  const planned = sd0 ? sd0.sid : ap ? ap.sid : (isToday ? nextSessionId() : null);
  const sid = S.pick || planned;
  const doneLogs = loggedOn(sel);
  const g = dayGym(sel);
  const extra = sd && (sd.note || sd.other) ? `<div class="plannote">${sd.note ? `<span>${esc(sd.note)}</span>` : ''}${sd.other ? `<span class="mute">Also: ${esc(sd.other)}</span>` : ''}</div>` : '';

  if (!sid) {
    h += `<div class="card"><div class="hero"><div class="row" style="gap:6px"><span class="tag">${isToday ? 'TODAY' : esc(selName.toUpperCase())}</span>${ap ? '<span class="tag auto">AUTO</span>' : ''}${ph ? `<span class="tag acc">${esc(ph.name.toUpperCase())}</span>` : ''}</div><h2>${ap && ap.rest ? 'Rest day' : 'No lifting planned'}</h2>${extra}</div>
      ${dutyRow(sel)}<div style="height:8px"></div>
      ${doneLogs.length ? `<div style="padding:0 20px 16px" class="small acc">Logged: ${doneLogs.map((l) => esc(l.name)).join(', ')}</div>` : ''}</div>`;
  } else {
    const s = session(sid);
    const items = [];
    s.blocks.forEach((b) => b.items.forEach((it) => items.push({ b, it, r: resolve(sid, it, g) })));
    const blocks = [];
    for (const b of s.blocks) {
      if (b.circuit) { items.filter((x) => x.b === b).forEach((x) => blocks.push(`<li><span class="k">${esc(x.it.slot)}</span><span class="grow">${esc(EX(x.r.ex).name)}</span><span class="t">${x.it.sets} × ${esc(x.it.target)}</span></li>`)); continue; }
      const rs = items.filter((x) => x.b === b);
      const names = rs.map((x, i) => (i ? `<span class="mute"> + ${esc(EX(x.r.ex).name)}</span>` : esc(EX(x.r.ex).name))).join('');
      const sw = rs.filter((x) => x.r.swapped && x.r.why).map((x) => `<span class="swapnote">${rs.length > 1 ? esc(x.it.slot) + ' swapped · ' : 'Swapped · '}${esc(x.r.why)}</span>`).join('');
      const sets = Math.max(...rs.map((x) => x.it.sets));
      blocks.push(`<li><span class="k ${b.power ? 'p' : ''}">${b.key}</span><span class="grow">${names}${sw}</span><span class="t">${sets} × ${esc(rs[0].it.target)}</span></li>`);
    }
    const swaps = items.filter((x) => x.r.swapped).length;
    const isDone = doneLogs.some((l) => l.sid === sid);
    const tag = S.pick && S.pick !== planned ? '<span class="tag amb">YOUR PICK</span>' : ap ? `<span class="tag auto">AUTO ${isToday ? 'TODAY' : esc(DOW[sel.getDay()].slice(0, 3).toUpperCase())}</span>` : sd && sd.sid ? `<span class="tag acc">PLANNED ${isToday ? 'TODAY' : esc(DOW[sel.getDay()].slice(0, 3).toUpperCase())}</span>` : '<span class="tag">UP NEXT</span>';
    h += `<div class="card"><div class="hero"><div class="row" style="gap:6px;flex-wrap:wrap">${tag}<span class="tag">${s.minutes} MIN</span>${isDone ? '<span class="tag acc">DONE</span>' : ''}</div><h2>${esc(s.name)}</h2><div class="small mute" style="font-size:14px">${esc(s.label)}${s.quick ? ` · ${s.blocks[0].items.length} exercises × ${s.blocks[0].items[0] ? s.blocks[0].items[0].sets : 2} rounds · ${s.focus === 'snack' ? 'changes daily' : '10 s between, 45 s after each round'}` : (P().rotation || []).includes(sid) ? ` · ${doneThisBlock()} of 3 done this roster block` : ''}</div>${S.pick && S.pick !== planned ? '' : extra}</div>
      ${dutyRow(sel)}
      <button class="loc" data-a="go" data-v="gyms">${ic('pin', 18, 2.2, 'style="color:var(--accent)"')}<span class="grow" style="font-size:15px;font-weight:600">${esc(g.name)} <span class="mute" style="font-weight:400">· ${g.unset ? '<span class="warn">equipment not set</span>' : swaps ? swaps + ' swap' + (swaps > 1 ? 's' : '') : 'no swaps'}</span></span><span class="mute">${ic('chev', 16)}</span></button>
      <ol class="exlist">${blocks.join('')}</ol>
      ${s.quick ? `<div style="padding:0 12px"><button class="btn ghost sm" data-a="genQuick" data-f="${s.focus}">${ic('swap', 16)}Shuffle exercises</button></div>` : ''}
      <div class="btn-wrap"><button class="btn" data-a="start" data-s="${sid}">${playIc}${S.active ? 'Start new session' : isDone ? 'Do it again' : 'Start session'}</button></div></div>`;
  }

  h += `<div class="row" style="gap:8px">${S.pick && S.pick !== planned && planned ? `<button class="btn ghost sm" data-a="pick" data-s="" style="flex:1">Back to plan</button>` : ''}<button class="btn ghost" data-a="go" data-v="choose" style="flex:2;height:56px">${ic('list', 20)}${sid ? 'Choose a different workout' : 'Choose a workout'}</button></div>`;

  const last = stats().logs[0];
  if (last) {
    const prn = last.sets.filter((x) => x.pr).length;
    h += `<div class="last"><span class="dot acc">${ic('check', 16, 2.6)}</span><span class="grow"><span style="display:block;font-size:14px;font-weight:600">${esc(last.name)}</span><span class="small mute">${DOW[new Date(last.start).getDay()].slice(0, 3)} ${shortDate(last.start)} · ${esc(last.gymName || '')} · ${last.minutes} min</span></span>${prn ? `<span class="acc" style="font-size:13px;font-weight:700">${prn} PR${prn > 1 ? 's' : ''}</span>` : ''}</div>`;
  }
  h += `<div id="status">${statusLine()}</div></div></div>`;
  return h;
}

/* ---------- workout ---------- */
function buildSteps(items) {
  const steps = [];
  const blocks = [...new Set(items.map((x) => x.bi))];
  for (const bi of blocks) {
    const its = items.map((x, i) => [x, i]).filter(([x]) => x.bi === bi);
    const rounds = Math.max(...its.map(([x]) => x.sets.length));
    for (let r = 0; r < rounds; r++) for (const [x, i] of its) if (r < x.sets.length) steps.push([i, r]);
  }
  return steps;
}
function startSession(sid) {
  const s = session(sid), g = gym();
  const items = [];
  s.blocks.forEach((b, bi) => b.items.forEach((it) => {
    const r = resolve(sid, it, g);
    const pf = prefill(it, r.ex, g);
    items.push({ slot: it.slot, block: b.key, bi, circuit: !!b.circuit, power: !!b.power, optional: !!b.optional, opts: it.ex, ex: r.ex, orig: it.ex[0], swapped: r.swapped, why: r.why, target: it.target, lo: it.lo, hi: it.hi, tip: pf.tip, lastSets: pf.last || null, sets: pf.sets.map((p) => ({ ...p, done: false })) });
  }));
  S.active = { id: uid(), sid, name: s.name, label: s.label, gymId: g.id, gymName: g.name, start: Date.now(), items, steps: buildSteps(items), cur: 0, rest: null };
  save('active'); S.view = 'session'; unlockAudio(); wake(); render(); toTop();
}
function curStep() { const a = S.active; return a.steps[a.cur] || a.steps[0]; }
function stepDone([i, r]) { const s = S.active.items[i].sets[r]; return s.done || s.skipped; }
function nextOpenAfter(k) { const a = S.active; for (let j = 1; j <= a.steps.length; j++) { const idx = (k + j) % a.steps.length; if (!stepDone(a.steps[idx])) return idx; } return -1; }

function vSession() {
  const a = S.active;
  if (!a) { S.view = 'today'; return vToday(); }
  const [ci, cr] = curStep();
  const bkeys = [...new Set(a.items.map((x) => x.bi))];
  const segs = bkeys.map((bi) => { const xs = a.items.filter((x) => x.bi === bi); return `<span class="${xs.every(exFinished) ? 'done' : bi === a.items[ci].bi ? 'cur' : ''}"></span>`; }).join('');
  const doneSets = a.items.reduce((n, x) => n + x.sets.filter((s) => s.done).length, 0);
  const groups = bkeys.map((bi) => {
    const xs = a.items.map((x, i) => [x, i]).filter(([x]) => x.bi === bi);
    const cards = xs.map(([x, i]) => exCard(a, x, i, ci, cr)).join('');
    if (xs.length < 2) return cards;
    const f = xs[0][0], rounds = Math.max(...xs.map(([x]) => x.sets.length));
    const lbl = f.circuit ? `Circuit · ${rounds} rounds` : f.power ? 'Power · alternate sets' : `Superset ${esc(f.block)} · alternate sets`;
    return `<div class="exgroup ${f.power ? 'p' : ''}"><div class="label exglabel">${lbl}${f.optional ? ' · optional' : ''}</div>${cards}</div>`;
  }).join('');

  return `<div class="view session">
    <div class="shead"><button class="iconbtn" data-a="go" data-v="today" aria-label="Back to Today">${ic('back', 20)}</button>
      <div class="mid"><b>${esc(a.name)}</b><span class="small mute"><span id="elapsed">${fmtTime((Date.now() - a.start) / 1000)}</span> · ${esc(a.gymName)}</span></div>
      <button class="textbtn" data-a="finish">Finish</button></div>
    <div class="segs" style="grid-template-columns:repeat(${bkeys.length},minmax(0,1fr))">${segs}</div>
    <div class="small mute" style="padding:0 8px 12px">${doneSets} of ${a.steps.length} sets logged</div>
    <div class="stack">${groups}</div></div>`;
}
const exFinished = (it) => it.sets.every((s) => s.done || s.skipped);

/* one exercise in the full workout list; the current set opens its editor in place */
function exCard(a, it, ii, ci, cr) {
  const ex = EX(it.ex), isCur = ii === ci, fin = exFinished(it), skipped = it.sets.some((s) => s.skipped);
  const inGroup = a.items.filter((x) => x.bi === it.bi).length > 1;
  const kind = it.power && !inGroup ? 'POWER' : it.block === 'FIN' ? 'FINISHER' : it.block === 'WU' ? 'WARM-UP' : inGroup ? esc(it.slot) : it.optional ? 'OPTIONAL' : `BLOCK ${esc(it.block)}`;
  const unitHint = ex.perDB ? ' · kg per dumbbell' : '';
  const sideHint = ex.perSide ? ' · per side' : '';

  let rows = '';
  it.sets.forEach((s, r) => {
    const was = it.lastSets && it.lastSets[r] ? `was ${setText(it.ex, it.lastSets[r], true)}` : '';
    const key = ii + ':' + r;
    if (s.skipped) {
      rows += `<div class="setrow todo"><span class="n">${r + 1}</span><span class="v">Skipped</span></div>`;
    } else if (s.done && S.editing !== key) {
      rows += `<button class="setrow" data-a="editSet" data-i="${ii}" data-r="${r}"><span class="n">${r + 1}</span><span class="v">${esc(setText(it.ex, s))}</span>${s.pr ? '<span class="pr">PR</span>' : ''}<span class="was">${esc(was)}</span><span class="tick ${s.justDone ? 'pop' : ''}" style="color:var(--accent-ink)">${ic('check', 15, 3)}</span></button>`;
    } else if ((isCur && r === cr) || S.editing === key) {
      rows += editor(it, ii, r, was);
    } else {
      rows += `<button class="setrow todo" data-a="jump" data-i="${ii}" data-r="${r}"><span class="n">${r + 1}</span><span class="v">${esc(setText(it.ex, s))}</span>${was ? `<span class="was">${esc(was)}</span>` : ''}</button>`;
    }
  });

  const tip = isCur && it.tip ? `<div class="tip">${ic(it.tip.kind === 'up' ? 'up' : 'flag', 18, 2.2, 'style="color:var(--accent)"')}<span>${tipHtml(it.tip)}</span></div>` : '';
  const sw = it.swapped && it.why ? `<div class="tip amb">${ic('swap', 18, 2.2, 'style="color:var(--amber)"')}<span>Swapped from ${esc(EX(it.orig).name)} · ${esc(it.why)}.</span></div>` : '';
  const btns = skipped ? `<button class="swapbtn" data-a="unskipEx" data-i="${ii}">Undo skip</button>`
    : fin ? `<span class="tick" style="color:var(--accent-ink)">${ic('check', 15, 3)}</span>`
    : `<button class="swapbtn" data-a="skipEx" data-i="${ii}">Skip</button><button class="swapbtn" data-a="swapSheet" data-i="${ii}">${ic('swap', 14)}Swap</button>`;
  const lastOpen = it.sets.length > 1 && !it.sets[it.sets.length - 1].done && !it.sets[it.sets.length - 1].skipped;

  return `<div class="card excard ${isCur && !fin ? 'cur' : ''} ${fin ? 'fin' : ''}" data-ex="${ii}">
      <div class="exhead"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="label ${it.power ? 'amb' : 'acc'}">${kind}</span><h2>${esc(ex.name)}</h2><span class="small mute" style="font-size:13px">${it.sets.length} × ${esc(it.target)}${unitHint}${sideHint}</span></div>
        <div class="row" style="gap:6px;flex:0 0 auto">${btns}</div></div>
      ${sw}${tip}
      <div>${rows}</div>
      ${skipped ? '' : `<div class="row" style="justify-content:space-between;padding:0 4px"><button class="small mute" data-a="addSet" data-i="${ii}" style="height:36px">+ Add set</button>${lastOpen ? `<button class="small mute" data-a="delSet" data-i="${ii}" style="height:36px">Remove last set</button>` : ''}</div>`}
    </div>`;
}

/* after logging or skipping, bring the next set's editor into view (with its exercise name if it fits) */
function followCur(jump) {
  const ed = document.querySelector('.excard.cur .editor'); if (!ed) return;
  const card = ed.closest('.excard'), r = ed.getBoundingClientRect(), c = card.getBoundingClientRect();
  const minTop = 64, maxBottom = window.innerHeight - 130;
  if (r.top >= minTop && r.bottom <= maxBottom) return;
  let d = c.top - minTop;
  if (r.bottom - d > maxBottom) d = r.bottom - maxBottom;
  window.scrollBy({ top: d, behavior: jump ? 'auto' : 'smooth' });
}

function editor(it, ii, r, was) {
  const ex = EX(it.ex), s = it.sets[r];
  const st = (field, label, step, val) => `<div class="stepper"><button data-a="step" data-i="${ii}" data-r="${r}" data-f="${field}" data-d="-${step}" aria-label="Less ${label}">−</button><span class="val"><input inputmode="decimal" data-in="${field}" data-i="${ii}" data-r="${r}" value="${val ?? ''}" aria-label="${label}"><small>${label}</small></span><button data-a="step" data-i="${ii}" data-r="${r}" data-f="${field}" data-d="${step}" aria-label="More ${label}">+</button></div>`;
  let fields = '';
  const inc = stepU(ex.inc || 2.5), UL = U().toUpperCase();
  if (ex.type === 'load') fields = st('kg', ex.perDB ? UL + ' / DB' : UL, inc, fmtNum(W(s.kg))) + st('reps', ex.perSide ? 'REPS / SIDE' : 'REPS', 1, s.reps);
  else if (ex.type === 'bw') fields = st('kg', 'ADDED ' + UL, inc, fmtNum(W(s.kg || 0))) + st('reps', 'REPS', 1, s.reps);
  else if (ex.type === 'carry') fields = st('kg', ex.perDB ? UL + ' / HAND' : UL, inc, fmtNum(W(s.kg))) + st('m', ex.perSide ? 'M / SIDE' : 'METRES', 5, s.m);
  else if (ex.type === 'time') fields = st('sec', ex.perSide ? 'SEC / SIDE' : 'SECONDS', 5, s.sec);
  else fields = st('reps', ex.perSide ? 'REPS / SIDE' : 'REPS', 1, s.reps);
  const one = (ex.type === 'time' || ex.type === 'reps') ? ' one' : '';
  const needsUnit = ['load', 'bw', 'carry'].includes(ex.type);
  return `<div class="editor"><div class="top" style="align-items:center"><span>Set ${r + 1} of ${it.sets.length}${was ? ' · ' + esc(was) : ''}</span>${needsUnit ? unitSeg() : ''}</div><div class="steppers${one}">${fields}</div><button class="btn" data-a="logSet" data-i="${ii}" data-r="${r}" style="height:52px;font-size:16px">${s.done ? 'Update set' : 'Log set · start rest'}</button></div>`;
}

function logSet(ii, r) {
  const a = S.active, it = a.items[ii], s = it.sets[r];
  const ex = EX(it.ex);
  if (ex.type === 'load' && !(s.reps > 0)) { toast('Add the reps first'); return; }
  const wasDone = s.done;
  const prev = (stats().prs[it.ex] || 0);
  const bestThis = Math.max(0, ...it.sets.filter((x, k) => x.done && k !== r).map((x) => score(it.ex, x)));
  s.done = true; s.at = Date.now();
  it.sets.forEach((x, k) => { if (k > r && !x.done && !x.skipped && !x.kg && s.kg) x.kg = s.kg; });
  s.pr = prev > 0 && score(it.ex, s) > prev && score(it.ex, s) > bestThis;
  if (s.pr) it.sets.forEach((x, k) => { if (k !== r && x.pr && score(it.ex, x) <= score(it.ex, s)) x.pr = false; });
  s.justDone = true; setTimeout(() => { s.justDone = false; }, 600);
  S.editing = null;
  if (!wasDone) {
    const k = a.steps.findIndex(([i, rr]) => i === ii && rr === r);
    const nxt = nextOpenAfter(k >= 0 ? k : a.cur);
    const block = a.items.filter((x) => x.bi === it.bi);
    const sameRoundPartner = nxt >= 0 && a.items[a.steps[nxt][0]].bi === it.bi && a.steps[nxt][1] === r && a.steps[nxt][0] !== ii;
    const restSec = sameRoundPartner ? (it.circuit ? 10 : 20) : it.circuit ? 45 : it.power ? (P().defaults.powerRestSec || 75) : (S.cfg.rest || 90);
    if (nxt >= 0) {
      a.cur = nxt; S.follow = true;
      const nit = a.items[a.steps[nxt][0]];
      a.rest = { end: Date.now() + restSec * 1000, total: restSec, label: sameRoundPartner ? `Move on · ${EX(nit.ex).name}` : `Rest · then ${EX(nit.ex).name}`, chimed: false };
    } else { a.rest = null; setTimeout(() => toast('All sets done – tap Finish'), 300); }
    void block;
    if (s.pr) toast(`New PR · ${ex.name}`);
  }
  save('active'); render();
}

function swapOpt(ii, id, it, g, note) {
  const ex = EX(id), ok = hasEquip(ex, g), last = lastFor(id);
  const lastTxt = last ? `last: ${last.sets.map((s) => setText(id, s, true)).slice(0, 2).join(', ')}` : 'never logged';
  return `<button class="opt ${id === it.ex ? 'best' : ''} ${ok ? '' : 'na'}" data-a="doSwap" data-i="${ii}" data-x="${esc(id)}"><span class="grow"><span style="display:block;font-size:16px;font-weight:600">${esc(ex.name)}</span><span class="small mute">${ok ? '' : 'Needs ' + esc(missingFor(ex, g).join(', ')) + ' · '}${esc(lastTxt)}</span></span>${id === it.ex ? '<span class="small acc" style="font-weight:700">Current</span>' : note ? `<span class="small mute">${note}</span>` : ''}</button>`;
}
function vSwapSheet(ii) {
  const a = S.active, it = a.items[ii], g = gym(a.gymId);
  const all = P().exercises, pat = EX(it.ex).pattern || EX(it.orig).pattern;
  const sortAvail = (ids) => ids.sort((x, y) => (hasEquip(EX(y), g) - hasEquip(EX(x), g)) || EX(x).name.localeCompare(EX(y).name));
  const plan = it.opts.map((id, n) => swapOpt(ii, id, it, g, n === 0 ? 'Planned' : '')).join('');
  const same = sortAvail(Object.keys(all).filter((id) => all[id].pattern === pat && !it.opts.includes(id))).map((id) => swapOpt(ii, id, it, g)).join('');
  const patName = (P().patterns || {})[pat] || 'similar';
  return `<div class="grab-zone" aria-hidden="true"><div class="grab"></div></div><div class="row" style="justify-content:space-between;margin-bottom:12px"><div><div class="small mute">Swap ${esc(it.slot)} · ${esc(g.name)}</div><h3>Choose an exercise</h3></div><button class="iconbtn" data-a="closeSheet" aria-label="Close">${ic('x', 18)}</button></div>
    <div class="label" style="margin:6px 0 8px">From your programme</div>${plan}
    ${same ? `<div class="label" style="margin:16px 0 8px">Other ${esc(patName.toLowerCase())} options</div>${same}` : ''}
    <button class="toggle" data-a="toggleRemember" style="margin-top:6px"><span>Remember this swap for ${esc(g.name)}</span><span class="sw ${S.remember !== false ? 'on' : ''}" id="remSw"></span></button>
    <div class="label" style="margin:16px 0 8px">Any exercise</div>
    <label class="field" style="margin-bottom:8px"><span class="sr">Search exercises</span><input id="exSearch" data-search="${ii}" placeholder="Search all exercises" autocomplete="off"></label>
    <div id="exResults"></div>
    <button class="btn ghost sm" data-a="doSwapCustom" data-i="${ii}" style="margin-top:4px">Not listed? Use what you typed</button>`;
}
function searchResults(ii, q) {
  const a = S.active, it = a.items[ii], g = gym(a.gymId), all = P().exercises;
  q = q.trim().toLowerCase(); if (!q) return '';
  const ids = Object.keys(all).filter((id) => all[id].name.toLowerCase().includes(q) || ((P().patterns || {})[all[id].pattern] || '').toLowerCase().includes(q)).slice(0, 12);
  const mine = [...new Set(stats().logs.flatMap((l) => l.sets.map((s) => s.ex)).filter((id) => id.startsWith('custom:') && id.slice(7).toLowerCase().includes(q)))];
  const out = mine.map((id) => swapOpt(ii, id, it, g, 'Added by you')).concat(ids.map((id) => swapOpt(ii, id, it, g, esc(((P().patterns || {})[all[id].pattern]) || ''))));
  return out.length ? out.join('') : '<div class="small mute" style="padding:6px 4px 10px">No match – tap the button below to log it as a new exercise.</div>';
}
function doSwap(ii, exId) {
  const a = S.active, it = a.items[ii], g = gym(a.gymId);
  const doneCount = it.sets.filter((s) => s.done).length;
  if (doneCount && exId !== it.ex) { toast('Sets already logged stay as ' + EX(it.ex).name); }
  const pf = prefill({ sets: it.sets.length, lo: it.lo, hi: it.hi }, exId, g);
  it.sets = it.sets.map((s, k) => (s.done ? s : { ...pf.sets[k], done: false }));
  it.ex = exId; it.tip = pf.tip; it.lastSets = pf.last; it.swapped = exId !== it.orig; it.why = it.swapped ? 'your choice' : '';
  if (S.remember !== false) {
    const key = a.sid + ':' + it.slot;
    g.swaps = g.swaps || {};
    if (exId === resolveDefault(a.sid, it, g)) delete g.swaps[key]; else g.swaps[key] = exId;
    enqueue({ kind: 'file', name: 'gyms', data: S.data.gyms }); save('data');
  }
  save('active'); closeSheet(); render();
}
function resolveDefault(sid, it, g) { for (const id of it.opts) if (hasEquip(EX(id), g)) return id; return it.opts[it.opts.length - 1]; }

function vFinishSheet() {
  const a = S.active;
  const sets = a.items.flatMap((it) => it.sets.filter((s) => s.done).map((s) => ({ ...s, ex: it.ex })));
  const mins = Math.max(1, Math.round((Date.now() - a.start) / 60000));
  const vol = volume({ sets });
  const prs = a.items.flatMap((it) => it.sets.filter((s) => s.done && s.pr).map((s) => `${EX(it.ex).name} · ${setText(it.ex, s)}`));
  const left = a.steps.filter((st) => !stepDone(st)).length;
  const skipped = a.items.filter((it) => it.sets.some((s) => s.skipped)).map((it) => EX(it.ex).name);
  return `<div class="grab-zone" aria-hidden="true"><div class="grab"></div></div><h3>Finish session</h3><div class="small mute" style="margin:4px 0 16px">${esc(a.name)} · ${esc(a.gymName)}</div>
    <div class="tiles" style="margin-bottom:14px"><div class="tile" style="background:var(--raise)"><b>${mins}</b><span>Minutes</span></div><div class="tile" style="background:var(--raise)"><b>${sets.length}</b><span>Sets</span></div><div class="tile" style="background:var(--raise)"><b style="font-size:20px">${fmtVol(vol)}</b><span>Volume</span></div></div>
    ${prs.length ? `<div class="tip" style="margin-bottom:14px">${ic('up', 18, 2.2, 'style="color:var(--accent)"')}<span><b>${prs.length} PR${prs.length > 1 ? 's' : ''}</b><br>${prs.map(esc).join('<br>')}</span></div>` : ''}
    ${skipped.length ? `<div class="small mute" style="margin-bottom:6px">Skipped: ${skipped.map(esc).join(', ')}</div>` : ''}${left > 0 ? `<div class="small mute" style="margin-bottom:12px">${left} planned set${left > 1 ? 's' : ''} not logged – that's fine.</div>` : ''}
    <div class="field">How hard was it overall? (1–10)<div class="rpe">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button data-a="rpe" data-n="${n}" class="${a.rpe === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <label class="field">Notes (ankle, sleep, anything for Claude)<textarea id="notes">${esc(a.notes || '')}</textarea></label>
    <button class="btn" data-a="saveSession">Save workout</button>
    <button class="btn danger sm" data-a="discard" style="margin-top:10px">${S.confirmDiscard ? 'Tap again to discard' : 'Discard session'}</button>`;
}
function saveSession() {
  const a = S.active; const notesEl = $('#notes'); if (notesEl) a.notes = notesEl.value.trim();
  const sets = a.items.flatMap((it) => it.sets.map((s, k) => ({ s, k, it })).filter((x) => x.s.done).map(({ s, k, it }) => {
    const o = { ex: it.ex, slot: it.slot, n: k + 1 }; for (const f of ['kg', 'reps', 'sec', 'm']) if (s[f] != null) o[f] = s[f]; if (s.pr) o.pr = true; return o;
  }));
  if (!sets.length) { toast('No sets logged yet'); return; }
  const start = new Date(a.start), end = new Date();
  const log = { id: a.id, v: 1, start: start.toISOString(), end: end.toISOString(), minutes: Math.max(1, Math.round((end - start) / 60000)), sid: a.sid, name: a.name, gymId: a.gymId, gymName: a.gymName, rpe: a.rpe || null, notes: a.notes || '', sets, swaps: a.items.filter((it) => it.swapped).map((it) => ({ slot: it.slot, from: it.orig, to: it.ex })), skipped: a.items.filter((it) => it.sets.some((s) => s.skipped)).map((it) => it.slot), volume: Math.round(volume({ sets })), app: APP_VERSION };
  const name = `${ymd(start)}-${pad(start.getHours())}${pad(start.getMinutes())}-${a.sid}-${a.id.slice(0, 4)}.json`;
  S.logs[name] = log; save('logs');
  const g = gym(a.gymId); g.lastUsed = ymd(start); save('data');
  enqueue({ kind: 'log', name, data: log });
  enqueue({ kind: 'file', name: 'gyms', data: S.data.gyms });
  S.active = null; S.pick = null; save('active'); invalidate(); releaseWake();
  closeSheet(); S.view = 'today'; render(); toTop();
  const nPr = log.sets.filter((x) => x.pr).length;
  toast(nPr ? `Saved · ${nPr} PR${nPr > 1 ? 's' : ''}` : 'Workout saved');
}

/* ---------- rest timer, sound, wake lock ---------- */
let audioCtx = null;
function unlockAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { /* no audio */ } }
function chime() {
  if (!S.cfg.sound || !audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    [[880, 0], [1320, 0.18]].forEach(([f, d]) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5); o.connect(g).connect(audioCtx.destination); o.start(t + d); o.stop(t + d + 0.55); });
  } catch (e) { /* ignore */ }
}
let wakeLock = null;
async function wake() { try { if (S.active && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { wakeLock = null; } }
function releaseWake() { try { wakeLock && wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }

function renderRest() {
  const el = $('#rest'); const a = S.active;
  if (!a || !a.rest || S.view !== 'session') { el.classList.remove('on'); return; }
  const left = (a.rest.end - Date.now()) / 1000;
  const c = 2 * Math.PI * 22, f = Math.max(0, Math.min(1, left / a.rest.total));
  el.innerHTML = `<div class="inner"><svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22" fill="none" stroke="#2A2F38" stroke-width="4"/><circle id="restRing" cx="26" cy="26" r="22" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 26 26)"/></svg>
    <div class="grow" style="display:flex;flex-direction:column"><span id="restTime" class="time ${left <= 0 ? 'over' : ''}">${left > 0 ? fmtTime(left) : 'Go'}</span><span class="small mute" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.rest.label)}</span></div>
    <button class="s" data-a="restAdd" aria-label="Add 15 seconds">+15</button><button class="k" data-a="restSkip">${left > 0 ? 'Skip' : 'Hide'}</button></div>`;
  el.classList.add('on');
}
function tick() {
  const a = S.active; if (!a) return;
  const e = $('#elapsed'); if (e) e.textContent = fmtTime((Date.now() - a.start) / 1000);
  if (a.rest && S.view === 'session') {
    const left = (a.rest.end - Date.now()) / 1000;
    const t = $('#restTime'), ring = $('#restRing');
    if (t) { t.textContent = left > 0 ? fmtTime(left) : 'Go'; t.classList.toggle('over', left <= 0); }
    if (ring) { const c = 2 * Math.PI * 22, f = Math.max(0, Math.min(1, left / a.rest.total)); ring.setAttribute('stroke-dasharray', `${(c * f).toFixed(1)} ${c.toFixed(1)}`); }
    if (left <= 0 && !a.rest.chimed) { a.rest.chimed = true; save('active'); if (left > -5) chime(); renderRest(); }
    if (left < -60) { a.rest = null; save('active'); renderRest(); }
  }
}
setInterval(tick, 250);

/* ---------- view: choose a workout ---------- */
function vChoose() {
  const g = gym();
  const card = (s) => {
    const names = s.blocks.flatMap((b) => b.items.map((it) => EX(resolve(s.id, it, g).ex).name));
    return `<button class="pickcard" data-a="choose" data-s="${s.id}"><span class="row" style="justify-content:space-between;width:100%"><span class="label acc">${esc(s.label)}</span><span class="small mute">${s.minutes} min</span></span><span class="pc-t">${esc(s.name)}</span><span class="small mute" style="line-height:1.4">${esc(names.slice(0, 5).join(' · '))}${names.length > 5 ? ` +${names.length - 5}` : ''}</span></button>`;
  };
  const quick = Object.entries(GEN).filter(([k]) => k !== 'snack').map(([k, v]) => `<button class="quickbtn" data-a="genQuick" data-f="${k}"><b>${esc(v.name)}</b><span>10 min</span></button>`).join('');
  return `<div class="view"><div class="shead" style="margin-bottom:12px"><button class="iconbtn" data-a="back" aria-label="Back">${ic('back', 20)}</button><div class="mid" style="align-items:flex-start;padding-left:8px"><b style="font-size:22px">Choose a workout</b><span class="small mute">${ic('pin', 12, 2.4)} ${esc(g.name)}</span></div></div>
    <div class="label" style="margin:4px 4px 10px">Your programme</div>
    <div class="stack" style="gap:10px">${P().sessions.map((s) => card(session(s.id))).join('')}</div>
    <div class="label" style="margin:22px 4px 6px">Quick 10-minute workout</div>
    <div class="small mute" style="margin:0 4px 10px">Where are you? It's built from what that place has.</div>
    <div class="chips" style="margin-bottom:12px">${gyms().filter((x) => !x.archived).map((x) => `<button class="pill ${x.id === g.id ? 'on' : ''}" data-a="setGymHere" data-g="${esc(x.id)}">${esc(x.airport ? x.airport : x.name)}</button>`).join('')}</div>
    <div class="quickgrid">${quick}</div></div>`;
}

/* ---------- view: progress ---------- */
function spark(vals, w = 72, h = 28, color = 'var(--accent)') {
  if (vals.length < 2) return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><circle cx="${w - 4}" cy="${h / 2}" r="3.5" fill="${color}"/></svg>`;
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => `${(2 + (i * (w - 4)) / (vals.length - 1)).toFixed(1)},${(h - 3 - ((v - mn) / rg) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; }
function vProgress() {
  const st = stats(), logs = st.logs;
  const ph = phaseNow();
  const phStart = ph ? parseD(ph.start).getTime() : 0;
  const prCount = logs.filter((l) => new Date(l.start).getTime() >= phStart).reduce((n, l) => n + l.sets.filter((s) => s.pr).length, 0);
  let h = `<div class="view"><div class="head"><div><div class="sub">${ph ? esc(ph.name) + ' · since ' + shortDate(ph.start) : 'All time'}</div><h1>Progress</h1></div>${unitSeg()}</div><div class="stack">
    <div class="tiles"><div class="tile"><b>${logs.length}</b><span>Sessions</span></div><div class="tile"><b>${doneThisBlock()}<span class="mute" style="font-size:16px"> / 3</span></b><span>This roster block</span></div><div class="tile"><b class="acc">${prCount}</b><span>PRs this phase</span></div></div>`;

  // weekly volume + sessions
  const ws = weekStart(new Date());
  const weeks = []; for (let i = 7; i >= 0; i--) { const s = new Date(ws); s.setDate(s.getDate() - 7 * i); weeks.push({ s, v: 0, n: 0 }); }
  for (const l of logs) { const t = new Date(l.start); const w = weeks.find((x) => t >= x.s && t < new Date(x.s.getTime() + 7 * DAY)); if (w) { w.v += l.volume || volume(l); w.n++; } }
  const mx = Math.max(1, ...weeks.map((w) => w.v));
  const bw = 300 / 8;
  const bars = weeks.map((w, i) => { const hh = Math.max(w.v ? 6 : 2, (w.v / mx) * 92); return `<rect x="${i * bw + 6}" y="${112 - hh}" width="${bw - 12}" height="${hh}" rx="5" fill="${i === 7 ? 'var(--accent)' : w.v ? '#3A4150' : '#1C2027'}"/>${w.n ? `<text x="${i * bw + bw / 2}" y="${104 - hh}" text-anchor="middle" font-size="11" fill="#8B919C" font-family="Inter">${w.n}</text>` : ''}<text x="${i * bw + bw / 2}" y="128" text-anchor="middle" font-size="10" fill="#5C626D" font-family="Inter">${w.s.getDate()}/${w.s.getMonth() + 1}</text>`; }).join('');
  h += `<div class="card pad"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="label">Weekly volume</span><span class="small mute">number = sessions</span></div><svg class="chart" viewBox="0 0 300 132" role="img" aria-label="Weekly training volume for the last 8 weeks">${bars}</svg></div>`;

  // body & relative strength
  const bk = bodyKg(); const be = (S.data.body && S.data.body.entries) || [];
  const rel = [];
  const relFor = (id, label) => { const arr = st.byEx[id]; if (!arr || !bk) return; const best = Math.max(...arr.map((x) => x.e1 || 0)); if (best) rel.push(`<div><b>${(best / bk).toFixed(2)}×</b><span>${label}</span></div>`); };
  relFor('leg_press', 'Leg press e1RM'); relFor('weighted_pullup', 'Pull-up e1RM*'); relFor('rdl', 'RDL e1RM');
  const carry = st.byEx.farmers_carry ? st.byEx.farmers_carry.reduce((m, x) => (x.best && x.score > (m ? m.score : 0) ? x : m), null) : null;
  h += `<div class="card pad"><div class="row" style="justify-content:space-between"><span class="label">Body &amp; relative strength</span><button class="small acc" data-a="bodySheet" style="font-weight:700;height:32px">${bk ? 'Update' : '+ Add weight'}</button></div>
    <div class="coros" style="margin-top:12px"><div><b>${bk ? fmtNum(W(bk)) + ' ' + U() : '–'}</b><span>Body weight${be.length ? ' · ' + shortDate(be[be.length - 1].date) : ''}</span></div>${rel.join('') || '<div><b>–</b><span>Strength ÷ body weight</span></div>'}${carry ? `<div><b>${fmtNum(W(carry.best.kg))} ${U()}</b><span>Farmer's carry / hand</span></div>` : ''}</div>
    ${be.length > 1 ? `<div style="margin-top:10px">${spark(be.slice(-12).map((x) => W(x.kg)), 300, 36, '#5AB0FF')}</div>` : ''}
    ${rel.length ? '<div class="tiny mute" style="margin-top:8px">*includes body weight</div>' : ''}</div>`;

  // lifts
  h += `<div class="chips"><button class="pill ${S.progFilter === 'main' ? 'on' : ''}" data-a="progFilter" data-f="main">Main lifts</button><button class="pill ${S.progFilter === 'all' ? 'on' : ''}" data-a="progFilter" data-f="all">All</button><button class="pill ${S.progFilter === 'hist' ? 'on' : ''}" data-a="progFilter" data-f="hist">History</button></div>`;
  if (S.progFilter === 'hist') {
    h += logs.length ? logs.slice(0, 40).map((l) => `<button class="liftrow" data-a="logSheet" data-id="${esc(l.id)}"><span class="grow"><span style="display:block;font-size:15px;font-weight:600">${esc(l.name)}</span><span class="small mute">${DOW[new Date(l.start).getDay()].slice(0, 3)} ${shortDate(l.start)} · ${esc(l.gymName || '')} · ${l.minutes} min${l.rpe ? ' · RPE ' + l.rpe : ''}</span></span><span class="small mute">${l.sets.length} sets</span>${l.sets.some((s) => s.pr) ? '<span class="pr">PR</span>' : ''}</button>`).join('') : `<div class="empty">No sessions yet. Your first one will show up here.</div>`;
  } else {
    const ids = Object.keys(st.byEx).filter((id) => S.progFilter === 'all' || EX(id).main).sort((a, b) => st.byEx[b].length - st.byEx[a].length);
    if (!ids.length) h += `<div class="empty">${logs.length ? 'No main lifts logged yet.' : 'Log a session and your lifts will appear here with trends and PRs.'}</div>`;
    for (const id of ids) {
      const arr = st.byEx[id], ex = EX(id);
      const vals = arr.slice(-8).map((x) => x.e1 || x.score);
      const first = arr.find((x) => new Date(x.date).getTime() >= phStart) || arr[0], lastH = arr[arr.length - 1];
      const bestH = arr.reduce((m, x) => (x.score > m.score ? x : m), arr[0]);
      const unit = ex.type === 'time' ? ' s' : ex.type === 'reps' ? ' reps' : ' ' + U();
      const dv = (lastH.e1 && first.e1) ? lastH.e1 - first.e1 : lastH.score - first.score;
      const dTxt = arr.length < 2 ? 'New' : Math.abs(dv) < 0.5 ? 'Steady' : (dv > 0 ? '+' : '') + fmtNum(ex.type === 'carry' ? W(dv / Math.max(1, lastH.best.m || 1)) : (ex.type === 'time' || ex.type === 'reps') ? dv : W(dv)) + (ex.type === 'carry' ? ' ' + U() : unit);
      const col = arr.length < 2 || Math.abs(dv) < 0.5 ? 'var(--mute)' : dv > 0 ? 'var(--accent)' : 'var(--amber)';
      h += `<button class="liftrow" data-a="liftSheet" data-x="${esc(id)}"><span class="grow"><span style="display:block;font-size:15px;font-weight:600">${esc(ex.name)}</span><span class="small mute">Best ${esc(setText(id, bestH.best))}${bestH.e1 ? ' · e1RM ' + Math.round(W(bestH.e1)) : ''}</span></span>${spark(vals, 64, 28, arr.length < 2 || Math.abs(dv) < 0.5 ? '#8B919C' : 'var(--accent)')}<span class="d" style="color:${col}">${dTxt}</span></button>`;
    }
  }
  h += `</div></div>`;
  return h;
}
function vLiftSheet(id) {
  const arr = stats().byEx[id] || [], ex = EX(id);
  const vals = arr.map((x) => (x.e1 ? W(x.e1) : x.score));
  const CW = 320, H = 150;
  let chart = '';
  if (vals.length) {
    const mn = Math.min(...vals) * 0.97, mx = Math.max(...vals) * 1.02, rg = mx - mn || 1;
    const X = (i) => 14 + (vals.length === 1 ? (CW - 28) / 2 : (i * (CW - 28)) / (vals.length - 1)), Y = (v) => H - 22 - ((v - mn) / rg) * (H - 44);
    chart = `<svg class="chart" viewBox="0 0 ${CW} ${H}" role="img" aria-label="${esc(ex.name)} trend"><line x1="0" x2="${CW}" y1="${H - 22}" y2="${H - 22}" stroke="#1C2027"/>${vals.length > 1 ? `<polyline points="${vals.map((v, i) => X(i) + ',' + Y(v)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}${vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${arr[i].pr ? 4.5 : 3}" fill="${arr[i].pr ? 'var(--accent)' : '#14171C'}" stroke="var(--accent)" stroke-width="2"/>`).join('')}<text x="2" y="12" font-size="10" fill="#8B919C" font-family="Inter">${Math.round(mx)}</text><text x="2" y="${H - 26}" font-size="10" fill="#8B919C" font-family="Inter">${Math.round(mn)}</text><text x="14" y="${H - 6}" font-size="10" fill="#5C626D" font-family="Inter">${arr.length ? shortDate(arr[0].date) : ''}</text><text x="${CW - 14}" y="${H - 6}" text-anchor="end" font-size="10" fill="#5C626D" font-family="Inter">${arr.length ? shortDate(arr[arr.length - 1].date) : ''}</text></svg>`;
  }
  const metric = ex.type === 'load' || ex.type === 'bw' ? 'Estimated 1-rep max' : ex.type === 'carry' ? 'Load × distance' : ex.type === 'time' ? 'Best hold' : 'Best reps';
  const rows = [...arr].reverse().map((x) => `<div class="setrow" style="cursor:default"><span class="grow" style="font-size:14px">${shortDate(x.date)}</span><span class="small soft" style="flex:2">${x.sets.map((s) => esc(setText(id, s, true))).join(' · ')}</span>${x.pr ? '<span class="pr">PR</span>' : ''}<span class="small mute" style="width:44px;text-align:right">${x.e1 ? Math.round(W(x.e1)) : ''}</span></div>`).join('');
  return `<div class="grab-zone" aria-hidden="true"><div class="grab"></div></div><div class="row" style="justify-content:space-between"><div><div class="small mute">${metric}</div><h3>${esc(ex.name)}</h3></div><button class="iconbtn" data-a="closeSheet" aria-label="Close">${ic('x', 18)}</button></div><div style="margin:14px 0">${chart}</div>${ex.cue ? `<div class="tip" style="margin-bottom:12px">${ic('flag', 18, 2.2, 'style="color:var(--accent)"')}<span>${esc(ex.cue)}</span></div>` : ''}<div class="label" style="margin-bottom:4px">History</div>${rows}`;
}
function vLogSheet(id) {
  const l = stats().logs.find((x) => x.id === id); if (!l) return '';
  const groups = []; for (const s of l.sets) { let g = groups.find((x) => x.ex === s.ex); if (!g) { g = { ex: s.ex, slot: s.slot, sets: [] }; groups.push(g); } g.sets.push(s); }
  return `<div class="grab-zone" aria-hidden="true"><div class="grab"></div></div><div class="row" style="justify-content:space-between"><div><div class="small mute">${DOW[new Date(l.start).getDay()]} ${shortDate(l.start)} · ${esc(l.gymName || '')}</div><h3>${esc(l.name)}</h3></div><button class="iconbtn" data-a="closeSheet" aria-label="Close">${ic('x', 18)}</button></div>
  <div class="tiles" style="margin:14px 0"><div class="tile" style="background:var(--raise)"><b>${l.minutes}</b><span>Minutes</span></div><div class="tile" style="background:var(--raise)"><b>${l.sets.length}</b><span>Sets</span></div><div class="tile" style="background:var(--raise)"><b>${l.rpe || '–'}</b><span>RPE</span></div></div>
  ${groups.map((g) => `<div class="setrow" style="cursor:default;align-items:flex-start;padding:10px 6px"><span class="small acc" style="width:34px;font-weight:700">${esc(g.slot)}</span><span class="grow"><span style="display:block;font-weight:600;font-size:15px">${esc(EX(g.ex).name)}</span><span class="small mute">${g.sets.map((s) => esc(setText(g.ex, s, true)) + (s.pr ? ' (PR)' : '')).join(' · ')}</span></span></div>`).join('')}
  ${l.notes ? `<div class="tip" style="margin-top:12px">${ic('edit', 18, 2.2, 'style="color:var(--accent)"')}<span>${esc(l.notes)}</span></div>` : ''}`;
}
function vBodySheet() {
  return `<div class="grab-zone" aria-hidden="true"><div class="grab"></div></div><h3 style="margin-bottom:14px">Body weight</h3><label class="field">Weight in ${U()} (morning, before breakfast is most consistent)<input id="bodyKg" inputmode="decimal" value="${bodyKg() != null ? fmtNum(W(bodyKg())) : ''}" placeholder="${U() === 'lb' ? 'e.g. 163' : 'e.g. 74.0'}"></label><button class="btn" data-a="saveBody">Save</button>`;
}

/* ---------- view: plan ---------- */
function vPlan() {
  const plan = S.data.plan, c = S.data.coros || {};
  if (!plan) return `<div class="view"><div class="empty">No plan yet.</div></div>`;
  const t = today0(), goal = parseD(plan.goal.date);
  const weeks = Math.max(0, Math.ceil((goal - t) / (7 * DAY)));
  const ph = phaseNow();
  let h = `<div class="view"><div class="head"><div><div class="sub">${esc(plan.goal.name)} · ${esc(plan.goal.dateLabel)}</div><h1>Plan</h1></div><div class="ring-wrap"><div class="lab"><b style="font-size:20px">${weeks}</b><small>WEEKS</small></div></div></div><div class="stack" style="gap:0">`;
  plan.phases.forEach((p, i) => {
    const now = ph && ph.id === p.id, past = parseD(p.end) < t;
    const s = parseD(p.start), e = parseD(p.end);
    const dates = `${s.getDate()} ${MON[s.getMonth()]} – ${e.getDate()} ${MON[e.getMonth()]}`;
    h += `<div class="tl"><div class="rail"><span class="node ${now ? 'now' : past ? 'past' : ''}"></span>${i < plan.phases.length ? '<i></i>' : ''}</div><div class="phase ${now ? 'now' : past ? 'past' : ''}"><div class="row" style="justify-content:space-between"><span style="font-size:15px;font-weight:${now ? 700 : 600}">${esc(p.name)}</span><span class="small ${now ? 'acc' : 'mute'}" style="${now ? 'font-weight:700' : ''}">${now ? `NOW · wk ${ph.wk} of ${ph.total}` : dates}</span></div><span class="small mute">${esc(p.summary)}</span>${now ? `<span class="small soft" style="margin-top:4px">${esc(p.detail || '')}</span><div class="bar"><i style="width:${Math.round(ph.frac * 100)}%"></i></div>` : ''}</div></div>`;
  });
  h += `<div class="tl"><div class="rail"><span style="margin-top:14px;color:var(--amber)">${ic('flag', 18, 2)}</span></div><div class="phase" style="outline:1px solid var(--amber)"><div class="row" style="justify-content:space-between"><span style="font-size:15px;font-weight:700">${esc(plan.goal.name)}</span><span class="small amb" style="font-weight:700">${esc(plan.goal.dateLabel)}</span></div></div></div>`;
  const others = (plan.events || []).filter((e) => e.name !== plan.goal.name);
  if (others.length) h += `<div class="sec"><span class="label">Other events</span></div>` + others.map((e) => `<div class="liftrow" style="margin-bottom:8px"><span class="grow"><span style="display:block;font-weight:600">${esc(e.name)}</span><span class="small mute">${esc(e.dateLabel || e.date || '')}</span></span><span class="tag">${esc(e.kind || '')}</span></div>`).join('');
  h += `<div class="sec"><span class="label">From COROS</span><span class="small mute">updated ${c.updated ? shortDate(c.updated) : '–'}</span></div>
    <div class="card pad"><div class="coros">
      <div><b>${c.ftp ? c.ftp + ' W' : '–'}</b><span>FTP</span></div>
      <div><b>${c.vo2max ?? '–'}</b><span>VO2max</span></div>
      <div><b>${c.loadRatio ?? '–'}</b><span>Load ratio${c.loadComment ? ' · ' + esc(c.loadComment) : ''}</span></div>
      <div><b>${c.last7 ? fmtNum(c.last7.hours) + ' h' : '–'}</b><span>Last 7 days</span></div>
      <div><b>${c.last7 && c.last7.bikeHours != null ? fmtNum(c.last7.bikeHours) + ' h' : '–'}</b><span>Bike, 7 days</span></div>
      <div><b>${c.halfPrediction || '–'}</b><span>Half prediction</span></div>
    </div></div>`;
  h += `</div></div>`;
  return h;
}

/* ---------- view: gyms ---------- */
function vGyms() {
  const g = S.data.gyms, cur = gym().id;
  const card = (x) => `<div class="row" style="gap:8px;margin-bottom:8px"><button class="opt ${x.id === cur ? 'best' : ''}" data-a="setGym" data-g="${esc(x.id)}" style="margin:0;flex:1;${x.unset ? 'border-style:dashed' : ''}"><span class="grow"><span style="display:block;font-size:15px;font-weight:600">${esc(x.name)}${x.airport ? ` <span class="mute" style="font-weight:500">· ${esc(x.airport)}</span>` : ''}</span><span class="small ${x.unset ? 'amb' : 'mute'}">${x.unset ? 'Not set up yet · tap the pencil to tick its equipment' : esc((x.equip || []).slice(0, 6).map((e) => EQ_NAME[e] || e).join(' · ')) + ((x.equip || []).length > 6 ? ` +${x.equip.length - 6}` : '')}${x.lastUsed ? ' · used ' + shortDate(x.lastUsed) : ''}</span></span>${x.id === cur ? '<span class="small acc" style="font-weight:700">Here</span>' : ''}</button><button class="iconbtn" data-a="editGym" data-g="${esc(x.id)}" aria-label="Edit ${esc(x.name)}">${ic('edit', 18)}</button></div>`;
  const home = g.gyms.filter((x) => x.group === 'home' && !x.archived), hotels = g.gyms.filter((x) => x.group !== 'home' && !x.archived).sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''));
  return `<div class="view"><div class="shead" style="margin-bottom:10px"><button class="iconbtn" data-a="back" aria-label="Back">${ic('back', 20)}</button><div class="mid" style="align-items:flex-start;padding-left:8px"><b style="font-size:22px">Where are you training?</b></div></div>
    <div class="label" style="margin:8px 4px">Home base</div>${home.map(card).join('')}
    <div class="label" style="margin:18px 4px 8px">Layover hotels</div>${hotels.map(card).join('') || '<div class="empty">No hotels yet.</div>'}
    <button class="btn ghost sm" data-a="editGym" data-g="" style="margin-top:6px;color:var(--accent)">${ic('plus', 18)} Add a gym or hotel</button></div>`;
}
const gymUnitSeg = () => `<span class="seg" role="group" aria-label="Weight unit"><button data-a="gymUnit" data-u="kg" class="${U() === 'kg' ? 'on' : ''}">kg</button><button data-a="gymUnit" data-u="lb" class="${U() === 'lb' ? 'on' : ''}">lb</button></span>`;
/* the dumbbell field shows the current unit; an untouched value keeps its stored kg so it never drifts through rounding */
function gymMaxKg(d) {
  const el = $('#gMax'); if (!el) return d.maxDB ?? null;
  const raw = el.value.trim(); if (raw === el.dataset.orig) return d.maxDB ?? null;
  const v = parseFloat(raw.replace(',', '.')); return isNaN(v) ? null : toKg(v);
}
function vGymSheet(id) {
  const x = id ? gym(id) : { id: '', name: '', airport: '', group: 'hotel', equip: ['dumbbells', 'bench'] };
  S.gymDraft = S.gymDraft && S.gymDraft._for === id ? S.gymDraft : { ...x, equip: [...(x.equip || [])], _for: id };
  const d = S.gymDraft;
  return `<div class="grab-zone" aria-hidden="true"><div class="grab"></div></div><h3 style="margin-bottom:14px">${id ? 'Edit ' + esc(x.name) : 'New gym or hotel'}</h3>
    <label class="field">Name<input id="gName" value="${esc(d.name)}" placeholder="e.g. Chicago hotel"></label>
    <div class="row" style="gap:10px"><label class="field grow">Airport code<input id="gAirport" value="${esc(d.airport || '')}" maxlength="4" placeholder="ORD" style="text-transform:uppercase"></label>
    <label class="field grow">Type<select id="gGroup"><option value="hotel" ${d.group !== 'home' ? 'selected' : ''}>Layover hotel</option><option value="home" ${d.group === 'home' ? 'selected' : ''}>Home base</option></select></label></div>
    <div class="field">Equipment – tick what it has<div class="wrapchips" style="margin-top:4px">${EQUIP.map(([k, l]) => `<button class="chip ${d.equip.includes(k) ? 'on' : ''}" data-a="toggleEq" data-e="${k}">${l}</button>`).join('')}</div></div>
    <div class="field"><span class="row" style="justify-content:space-between">Heaviest dumbbell (optional)${gymUnitSeg()}</span><span class="row" style="gap:10px"><input id="gMax" inputmode="decimal" value="${d.maxDB == null ? '' : fmtNum(W(d.maxDB))}" data-orig="${d.maxDB == null ? '' : fmtNum(W(d.maxDB))}" aria-label="Heaviest dumbbell in ${U()}" style="flex:1"><span class="mute" style="width:44px">${U() === 'lb' ? 'lb' : 'kg'}</span></span></div>
    <button class="btn" data-a="saveGym">Save</button>
    ${id ? `<button class="btn danger sm" data-a="archiveGym" data-g="${esc(id)}" style="margin-top:10px">Archive (hotel changed)</button>` : ''}`;
}

/* ---------- view: settings ---------- */
function vSettings() {
  const c = S.cfg;
  return `<div class="view"><div class="shead" style="margin-bottom:10px">${S.data && S.data.programme ? `<button class="iconbtn" data-a="back" aria-label="Back">${ic('back', 20)}</button>` : ''}<div class="mid" style="align-items:flex-start;padding-left:8px"><b style="font-size:22px">Settings</b></div></div>
    <div class="card pad"><div class="label" style="margin-bottom:12px">GitHub connection</div>
      <label class="field">GitHub username<input id="cOwner" value="${esc(c.owner)}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <label class="field">Data repository<input id="cRepo" value="${esc(c.repo)}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <label class="field">Access key (stays on this phone)<input id="cToken" type="password" value="${esc(c.token)}" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="github_pat_…"></label>
      <button class="btn sm" data-a="saveCfg">Save and connect</button>
      <div id="status" style="margin-top:4px">${statusLine()}</div></div>
    <div class="card pad" style="margin-top:14px"><div class="label" style="margin-bottom:6px">Workout</div>
      <div class="row" style="justify-content:space-between;min-height:52px"><span>Rest between rounds</span><span class="row" style="gap:6px"><button class="iconbtn" data-a="restCfg" data-d="-15" aria-label="Shorter rest">−</button><b style="width:48px;text-align:center">${fmtTime(c.rest)}</b><button class="iconbtn" data-a="restCfg" data-d="15" aria-label="Longer rest">+</button></span></div>
      <div class="row" style="justify-content:space-between;min-height:52px"><span>Weight unit</span>${unitSeg()}</div>
      <button class="toggle" data-a="soundCfg"><span>Chime when rest ends</span><span class="sw ${c.sound ? 'on' : ''}"></span></button>
      <button class="toggle" data-a="go" data-v="gyms"><span>Gyms and hotels</span><span class="mute">${ic('chev', 16)}</span></button></div>
    <div class="card pad" style="margin-top:14px"><div class="label" style="margin-bottom:10px">Data</div>
      <button class="btn ghost sm" data-a="sync">Sync now</button>
      <button class="btn ghost sm" data-a="export" style="margin-top:8px">Export backup</button>
      <button class="btn ghost sm" data-a="forceUpdate" style="margin-top:8px">Get the latest version</button>
      <button class="btn danger sm" data-a="reset" style="margin-top:8px">${S.confirmReset ? 'Tap again to clear this phone' : 'Clear this phone and reload from GitHub'}</button>
      <div class="small mute" style="margin-top:12px">Version ${APP_VERSION} · ${Object.keys(S.logs).length} sessions on this phone</div></div></div>`;
}

/* ---------- sheet & toast ---------- */
function openSheet(kind, arg) { S.sheet = { kind, arg }; renderSheet(); $('#sheet').scrollTop = 0; document.documentElement.classList.add('locked'); $('#sheet').classList.add('on'); $('#scrim').classList.add('on'); }
function renderSheet() {
  if (!S.sheet) return; const { kind, arg } = S.sheet; let h = '';
  if (kind === 'swap') h = vSwapSheet(arg); else if (kind === 'finish') h = vFinishSheet();
  else if (kind === 'lift') h = vLiftSheet(arg); else if (kind === 'log') h = vLogSheet(arg); else if (kind === 'body') h = vBodySheet(); else if (kind === 'gym') h = vGymSheet(arg);
  $('#sheet').innerHTML = h;
}
function closeSheet() { document.documentElement.classList.remove('locked'); S.sheet = null; S.gymDraft = null; S.confirmDiscard = false; $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); }
let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

/* ---------- actions ---------- */
const A = {
  back() { S.stack = S.stack || []; let to = S.stack.pop(); while (to === S.view) to = S.stack.pop(); S.view = to || 'today'; S.editing = null; render(); toTop(); },
  go(d) { S.stack = S.stack || []; if (['today', 'progress', 'plan'].includes(d.v)) S.stack = []; else if (d.v !== S.view) S.stack.push(S.view); S.view = d.v; S.editing = null; render(); toTop(); },
  pick(d) { S.pick = d.s || null; render(); },
  choose(d) { S.pick = d.s; S.view = 'today'; render(); toTop(); },
  genQuick(d) { if (d.f === 'snack') { const keep = S.gen; generate('snack'); S.gen = keep; S.snackShuffle = { ...(S.lastGen), id: 'snack', key: 'snack-' + ymd(today0()) + '-' + gym().id }; S.pick = 'snack'; } else S.pick = generate(d.f); S.view = 'today'; render(); toTop(); },
  selDay(d) { S.selDay = d.d === ymd(today0()) ? null : d.d; S.pick = null; S.weekOff = Math.round((weekStart(parseD(d.d)) - weekStart(today0())) / (7 * DAY)); render(); },
  weekNav(d) { S.weekOff = (S.weekOff || 0) + +d.d; render(); },
  monthNav(d) { S.monthOff = (S.monthOff || 0) + +d.d; render(); },
  calMode() {
    S.cal = S.cal === 'month' ? 'week' : 'month'; LS.set('cal', S.cal);
    const sel = S.selDay ? parseD(S.selDay) : today0(), t = today0();
    S.monthOff = (sel.getFullYear() - t.getFullYear()) * 12 + sel.getMonth() - t.getMonth();
    render();
  },
  start(d) { if (S.active && !S.confirmNew) { S.confirmNew = true; toast('A session is in progress – tap Start again to replace it'); setTimeout(() => { S.confirmNew = false; }, 4000); return; } S.confirmNew = false; startSession(d.s); },
  resume() { S.view = 'session'; unlockAudio(); wake(); toTop(); S.follow = 'jump'; render(); },
  sync() { sync(true); },
  step(d) { const s = S.active.items[+d.i].sets[+d.r]; const f = d.f, delta = parseFloat(d.d); if (f === 'kg') { const cur = W(s.kg || 0); s.kg = Math.max(0, toKg(Math.round((cur + delta) * 100) / 100)); } else s[f] = Math.max(0, Math.round(((s[f] || 0) + delta) * 100) / 100); save('active'); const inp = document.querySelector(`input[data-in="${f}"][data-i="${d.i}"][data-r="${d.r}"]`); if (inp) inp.value = fmtNum(f === 'kg' ? W(s.kg) : s[f]); },
  logSet(d) { unlockAudio(); logSet(+d.i, +d.r); },
  editSet(d) { const a = S.active; const k = a.steps.findIndex(([i, r]) => i === +d.i && r === +d.r); if (k >= 0) a.cur = k; S.editing = d.i + ':' + d.r; save('active'); render(); },
  jump(d) { const a = S.active; const k = a.steps.findIndex(([i, r]) => i === +d.i && r === +d.r); if (k >= 0) a.cur = k; S.editing = null; save('active'); render(); },
  jumpStep(d) { const k = +d.k; if (k >= 0) { S.active.cur = k; S.editing = null; save('active'); } closeSheet(); render(); toTop(); },
  addSet(d) { const it = S.active.items[+d.i]; const last = it.sets[it.sets.length - 1]; it.sets.push({ ...last, done: false, pr: false }); S.active.steps = buildSteps(S.active.items); save('active'); render(); },
  delSet(d) { const it = S.active.items[+d.i]; if (it.sets.length > 1 && !it.sets[it.sets.length - 1].done) { it.sets.pop(); const cur = S.active.steps[S.active.cur]; S.active.steps = buildSteps(S.active.items); const k = cur ? S.active.steps.findIndex(([i, r]) => i === cur[0] && r === cur[1]) : -1; S.active.cur = k >= 0 ? k : Math.max(0, nextOpenAfter(-1)); save('active'); render(); } },
  skipEx(d) { const a = S.active, it = a.items[+d.i]; it.sets.forEach((s) => { if (!s.done) s.skipped = true; }); a.rest = null; S.editing = null; const nxt = nextOpenAfter(a.cur); if (nxt >= 0) { a.cur = nxt; S.follow = true; } save('active'); render(); toast(nxt >= 0 ? 'Skipped ' + EX(it.ex).name : 'All done – tap Finish'); },
  unskipEx(d) { const a = S.active, it = a.items[+d.i]; it.sets.forEach((s) => { s.skipped = false; }); const k = a.steps.findIndex(([i, r]) => i === +d.i && !it.sets[r].done); if (k >= 0) a.cur = k; save('active'); render(); },
  swapSheet(d) { S.remember = true; openSheet('swap', +d.i); },
  doSwap(d) { doSwap(+d.i, d.x); },
  doSwapCustom(d) { const v = ($('#exSearch') || {}).value; if (!v || !v.trim()) { toast('Type an exercise name'); return; } doSwap(+d.i, 'custom:' + v.trim().slice(0, 60)); },
  toggleRemember() { S.remember = S.remember === false; const sw = $('#remSw'); if (sw) sw.classList.toggle('on', S.remember !== false); },
  finish() { openSheet('finish'); },
  rpe(d) { S.active.rpe = +d.n; const n = $('#notes'); if (n) S.active.notes = n.value; save('active'); renderSheet(); },
  saveSession() { saveSession(); },
  discard() { if (!S.confirmDiscard) { const n = $('#notes'); if (n) S.active.notes = n.value; S.confirmDiscard = true; renderSheet(); return; } S.active = null; save('active'); releaseWake(); closeSheet(); S.view = 'today'; render(); toast('Session discarded'); },
  restAdd() { const r = S.active.rest; if (r) { r.end += 15000; r.total += 15; r.chimed = false; save('active'); renderRest(); } },
  restSkip() { S.active.rest = null; save('active'); renderRest(); },
  closeSheet() { closeSheet(); },
  progFilter(d) { S.progFilter = d.f; render(); },
  liftSheet(d) { openSheet('lift', d.x); },
  logSheet(d) { openSheet('log', d.id); },
  bodySheet() { openSheet('body'); },
  saveBody() { const v = toKg(parseFloat(($('#bodyKg') || {}).value)); if (!(v > 30 && v < 250)) { toast('Enter your weight in ' + U()); return; } const b = S.data.body = S.data.body || { entries: [] }; const t = ymd(new Date()); b.entries = b.entries.filter((e) => e.date !== t); b.entries.push({ date: t, kg: Math.round(v * 10) / 10 }); save('data'); invalidate(); enqueue({ kind: 'file', name: 'body', data: b }); closeSheet(); render(); toast('Weight saved'); },
  setGym(d) { S.data.gyms.current = d.g; LS.set('hereSet', ymd(today0())); save('data'); enqueue({ kind: 'file', name: 'gyms', data: S.data.gyms }); S.stack = []; S.view = 'today'; render(); },
  setGymHere(d) { S.data.gyms.current = d.g; LS.set('hereSet', ymd(today0())); save('data'); enqueue({ kind: 'file', name: 'gyms', data: S.data.gyms }); render(); },
  editGym(d) { S.gymDraft = null; openSheet('gym', d.g); },
  gymUnit(d) {
    const dr = S.gymDraft; if (!dr || (d.u === 'lb') === (U() === 'lb')) return;
    dr.name = $('#gName').value; dr.airport = $('#gAirport').value; dr.group = $('#gGroup').value; dr.maxDB = gymMaxKg(dr);
    S.cfg.unit = d.u === 'lb' ? 'lb' : 'kg'; save('cfg'); renderSheet();
  },
  toggleEq(d, el) { const dr = S.gymDraft; const i = dr.equip.indexOf(d.e); if (i >= 0) dr.equip.splice(i, 1); else dr.equip.push(d.e); el.classList.toggle('on', i < 0); },
  saveGym() {
    const dr = S.gymDraft; const name = ($('#gName').value || '').trim(); if (!name) { toast('Give it a name'); return; }
    const airport = ($('#gAirport').value || '').trim().toUpperCase(); const group = $('#gGroup').value; const mx = gymMaxKg(dr);
    const list = S.data.gyms.gyms;
    if (dr._for) { const g = list.find((x) => x.id === dr._for); Object.assign(g, { name, airport, group, equip: dr.equip, maxDB: mx }); delete g.unset; }
    else { const id = (airport || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + uid().slice(0, 4); list.push({ id, name, airport, group, equip: dr.equip, maxDB: mx, lastUsed: null }); S.data.gyms.current = id; }
    save('data'); enqueue({ kind: 'file', name: 'gyms', data: S.data.gyms }); closeSheet(); render(); toast('Saved');
  },
  archiveGym(d) { const g = S.data.gyms.gyms.find((x) => x.id === d.g); if (!g) return; g.archived = true; if (S.data.gyms.current === g.id) S.data.gyms.current = S.data.gyms.gyms.find((x) => !x.archived).id; save('data'); enqueue({ kind: 'file', name: 'gyms', data: S.data.gyms }); closeSheet(); render(); toast('Archived'); },
  async saveCfg() {
    S.cfg.owner = $('#cOwner').value.trim(); S.cfg.repo = $('#cRepo').value.trim() || 'train-data'; S.cfg.token = $('#cToken').value.trim(); save('cfg');
    if (!configured()) { toast('Fill in all three'); return; }
    toast('Connecting…'); await sync(false);
    if (S.syncErr) toast(S.syncErr); else { toast('Connected'); S.view = 'today'; render(); }
  },
  unit(d) { S.cfg.unit = d.u === 'lb' ? 'lb' : 'kg'; save('cfg'); if (S.sheet) renderSheet(); render(); toast(S.cfg.unit === 'lb' ? 'Showing pounds – stored as kg' : 'Showing kilograms'); },
  restCfg(d) { S.cfg.rest = Math.max(30, Math.min(300, (S.cfg.rest || 90) + +d.d)); save('cfg'); render(); },
  soundCfg() { S.cfg.sound = !S.cfg.sound; save('cfg'); unlockAudio(); if (S.cfg.sound) chime(); render(); },
  async forceUpdate() {
    if (S.active) { toast('Finish your session first'); return; }
    toast('Updating…');
    try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); } catch (e) { /* ignore */ }
    try { const keys = await caches.keys(); await Promise.all(keys.filter((k) => k !== 'train-fonts').map((k) => caches.delete(k))); } catch (e) { /* ignore */ }
    location.replace(location.pathname + '?u=' + Date.now());
  },
  export() { const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), data: S.data, logs: S.logs, queue: S.queue }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `train-backup-${ymd(new Date())}.json`; document.body.appendChild(a); a.click(); a.remove(); },
  reset() { if (!S.confirmReset) { S.confirmReset = true; render(); setTimeout(() => { S.confirmReset = false; }, 5000); return; } if (S.queue.length) { toast(`${S.queue.length} changes not synced yet – sync first`); S.confirmReset = false; render(); return; } for (const k of ['data', 'logs', 'queue', 'active', 'lastSync', 'devfiles']) localStorage.removeItem('tr_' + k); location.reload(); },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target; if (!el.dataset || !el.dataset.in || !S.active) return;
  const s = S.active.items[+el.dataset.i].sets[+el.dataset.r]; const v = parseFloat(String(el.value).replace(',', '.'));
  s[el.dataset.in] = isNaN(v) ? null : Math.max(0, el.dataset.in === 'kg' ? toKg(v) : v); save('active');
});
document.addEventListener('input', (e) => { const el = e.target; if (el.dataset && el.dataset.search != null) { const box = $('#exResults'); if (box) box.innerHTML = searchResults(+el.dataset.search, el.value); } });
document.addEventListener('focusin', (e) => { if (e.target.dataset && e.target.dataset.in) setTimeout(() => e.target.select(), 0); });

/* sheet: drag down to close, and stop the page behind from scrolling */
(function sheetDrag() {
  const sh = $('#sheet'); let y0 = null, dy = 0, drag = false, fromGrab = false;
  sh.addEventListener('touchstart', (e) => { if (!sh.classList.contains('on')) return; fromGrab = !!e.target.closest('.grab-zone'); if (fromGrab || sh.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; drag = false; } else y0 = null; }, { passive: true });
  sh.addEventListener('touchmove', (e) => {
    if (y0 == null) return; dy = e.touches[0].clientY - y0;
    if (dy > 0 && (fromGrab || sh.scrollTop <= 0)) { drag = true; e.preventDefault(); sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; }
    else if (fromGrab) e.preventDefault();
  }, { passive: false });
  const end = () => { if (y0 == null) return; sh.style.transition = ''; sh.style.transform = ''; if (drag && dy > 90) closeSheet(); y0 = null; drag = false; };
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', end);
  $('#scrim').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
})();

/* screens with a back arrow: swipe right, or pull down from the top, to go back */
(function backSwipe() {
  const BACKABLE = ['choose', 'gyms', 'settings', 'session'];

  let x0 = null, y0 = 0, dx = 0, dy = 0, mode = null, el = null;
  document.addEventListener('touchstart', (e) => {
    x0 = null;
    if (!BACKABLE.includes(S.view) || S.sheet || e.touches.length > 1 || e.target.closest('.chips, input, textarea, .week, .month')) return;
    if (S.view === 'settings' && !(S.data && S.data.programme)) return;
    if (S.view === 'session' && e.touches[0].clientX > 32) return; // in a workout only an edge swipe goes back
    el = $('#app > .view'); if (!el) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; dy = 0; mode = null;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (x0 == null || mode === 'none') return;
    dx = e.touches[0].clientX - x0; dy = e.touches[0].clientY - y0;
    if (!mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      mode = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : S.view !== 'session' && dy > 0 && dy > Math.abs(dx) && window.scrollY <= 0 ? 'y' : 'none';
      if (mode === 'none') return;
      el.style.animation = 'none'; el.style.transition = 'none';
    }
    e.preventDefault();
    const f = mode === 'x' ? Math.max(0, dx) / window.innerWidth : Math.max(0, dy) / 500;
    el.style.transform = mode === 'x' ? `translateX(${Math.max(0, dx)}px)` : `translateY(${Math.max(0, dy) * 0.5}px)`;
    el.style.opacity = String(1 - Math.min(0.5, f));
  }, { passive: false });
  let swallowUntil = 0;
  document.addEventListener('click', (e) => { if (Date.now() < swallowUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
  const end = (e) => {
    if (x0 == null) return;
    x0 = null;
    if (!mode || mode === 'none') return;
    if (e.cancelable) e.preventDefault();
    swallowUntil = Date.now() + 450;
    const leave = mode === 'x' ? dx > 90 : dy > 140, from = S.view;
    el.style.transition = 'transform .22s var(--ease), opacity .22s';
    if (leave) { el.style.transform = mode === 'x' ? 'translateX(100%)' : 'translateY(35%)'; el.style.opacity = '0'; setTimeout(() => { if (S.view === from) { if (from === 'session') A.go({ v: 'today' }); else A.back(); } }, 200); }
    else { el.style.transform = ''; el.style.opacity = ''; }
    mode = null;
  };
  document.addEventListener('touchend', end, { passive: false }); document.addEventListener('touchcancel', end);
})();

/* ---------- boot ---------- */
(async function boot() {
  try { history.scrollRestoration = 'manual'; } catch (e) { /* older browsers */ }
  setTimeout(nudgeViewport, 60); setTimeout(nudgeViewport, 600);
  if (S.active) wake();
  if (S.data && S.data.programme) { S.view = S.active ? 'session' : 'today'; S.follow = S.active ? 'jump' : false; render(); if (configured()) syncSoon(300); return; }
  if (!configured()) { S.view = 'settings'; render(); return; }
  S.view = 'loading'; render();
  try { await pullAll(); S.lastSync = Date.now(); save('lastSync'); } catch (e) { S.syncErr = e.message; }
  S.view = S.data && S.data.programme ? 'today' : 'settings'; render();
  if (S.syncErr) toast(S.syncErr);
})();
