# Praha Public Transport — interactive map

Interactive, poster-grade map of public transport in **Prague and its ring**:
the PID buses and trolleybuses, all the trams, the three metro lines and the
Esko S-lines of the 25 km ring — drawn along the real street and track
geometry.

## Live

**https://miqell24.github.io/praha-bus-map/** — GitHub Pages serves
`main:/docs`; local build on port 8183 (`npm run serve`).

Everything comes from ONE feed — the **PID GTFS** ROPID publishes for the
whole of Pražská integrovaná doprava (<https://pid.cz/en/opendata/>,
`data.pid.cz/PID_GTFS.zip`, refreshed weekly with a two-week horizon): Prague
*and* Central Bohemia, 890 routes from Kladno to Kolín. The map is the city
and its ring, so its scope is a precomputed allowlist (`pipeline/scope.mjs` →
`data/scope.json`):

| mode | route_type | scope | graph |
|---|---|---|---|
| buses | 3 | ≥50% of stops within 20 km of Můstek, no stop past 35 km | OSM roadways |
| trolleybuses | 11 | the same rule — 51–59 and 275, green | OSM roadways |
| trams | 0 | all 35 routes, family red | `railway=tram` |
| metro | 1 | A, B, C in the feed's colours | `railway=subway` |
| Esko trains | 2 (S…) | ≥50% of stops within 25 km, no stop past 60 km — 20 S-lines in PID's navy | `railway=rail` |

Cut deliberately: the R and U regional trains, the S-lines of the outer
region (S30–S99 around Kolín and Nymburk), the ferries (route_type 4 — the
engine has no water graph).

Line keys need nothing invented: PID numbers every line uniquely across the
system — trams 1–26 and the night 91–99, buses 100–999 with the night 901–918
and 951–963, trolleybuses 51–59, metro A/B/C, trains S1–S99 — so every key is
the number the stop flag shows. Night lines (9x trams, 9xx and X9x buses)
print at the end of their lists, the trolleybuses at the head of the bus
list.

## Pipeline

`npm run download` fetches the feed, computes the scope and cuts the OSM
extract. **The OSM data comes from Geofabrik, not Overpass**:
`czech-republic-latest.osm.pbf` comes down once and `pipeline/pbf-tiles.py`
(needs `pip3 install --user osmium`) cuts a 5 × 5 road grid over the city and
its 35 km ring (72 × 68 km) and the rail file out to the ends of the Esko
lines, writing exactly the JSON shape Overpass would have returned, node ids
included.

`npm run build` map-matches every line (HMM/Viterbi on the OSM graphs) and
writes GeoJSON to `data/out/`; `npm run lines` adds the line-by-line view;
`npm run audit` checks the drawn result. `npm run serve` hosts the map at
<http://localhost:8183>.

Data: ROPID / PID (GTFS) · base map © OpenFreeMap / OpenMapTiles /
OpenStreetMap contributors.
