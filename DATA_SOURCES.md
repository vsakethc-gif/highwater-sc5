# Data sources

Every source below was checked with a real request on **Saturday, October 17, 2026**. Trimmed real responses are saved in [`tests/fixtures/`](tests/fixtures/).

**"Browser OK?"** means the source allows a web page to call it directly. Technically, it sends the CORS header `Access-Control-Allow-Origin`. Sources that don't allow this need a helper (our Cloudflare Worker or a scheduled GitHub Action).

## Summary

| # | Source | Works? | Browser OK? | Key? | Used for | Phase |
|---|---|---|---|---|---|---|
| 1a | USGS Water Data API (new) | Yes | Yes | Optional | Live gauge readings + trend | 1 |
| 1b | USGS WaterServices (legacy) | Yes, **retiring early 2027** | Yes | No | Fallback only | 1 |
| 2 | NOAA NWPS | Yes | Yes | No | Official flood stages, USGS↔NWS ID link | 1–2 |
| 3 | NWS alerts | Yes | Yes* | No | All official alerts | 1 |
| 4 | NWS gridpoint forecast | Yes | Yes* | No | Rain in next 24/48 h | 2 |
| 5 | FEMA NFHL flood zones | Yes | Yes | No | Point flood zone, tract exposure, route crossings | 2 |
| 6 | Census ACS 5-year (2020–2024) | Yes | n/a (script only) | **Yes (required)** | Vulnerability measures | 2 |
| 7 | Census boundary files | Yes | n/a (script only) | No | Tract + county outlines | 2 |
| 7b | Census TIGERweb | Yes | — | No | Verified county FIPS codes | 1 |
| 8 | Census Geocoder | Yes | **No** | No | Address search (via Worker) | 2+ |
| 9 | OpenRouteService | Yes (via Worker); **was unresponsive on Oct 18, see below** | via Worker only | **Yes** | Routes that avoid hazard areas | 4 |
| 9b | OSRM demo server | Yes | Yes | No | Fallback route (no avoidance) | 4 |
| 10 | FEMA Open Shelters | Yes | Yes | No | Open shelters | 4 |
| 11 | SC 511 road closures | **No public feed found** | — | — | Skipped | — |
| 14 | OpenFreeMap basemap | Yes | Yes | No | Map background | 2 |
| 15 | Census ZCTA Gazetteer | Yes | n/a (script only) | No | ZIP code centers | 2 |
| 12 | Supabase | Yes (project `nywkprgdvishxicumtvx`) | Yes | Publishable key (public) + secret key (Worker only) | Community reports database | 5 |
| 13 | Cloudflare Turnstile | Yes (widget `sc5-ready`) | Yes | Site key (public) + secret (Worker) | Spam protection | 5 |

\* NWS rejects requests that send **no** `User-Agent` header (we got `403`). Browsers always send their own, and that is accepted (`200`).

---

## 1a. USGS Water Data API (primary)

- **Docs:** https://api.waterdata.usgs.gov/docs/ogcapi/
- **Latest reading, several gauges at once:**
  `https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&parameter_code=00065&monitoring_location_id=USGS-02146000,USGS-02147020`
- **Recent series (for trend and sparkline):**
  `.../collections/continuous/items?f=json&monitoring_location_id=USGS-02146000&parameter_code=00065&time=PT6H&limit=1000`
  (`time=PT6H` means "the last 6 hours"; `properties=` and `skipGeometry=true` shrink the response.)
- **Gauge list for a county:** `.../collections/monitoring-locations/items?f=json&state_code=45&county_code=091&site_type_code=ST`
- **Parameters:** `00065` = gage height (ft), `00060` = discharge (ft³/s).
- **Auth:** none required. A free key raises the rate limit. Responses showed no `X-RateLimit` headers, so **the keyless limit is unknown**. The docs say a `429 Too Many Requests` error means you hit it.
- **Browser OK:** yes (`Access-Control-Allow-Origin: *`).
- **Updates:** about every 15 minutes. Values are **provisional** (`"approval_status": "Provisional"`).
- **License:** U.S. public domain. Credit: "U.S. Geological Survey."
- **Quirks:**
  - Values are strings (`"5.11"`), so convert to numbers.
  - A bounding-box search also returns North Carolina gauges and dead gauges (one had a 2021 reading), so we use a fixed gauge list per county and ignore old readings.
  - IDs carry a `USGS-` prefix.

## 1b. USGS WaterServices, legacy (fallback)

- **URL:** `https://waterservices.usgs.gov/nwis/iv/?format=json&countyCd=45091&parameterCd=00065,00060&siteStatus=active&period=PT6H`
- **Result:** 10 active York County gauges, readings about 15 minutes old, all qualified `P` (provisional). Browser OK.
- **Being retired:** USGS says degradation starts November 2026, with outages in January 2027 and shutdown in early 2027 ([USGS blog](https://waterdata.usgs.gov/blog/api-waterservices-decom/), [Summer 2026 update](https://waterdata.usgs.gov/blog/api-updates-2026/)). **Judging happens after that starts, so this is a fallback only.**
- **Quirk:** some gauges return an empty discharge series (gage height only).

## 2. NOAA National Water Prediction Service (NWPS)

- **Docs:** https://api.water.noaa.gov/nwps/v1/docs/
- **Gauges in an area:** `https://api.water.noaa.gov/nwps/v1/gauges?bbox.xmin=-81.9&bbox.ymin=33.9&bbox.xmax=-80.1&bbox.ymax=35.2&srid=EPSG_4326` (87 gauges)
- **One gauge:** `https://api.water.noaa.gov/nwps/v1/gauges/ALIS1`
- **What we get:**
  - `usgsId`, which links NOAA's ID to USGS's: `ALIS1` ↔ `021457492`, `CTBS1` ↔ `02147020`.
  - `flood.categories` with official stages, e.g. Allison Creek: action 12 ft, minor 14, moderate 19, major 22.
  - `status.observed.floodCategory` (`no_flooding`, `not_defined`, `out_of_service`, `obs_not_current`, ...).
- **Auth:** none. **Browser OK:** yes.
- **Quirks:**
  - Missing numbers are `-9999` or `-999`, never `null`. Treat those as "no data."
  - `not_defined` means the gauge has no official flood stage. We never invent one (brief §5.1).
- **Plan:** a script saves the USGS↔NWS link and thresholds to a static file. The app compares each live reading to them, so every status traces to a visible rule.

## 3. NWS alerts

- **URL:** `https://api.weather.gov/alerts/active?area=SC` (GeoJSON)
- **Auth:** none. Scripts send `User-Agent: Highwater (vsakethc-gif.github.io/highwater-sc5)` as NWS asks.
- **Browser OK:** yes (`*`). Cache is 5 seconds. About 5 KB gzipped.
- **Matching alerts to counties:**
  - `geocode.SAME` lists county codes as `0` + FIPS (`045057` = Lancaster).
  - `geocode.UGC` lists zones (`SCZ009`) and sometimes counties (`SCC091`).
- **Polygons:** storm-based warnings (Tornado, Flash Flood, Flood Warning, Flood Advisory) have `geometry`. Watches and advisories usually don't (`null`).
- **Quirks:**
  - **The feed includes cancel/expire messages.** Read the action code in `parameters.VTEC` (`/O.NEW.`, `CON`, `EXT`, `CAN`, `EXP`). `CAN` and `EXP` must never raise a status.
  - Damage threat tags exist when issued, e.g. `flashFloodDamageThreat: ["CONSIDERABLE"]` (real, Oct 11, 2026). Tornado warnings carry `tornadoDetection`.
  - Event names seen in SC this month: Flood Warning, Flood Advisory, Flood Watch, Flash Flood Warning, Tornado Warning, Tornado Watch, Special Weather Statement, Lake Wind Advisory, Frost Advisory, Rip Current Statement, Beach Hazards Statement, Coastal Flood Advisory.
- **Live example on Oct 17:** a Lake Wind Advisory covering Fairfield, Kershaw, Lancaster, and Lee.

## 4. NWS gridpoint rain forecast

- **Step 1:** `https://api.weather.gov/points/34.9249,-81.0251` → `forecastGridData` = `https://api.weather.gov/gridpoints/GSP/114,51`
- **Step 2:** read `properties.quantitativePrecipitation`.
- **Units:** **millimeters** (`wmoUnit:mm`). Divide by 25.4 for inches.
- **Quirk:** each value covers an interval with its own length (`2026-10-17T18:00:00+00:00/PT6H`). Summing "the next 24 hours" means adding the overlapping part of each interval.
- **Size:** 290 KB raw, **13 KB gzipped**. Browser OK.
- **Note:** SC-5 spans two NWS offices: Greenville-Spartanburg (GSP) and Columbia (CAE).

## 5. FEMA National Flood Hazard Layer

- **Service:** `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`
- **Flood Hazard Zones = layer 28** (checked by name; layer numbers can change).
- **Point lookup:** `.../MapServer/28/query?geometry=-80.9740,34.9849&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF,DFIRM_ID&returnGeometry=false&f=json`
  - Catawba gauge → `AE`, `FLOODWAY`, SFHA `T` (high-risk area)
  - Downtown Rock Hill → `X`, "AREA OF MINIMAL FLOOD HAZARD", SFHA `F`
- **Browser OK:** yes (it echoes our origin). Point queries take about 0.1–0.4 s. `maxRecordCount` 2000. Formats: JSON, GeoJSON, PBF.
- **York County:** 1,535 high-risk (SFHA) polygons.
- **Quirk:** asking for a field that doesn't exist (`EFF_DATE`) fails with a generic `400`. Valid fields include `FLD_ZONE`, `ZONE_SUBTY`, `SFHA_TF`, `STATIC_BFE`, `DFIRM_ID`, `SOURCE_CIT`.
- **Limitation:** a flood zone is long-term risk, not current flooding, and not an official property determination.

## 6. Census ACS 5-year

- **Latest vintage:** **2024** (2020–2024 estimates). Vintages listed: 2021–2024.
- **Auth:** **an API key is now required for every request.** Without one, the API redirects to `missing_key.html`. Free sign-up: https://api.census.gov/data/key_signup.html. The key goes only in `.env` and GitHub Secrets.
- **Variables (labels checked against `variables.json`):**
  - Total population: `B01001_001E`
  - Age 65+: men `B01001_020E`–`_025E`, women `B01001_044E`–`_049E`
  - No vehicle: `B25044_003E` (owner) + `B25044_010E` (renter), out of `B25044_001E` households
  - Below poverty: `B17001_002E` out of `B17001_001E`
  - Disability (optional): `B18101` "With a disability" cells, out of `B18101_001E`
- **Query shape:** `https://api.census.gov/data/2024/acs/acs5?get=NAME,B01001_001E,...&for=tract:*&in=state:45%20county:091&key=KEY`

## 7. Census boundaries

- Tracts: `https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_45_tract_500k.zip` (1.3 MB)
- Counties: `https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip` (11.6 MB, we keep only SC-5)
- No key. Public domain.

### 7b. County FIPS check (TIGERweb, no key)
`State_County/MapServer/1` confirmed: Cherokee 45021, Chester 45023, Fairfield 45039, Kershaw 45055, Lancaster 45057, Lee 45061, Union 45087, York 45091 (and Spartanburg 45083, Sumter 45085).

## 8. Census Geocoder

- **URL:** `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=...&benchmark=Public_AR_Current&format=json`
- **Works:** "155 Johnston St, Rock Hill, SC 29730" → (−81.0290, 34.9233), in 0.36 s.
- **Browser OK: no** (no CORS header). It has to go through the Worker.
- **A ZIP code alone returns 0 matches.** Plan: a static list of SC-5 ZIP centers from the Census ZCTA Gazetteer file.

## 9. OpenRouteService

- **Directions:** `POST https://api.openrouteservice.org/v2/directions/driving-car/geojson`. Without a key: `401 Authorization field missing` (expected).
- **Key:** free sign-up at openrouteservice.org (needed in Phase 4). It is kept only in the Worker.
- **Limits** ([restrictions page](https://openrouteservice.org/restrictions/)):
  - **Avoid polygons: at most 200 km² in area and 20 km wide or tall.**
  - Routes with avoid areas: at most 150 km.
  - Up to 3 alternatives (100 km max).
  - Daily and per-minute quotas aren't listed there; check the dashboard after sign-up.
- **Important for Phase 4:** many warning polygons are bigger than 20 km across, so avoid areas must be clipped to the part near the route. See NOTES.

### 9b. OSRM demo server (fallback)
- `https://router.project-osrm.org/route/v1/driving/-81.029,34.923;-80.86,34.72?overview=false` → 32 min, 23 mi. Browser OK.
- **Cannot avoid areas.** Usage policy: light use only (see the project's usage policy).

### 9c. Our Cloudflare Worker (deployed Oct 18, 2026)

- **URL:** `https://sc5-ready.sc5ready.workers.dev` (code in `/worker`).
- `POST /route` → OpenRouteService directions (key stored as the Worker secret `ORS_API_KEY`); `GET /geocode?q=` → Census Geocoder.
- Accepts requests only from this app's pages (`ALLOWED_ORIGINS`); anything else gets `403`. Checks inputs (points in or near SC, at most 30 avoid polygons and 3,000 points, address text up to 120 characters). Rate limit: 20 route and 60 address requests per visitor per 10 minutes (visitors tracked by a one-way hash of their IP, in memory only). Logging is off.
- Gives up on ORS after 20 seconds and on the geocoder after 15, returning `504` so the app can use its backup.
- **Cloudflare Workers free plan:** 100,000 requests/day, 10 ms CPU per request ([limits](https://developers.cloudflare.com/workers/platform/limits/)).

### 9d. OpenRouteService findings (Oct 18)

- **Keys moved in 2025:** they're now made at **account.heigit.org**, not the old ORS dashboard, and look like `eyJ...`. ORS staff say this format works with the normal API ([ORS forum](https://ask.openrouteservice.org/t/unable-to-use-jwt-style-api-key-with-directions-rest-api-need-classic-api-key/7535)).
- **Tested through our Worker:** Rock Hill → Lancaster gave 36 min / 28.3 mi plus an alternative (37 min / 24.1 mi); with an avoid area, 42 min / 31.5 mi. **Avoid areas and alternative routes work together in one request** (not stated in the docs).
- **Then it stopped answering:** a few minutes later, every request *with our key* hung (no response in 60 s), at both `api.openrouteservice.org` and `api.heigit.org`, while requests without a key got an instant `401`. Most likely a problem with HeiGIT's key checking or free-plan throttling. The app now times out and falls back to OSRM. **Check the daily quota on account.heigit.org.**
- No rate-limit headers were returned, so the free-plan quota should be read from the HeiGIT dashboard.

### 9e. Census places (towns), added in Phase 4
`https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_place_45.txt` (note: lowercase file name). 32 active incorporated places inside SC-5 → `public/data/towns.json`.

### 9f. FEMA flood-zone crossings for a route
`POST` to the NFHL layer 28 query with `geometryType=esriGeometryPolyline`, `where=SFHA_TF='T'`, `returnCountOnly=true` (form-encoded, so no browser preflight). Browser OK. Rock Hill → Lancaster crosses 9. The app thins the route to 250 points and waits at most 10 seconds.

## 10. FEMA Open Shelters

- **Layer:** `https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/FeatureServer/0`
- **Query:** `.../query?where=state%3D%27SC%27&outFields=*&f=json`
- **Fields:** `shelter_name`, `address`, `city`, `state`, `zip`, `shelter_status`, `evacuation_capacity`, `total_population`, `pet_accommodations_code`, `wheelchair_accessible`, `ada_compliant`, `latitude`, `longitude`, `org_name`.
- **Browser OK:** yes.
- **Updates:** synced with the Red Cross database every morning, then checked every 20 minutes (from the service description).
- **On Oct 17: 0 open shelters in SC** (20 nationwide). The app must say so and link county emergency management.
- **Quirk:** there is **no last-updated field**, so the app shows "checked at [time we fetched it]."
- **Slow at times:** on Oct 18 a query took over 20 seconds. The app waits at most 12 seconds, then says the list didn't respond and links county emergency management.
- **County emergency management links** (in `shared/config.ts`): each checked Oct 17, 2026 against SCEMD's [County Emergency Managers](https://www.scemd.org/who-we-are/county-emergency-managers/) directory and loaded (York and Kershaw block scripts, so they were checked in a real browser; SCEMD's Lancaster link was broken, so the county's own current EM page is used).

## 11. SC 511 road closures

No documented public developer feed was found. There is an SCDOT map service, but its terms and stability are unclear. **Skipped.** This is listed as a limitation: routes can't see road closures.

## 12. Supabase (free plan, [pricing page](https://supabase.com/pricing))

- 500 MB database, 5 GB egress, 500,000 Edge Function calls, 2 active projects.
- **Paused after 1 week of inactivity.** Judging happens after submission, so we'll add a scheduled GitHub Action that touches the database every few days. A paused project can be restored from the Supabase dashboard.

### Setup and tests (Oct 18, 2026)

- **Keys:** Supabase now uses *publishable* (`sb_publishable_…`, safe in browsers) and *secret* (`sb_secret_…`, bypasses Row Level Security, Worker only) keys; the older `anon`/`service_role` keys are being retired by the end of 2026 ([Supabase API keys](https://supabase.com/docs/guides/api/api-keys)). Keys go in the `apikey` header.
- **Schema:** `supabase/schema.sql` (run in the SQL Editor). Admin: `supabase/make-admin.sql`.
- **Security tests with the publishable key:** reading active reports → `200`; reading `device_hash` → `401 permission denied`; direct insert → `401`; calling `submit_report` directly → `401`.
- **End to end:** a real report sent from the live site at 5:24 PM went page → Turnstile → Worker → database and was visible publicly. Votes through the Worker counted, and a second vote from the same device returned `already_voted`. Test reports were then set to `hidden`.
- **Keep-alive:** `.github/workflows/keepalive.yml` reads one public row every 3 days. To un-pause a paused project: Supabase dashboard → the project → **Restore**.

## 13. Cloudflare Turnstile ([plans](https://developers.cloudflare.com/turnstile/plans/))

- Widget `sc5-ready` (Managed mode), created through the Cloudflare API; allowed hostnames `vsakethc-gif.github.io` and `localhost`. Site key `0x4AAAAAAFagqhq5XFjVLuGy` (public); the secret is a Worker secret. The Worker verifies tokens at `https://challenges.cloudflare.com/turnstile/v0/siteverify`; a fake token is rejected.
- **Quirk:** the check runs in an iframe; moving that iframe in the page reloads it and breaks the check (red "Troubleshoot"). The app removes and re-renders the widget whenever the form is rebuilt. Ad blockers, VPNs, and strict privacy settings can also block it; the app explains that when it happens.

### Official channels for reports (checked Oct 18, 2026)

| Problem | Where to report | Check |
|---|---|---|
| State roads (potholes, signs, debris, signals, flooding) | SCDOT Maintenance Work Request `https://apps.scdot.org/MWRO/` (also shows the responsible office for local roads); phone 855-467-2368 | Loads (200, "SCDOT - MWRO"); the old `scdot.org/pothole` page is gone (404) |
| Duke streetlights | `https://www.duke-energy.com/customer-service/request-light-repair` → Duke's Street & Area Light Repair Map | Loads |
| Duke downed lines/outages | 800-769-3766 (Duke Energy Carolinas) | From Duke's own safety material |
| Dominion Energy SC | `https://www.dominionenergy.com/South-Carolina/Report-Outage-or-Emergency`; downed lines 888-333-4465 | Loads; same page says stay 30 ft away |
| County roads and drains | County homepages (all 8 load; York and Kershaw block scripts, checked in a real browser) | — |
| Cooperatives and city utilities | Not linked (varies by address): "call the number on your power bill" | — |

**Downed power line distance:** the brief suggested 35 ft; Duke Energy and Dominion Energy SC both say **30 ft**, so the app uses 30 ft.

## 13b. Cloudflare Turnstile plan limits

Free: up to 20 widgets, 10 hostnames each, unlimited challenges.

## 14. OpenFreeMap basemap (added in Phase 2)

- **Style:** `https://tiles.openfreemap.org/styles/positron`. Browser OK (`*`). Uses fonts "Noto Sans Regular/Bold/Italic" from the same server.
- **Terms** ([openfreemap.org](https://openfreemap.org/)): free, no registration, no API keys, no cookies; no limits on normal map views; websites and commercial use allowed. **Attribution required** (MapLibre shows it automatically): OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors.
- **Why not CARTO:** CARTO basemaps now require an API key (free for non-commercial up to 5M tile requests/month) and show a watermark without one ([CARTO basemap-styles README](https://github.com/CartoDB/basemap-styles)).

## 15. Census ZCTA Gazetteer (added in Phase 2)

- `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip` (1 MB, no key). Tab-separated: `GEOID`, `INTPTLAT`, `INTPTLONG`.
- 47 ZIP codes have their center inside an SC-5 county. Spot checks: 29730 Rock Hill → York, 29720 Lancaster → Lancaster, 29020 Camden → Kershaw, 29010 Bishopville → Lee.

## Built data files (Phase 2)

| File | Size | Made by | Contents |
|---|---|---|---|
| `public/data/gauges.json` | 9.5 KB | build-gauges.mjs | 39 active gauges, 17 with official flood stages |
| `public/data/counties.geojson` | 14 KB | build-boundaries.mjs | 8 county outlines (simplified 20%) |
| `public/data/tracts.geojson` | 131 KB | build-boundaries + build-tracts | 149 tracts with ACS 2024 measures and SFHA share |
| `public/data/zips.json` | 1.6 KB | build-zips.mjs | 47 ZIP centers |

**ACS check:** total population across the 149 tracts is 618,892, consistent with the 8 counties' published totals.

## 16. Hurricane Helene replay data (added Oct 18, 2026)

Used only by `scripts/build-helene.mjs` to build the two Helene replays in Scenario Mode. The app never calls these sources itself.

- **USGS archive of river readings:** `https://nwis.waterservices.usgs.gov/nwis/iv/?format=json&sites=...&parameterCd=00065,00045&startDT=2024-09-25T00:00-04:00&endDT=2024-10-01T00:00-04:00&siteStatus=all`. No key. Historical requests to `waterservices.usgs.gov` answer with a **301 redirect** to `nwis.waterservices.usgs.gov`, so the script calls that address directly. 37 of 39 gauges had readings on Sept 27, 2024 (36 of 39 on Sept 29). USGS writes missing values as -999999. Parameter 00045 is rainfall (inches per interval); we use Rocky Creek at SC 901 (021474750), Chester County.
- **Iowa Environmental Mesonet (IEM), Iowa State University: NWS alert archive.** `https://mesonet.agron.iastate.edu/json/vtec_events_bystate.py?state=SC&year=2024` lists every alert issued for SC in 2024 (1,538 events). `https://mesonet.agron.iastate.edu/json/vtec_event.py?wfo=GSP&year=2024&phenomena=FF&significance=W&etn=82` returns the full text of one alert and every update NWS sent. No key, free. Times are UTC. Credit: Iowa Environmental Mesonet.
- **Quirks:** one NWS product can cover several alerts (for example, it can cancel Tornado Watch 684 and extend 687 in the same message), so the script matches the exact alert number. Tropical storm products have one section per area; the script uses the section for an SC-5 county.
- **Checked against the real record:** for example, the Flash Flood Warning for Cherokee and York (GSP #82) was issued at 3:02 AM on Sept 27, 2024, extended four times, and tagged "damage threat: considerable" at 6:19 AM.

## P2 sources (not checked yet; only if time allows)
AirNow, USGS earthquake feeds, NASA FIRMS.
