// Wyznacza zakres mapy Pragi z feedu CAŁEGO systemu PID (Praha + Kraj
// Środkowoczeski — 890 tras od Kladna po Kolín) i zapisuje listy route_id
// do data/scope.json:
//
//  autobusy i trolejbusy (route_type 3 i 11):
//   - linia należy do mapy, gdy >=50% jej przystanków leży w promieniu 20 km
//     od Můstku (50.083, 14.424) — to miasto (100–299), linie nocne (9xx)
//     i pierścień podmiejski (300–499, 6xx Kladna i Berouna), który do Pragi
//     dojeżdża;
//   - odpada linia z przystankiem dalej niż 35 km — jeden kurs do Benešova
//     rozciągałby kadr na pół kraju.
//  tramwaje (0), metro (1): wszystkie — to sieć wyłącznie miejska.
//  kolej Esko (2, nazwy S…): reguła promienia 25 km (>=50%) z limitem 60 km
//   — S1, S2… po Český Brod, Beroun, Kralupy, Benešov; linie R i U (pociągi
//   regionalne dalekobieżne) i S-ki poza kadrem (S30–S99 Kolína, Nymburka)
//   zostają poza mapą.
//  poza mapą: przywozy (4, przeprawy przez Wełtawę — silnik nie ma grafu wodnego).
//
// Uruchamiane przez download.sh po pobraniu GTFS; build.mjs wymaga wyniku.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { iterCsv, readCsv } from './lib/csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GD = join(ROOT, 'data/gtfs');

const CX = 14.424, CY = 50.083;          // Můstek
const CORE_KM = 20, CORE_SHARE = 0.5, CAP_KM = 35;
const RAIL_CORE_KM = 25, RAIL_CAP_KM = 60;

const t0 = Date.now();
const log = (m) => console.log(`[scope ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

const candidates = new Map();   // route_id → 'bus' | 'rail'
const names = new Map();
for (const r of await readCsv(join(GD, 'routes.txt'))) {
  const t = (r.route_type || '').trim(), sn = (r.route_short_name || '').trim();
  names.set(r.route_id, sn);
  if (t === '3' || t === '11') candidates.set(r.route_id, 'bus');
  else if (t === '2' && /^S\d/.test(sn)) candidates.set(r.route_id, 'rail');
}
log(`kandydatów: ${[...candidates.values()].filter((v) => v === 'bus').length} bus, `
  + `${[...candidates.values()].filter((v) => v === 'rail').length} Esko`);

const mx = 111320 * Math.cos(CY * Math.PI / 180), my = 111132;
const stopKm = new Map();
for await (const s of iterCsv(join(GD, 'stops.txt'))) {
  const lat = Number(s.stop_lat), lon = Number(s.stop_lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) stopKm.set(s.stop_id, Math.hypot((lon - CX) * mx, (lat - CY) * my) / 1000);
}
const t2r = new Map();
for await (const t of iterCsv(join(GD, 'trips.txt'))) if (candidates.has(t.route_id)) t2r.set(t.trip_id, t.route_id);
const rStops = new Map();
for await (const st of iterCsv(join(GD, 'stop_times.txt'))) {
  const rid = t2r.get(st.trip_id);
  if (!rid) continue;
  let s = rStops.get(rid);
  if (!s) rStops.set(rid, (s = new Set()));
  s.add(st.stop_id);
}

const out = { bus: [], rail: [] };
const cut = { bus: 0, rail: 0 };
for (const [rid, stops] of rStops) {
  const kind = candidates.get(rid);
  const core = kind === 'rail' ? RAIL_CORE_KM : CORE_KM;
  const cap = kind === 'rail' ? RAIL_CAP_KM : CAP_KM;
  let n = 0, inside = 0, max = 0;
  for (const sid of stops) {
    const d = stopKm.get(sid);
    if (d === undefined) continue;
    n++; if (d <= core) inside++; if (d > max) max = d;
  }
  if (!n || inside / n < CORE_SHARE) continue;
  if (max > cap) { cut[kind]++; continue; }
  out[kind].push(rid);
}
for (const k of ['bus', 'rail']) out[k].sort();
log(`wybrano: bus ${out.bus.length} (odrzucone limitem: ${cut.bus}), Esko ${out.rail.length} (${cut.rail}): `
  + out.rail.map((id) => names.get(id)).sort().join(', '));
writeFileSync(join(ROOT, 'data/scope.json'), JSON.stringify(out, null, 0));
log('zapisano data/scope.json');
