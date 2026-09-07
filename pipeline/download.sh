#!/usr/bin/env bash
# Downloads input data: the PID GTFS, the OSM extract (Geofabrik), MapLibre GL.
# Everything is cached — re-running only fetches what is missing.
#
# Praha: ROPID publishes ONE GTFS for the whole of Pražská integrovaná
# doprava — Prague and Central Bohemia (pid.cz/opendata, refreshed weekly
# with a two-week horizon). The map is the city and its ring, so the scope is
# a precomputed allowlist (pipeline/scope.mjs → data/scope.json).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/osm/tiles web/vendor

need_osmium () {
  python3 -c "import osmium" 2>/dev/null && return 0
  echo "brak pakietu osmium — zainstaluj: pip3 install --user osmium" >&2
  return 1
}

# 1) GTFS — the whole PID
if [ ! -f data/gtfs/routes.txt ]; then
  echo "== PID GTFS =="
  curl -fL --retry 3 --max-time 900 -o data/PID_GTFS.zip "https://data.pid.cz/PID_GTFS.zip"
  mkdir -p data/gtfs
  unzip -q -o data/PID_GTFS.zip -d data/gtfs
fi

# 1b) scope: which of the 890 PID routes belong on a PRAGUE map
if [ ! -f data/scope.json ]; then
  node --max-old-space-size=8192 pipeline/scope.mjs
fi

# 2) OSM — from the Geofabrik extract; pipeline/pbf-tiles.py cuts the 5 × 5
#    road grid (the city and its 35 km ring) and the rail file (to the ends of
#    the Esko S-lines) in the JSON shape Overpass would have returned.
if [ ! -f data/osm/tiles/t25.json ] || [ ! -f data/osm/praha-rail.json ]; then
  need_osmium
  if [ ! -f data/czech-republic-latest.osm.pbf ]; then
    echo "== Geofabrik czech-republic-latest.osm.pbf =="
    curl -fL --retry 5 --retry-delay 5 -C - --max-time 3600 -o data/czech-republic-latest.osm.pbf \
      "https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf"
  fi
  echo "== cutting OSM tiles out of the extract =="
  python3 pipeline/pbf-tiles.py
fi

# 3) MapLibre GL (vendored, no CDN at runtime)
if [ ! -f web/vendor/maplibre-gl.js ]; then
  echo "== MapLibre GL =="
  curl -fL --retry 3 -o web/vendor/maplibre-gl.js  https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js
  curl -fL --retry 3 -o web/vendor/maplibre-gl.css https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css
fi

echo "OK — data ready:"
du -sh data/gtfs data/osm 2>/dev/null || true
