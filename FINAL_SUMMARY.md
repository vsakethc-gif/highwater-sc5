# Highwater: the whole app, explained

A plain-English walkthrough of everything in Highwater, written to study before recording the demo video and talking to judges. Read it once start to finish, then use the "Likely judge questions" at the end to practice out loud.

**Live app:** https://vsakethc-gif.github.io/highwater-sc5/ · **Code:** https://github.com/vsakethc-gif/highwater-sc5

---

## 1. What it is, in 30 seconds

Highwater is a free website, built mainly for phones, for the 8 counties of South Carolina's 5th Congressional District: Cherokee, Chester, Fairfield, Kershaw, Lancaster, Lee, Union, and York.

It answers four questions:

1. **What's happening near me right now?** One status (Normal, Watch, Warning, or Danger), built from official alerts, live river levels, and the rain forecast.
2. **What should I do?** Plain-language steps for that exact hazard and level, from official safety sources.
3. **If I need to leave, which way?** A route planner that steers around active warning areas, during floods and hurricanes only.
4. **What's broken in my neighborhood?** Community reports (streetlight out, flooded road, downed tree), with the official place to get each one fixed.

**What it is not:** an official warning system. It never says a place or route is "safe," and every screen points to 911, the National Weather Service, and local emergency management.

**Who it's for:** everyone in SC-5, but especially people who have the hardest time in a disaster: older adults, households without a car, and families with less money. That's why it works on a slow phone, offline, with large tap targets, and with a keyboard or screen reader.

---

## 2. How the pieces connect

```
 LIVE DATA (fetched by your browser while you use the app)
   National Weather Service ─ alerts (every hazard) + rain forecast
   USGS ───────────────────── river and stream levels (39 gauges)
   FEMA ───────────────────── flood zone at a point, flood zones on a route, open shelters
   Supabase ───────────────── community reports (read-only for the public)
                │
 BUILT-IN DATA (prepared ahead of time by scripts in /scripts, saved in /public/data)
   NOAA flood stages · Census population numbers · county/tract boundaries
   ZIP code centers · town centers · each tract's share in FEMA flood zones
                │
                ▼
 RULES (shared/hazards, shared/guidance, shared/routing) ── no AI, all tested
   alert table → hazard + level   gauge vs. flood stage   2-inch rain rule
   vulnerability percentiles       guidance by hazard + level   route scoring
                │
                ▼
 SCREENS (src/pages)
   Status · District map · Route planner · Report a problem · Get ready
   How it works · About · (private) Admin

 ONE SMALL SERVER (Cloudflare Worker, /worker) ── used only when a secret or a check is needed
   /route → OpenRouteService (keeps the key secret)
   /geocode → U.S. Census Geocoder (it blocks browsers)
   /report, /vote → "I'm human" check + validation → Supabase
```

**Why mostly "in the browser"?** It's free, fast, and private: your location is processed on your phone and sent only to the services that answer for that spot. The website itself is just files on GitHub Pages (free hosting). Only three jobs need a server, so there's exactly one tiny one.

---

## 3. Every screen, and how to use it

### Status (home page, `#/`)
- **Pick a place** at the top: a county from the list, "Use my location" (GPS), or a ZIP code. The county is remembered on your device; your exact location is never saved.
- **Status card:** the overall level, the top hazard, a one-line headline, and "Updated [time]."
- **Why this status?** Expands to list every reason (each alert, gauge, or rain rule that triggered), each with its source link.
- **What to do:** "Do this now," "If it gets worse," "Check on others," and official links. Ends with: *This app is not an official warning system. Follow instructions from local officials. In an emergency, call 911.*
- **Quick actions:** "Plan a route out" (only when leaving makes sense), "Open district map," "Report a problem."
- **About this county:** share of people 65+, households without a car, and below poverty, next to the SC-5 average.
- **Official alerts**, **Rain forecast** (next 24 and 48 hours), and **Rivers and streams** (each gauge's reading, when it was read, its trend over 3 hours, a small line chart called a sparkline, and its flood stage, or "No official flood stage").
- Checks for new data every 10 minutes while open.

### District map (`#/map`)
- A map of all 8 counties with layers you can switch: **Vulnerability**, **Flood exposure**, **Priority**, or none; plus **river gauges** (colored and shaped by flood category), **active warning areas**, and **community reports**.
- Tap a neighborhood (census tract) to see its population and each measure next to the SC-5 average, its share in a FEMA flood zone, and the scores, always with their separate parts.
- A complete legend, and a **text version** under the map (a county table and a tract list), so people who can't use a map get the same information.

### Route planner (`#/route`), "Lower-exposure route"
- **Only offered when leaving can make sense:** a flood Warning or Danger, a Tropical Storm or Hurricane Warning, or an official evacuation order. During a tornado, severe storm, winter storm, extreme heat or cold, or high-wind warning, it's replaced with "Stay where you are and take shelter."
- **Start:** "Use my location," tap the map, or search an address or ZIP.
- **Where to:** the nearest **open** shelter (FEMA/Red Cross data; if none are open it says so and links your county's emergency management), "Away from the warning area" (the nearest town center outside every warning area), or a place you choose.
- **Results:** up to three routes. Each card shows the time, distance, extra minutes compared with the fastest, warning areas entered, miles inside warning areas, FEMA flood zones crossed, and unverified community reports nearby. Plus turn-by-turn steps, "Open in Google Maps / Apple Maps" (with a note that those apps don't know our avoid areas), and a print button.
- **Always shown:** *Routes can't see every closed or flooded road. Never drive through water. If officials give evacuation directions, follow theirs instead. Call 911 if you are in danger.*

### Report a problem (`#/report`)
1. Pick a category (9 big buttons with icons).
2. Set the spot: GPS, tap the map, or search an address or ZIP.
3. Optional note (280 characters, with no names or phone numbers).
4. "Verify you are human" (Cloudflare Turnstile), then Send.
5. "Thanks. Your report is posted," plus the **official** place to report it so it actually gets fixed (SCDOT, Duke Energy, Dominion Energy SC, or your county).
- **Downed power line** first shows a full-screen warning: stay at least **30 feet** away and call 911 and the power company (tap-to-call buttons). We used 30 feet because both local utilities (Duke Energy and Dominion Energy SC) say 30, not the 35 in my original brief.
- **Reports near you:** a list sorted by distance, with a category filter. Each report says "Unverified" and has **Still there**, **Fixed**, and **Flag** buttons.

### Get ready (`#/prepare`)
Every hazard's checklist on one printable page: 12 hazards, using the same guidance rules as the Status page.

### How it works (`#/methodology`)
The full rulebook (METHODOLOGY.md) shown inside the app, with an "On this page" list to jump to sections. The same file is on GitHub, so the app and the code can never disagree.

### About (`#/about`)
What it is, who built it, what it can't do (8 limitations), privacy, and data credits.

### Scenario Mode (button in the top corner)
Replays an emergency through the **same rules** as live data. **Two replays of Hurricane Helene use only real data:** the real NWS alerts in effect and real USGS river readings at 7:30 AM on Sept 27, 2024 (York, Cherokee, Chester, and Union reach Danger from Flash Flood Warnings NWS tagged "considerable") and at 2:30 AM on Sept 29, 2024 (rivers crest; York, Kershaw, Fairfield, and Union reach Danger from gauges in moderate or major flood). Six made-up scenarios cover each hazard type: Flood Watch, river Flood Warning, flash flood emergency, tornado warning, extreme heat warning, and a tropical storm. While it's on, every screen shows **"SIMULATION — not live data,"** the status says "Simulated," and nothing is sent or saved (reports stay in that browser tab).

### Offline / install
You can add the app to your phone's home screen. A **service worker** (a small script the browser keeps for this site) saves the app's own files, so it opens with no signal and still shows guidance and checklists. After each successful live load, the app saves that county's alerts, gauges, and rain on the phone. If the next load fails, it shows **"Offline: showing info from [time]"** and treats the status as incomplete, so it can never show a stale all-clear.

### Admin (`#/admin`, not linked anywhere)
A private page where the app owner signs in (Supabase login) to hide, restore, or resolve reports. Your login still needs to be set up.

### States everywhere
Every section has a designed message for loading (gray placeholder boxes the same size as the real content, so the page doesn't jump), empty ("No active National Weather Service alerts for York County right now"), error ("Couldn't load river levels from USGS. Alerts may still be working."), stale, offline, no gauges, no open shelters, routing unavailable, and reports unavailable.

---

## 3b. The phone app, screen by screen

The phone app (React Native + Expo, in `/mobile`) uses the same rules and data code as the website. It runs in Expo Go for testing and the demo; it isn't in the app stores. It has four tabs.

### Status (the "living scene")
- The whole background is the status: deep blue at **Normal**, amber at **Watch**, burnt orange at **Warning**, deep red with a slow glow at **Danger**. A water line rises with the level, and rain falls when 0.25 inches or more is forecast.
- At the top, the **live ribbon** says how fresh the data is ("LIVE · Updated 3 min ago", "OFFLINE", "MAY BE OUT OF DATE", or violet "SIMULATION"). Tap it to see every source and its time.
- The big word (Normal, Watch, Warning, Danger), the hazard, a one-line headline, and a context line ("Rain next 24 h: 1.8 in · 3 rivers rising").
- Cards: **Why this status** (each reason with its source), **What to do now** (a checklist you can tick), **Rivers near you**, **Alerts** (with a bar showing how far through the alert we are), **Rain**, and buttons for Report and the Map. The footer says it's not an official warning system and has a Call 911 button.
- Scrolling shrinks the big word into a slim top bar. Pulling down lifts the water and refreshes.
- **Scenario timeline:** in Scenario Mode → Replay a storm, a slider above the tab bar drags a made-up York County storm from calm to a Flash Flood Emergency, and the whole scene follows your finger.

### Map
A full-screen map with a search pill ("Find a county") and a layers button. A sheet at the bottom never closes: low, it shows a district summary ("No warnings · 4 rivers rising") and layer chips (Alerts, Rivers, Reports, Vulnerable, Flood zones, Priority); tap anything and it rises with details while the map flies there. River gauges are round markers with the water height inside and a ring in the flood color.

### Report
One step per screen: pick a category (two big columns of tiles), move the map so the pin is on the spot, add an optional note, then send. The main button stays pinned at the bottom. "Downed power line" first shows a full-screen warning to stay 30 feet away and call 911. A checkmark draws itself when the report is sent, followed by the official place to report it. "Near me" lists reports with "Still there" and "Fixed" buttons.

### More
A "Replay a storm" card, other scenarios (the Helene replays, a tornado, heat, and more), How it works, data sources, settings (Dark / System / Light, vibration on or off), and About.

### Gauge and alert pages
Tap a river: a big water-height number, a chart you can drag your finger across (the number follows your finger, and the line changes color at each flood stage), and what it means. Tap an alert: a header in the level's colors, a time bar, "In plain words," "What to do," and the official text.

### Route (switched off on the phone)
I tested the phone version of the route planner and decided it wasn't useful enough on a phone, so it's turned off with a feature flag (`mobile/src/features.ts`). The web app still has the full route planner.

## 4. Every data source

| Source | What it gives us | How the app gets it |
|---|---|---|
| **National Weather Service** (api.weather.gov) | Every official alert for SC (flood, tornado, storm, heat, winter...), with the counties and, for warnings, the drawn warning area | Your browser asks directly, every 10 minutes |
| **NWS forecast grid** | Rain forecast in millimeters for time blocks | Browser: "points" lookup for your spot (or the county seat), then the grid data; we add up the next 24 and 48 hours and convert to inches |
| **USGS Water Data API** | River and stream height (gage height, in feet) about every 15 minutes, 39 gauges | Browser, directly. The older USGS service is an automatic backup, because USGS is retiring it starting November 2026 |
| **NOAA National Water Prediction Service** | Official flood stages for each gauge (action, minor, moderate, major) | Built in by a script (`build-gauges`); 17 of the 39 gauges have official stages |
| **FEMA National Flood Hazard Layer** | Flood zones | Live: "is this spot in a high-risk zone?" and "how many zones does this route cross?" Built in: each tract's share in a high-risk zone (script measured 10,898 flood polygons) |
| **FEMA / Red Cross Open Shelters** | Shelters currently listed as open | Browser, when you open the route planner (12-second limit) |
| **U.S. Census ACS 2020–2024** | Age 65+, households with no vehicle, poverty, disability, per tract | Built in by a script (needs a free Census key, used only by the script, never in the browser) |
| **Census boundary and gazetteer files** | County and tract outlines, ZIP centers, town centers | Built in by scripts, simplified to keep downloads small |
| **U.S. Census Geocoder** | Address → map point | Through our Worker (the geocoder blocks browsers) |
| **OpenRouteService** (HeiGIT) | Driving routes that can avoid areas | Through our Worker, which holds the secret key |
| **OSRM demo server** | Backup routes (can't avoid anything) | Browser, only if OpenRouteService fails; the app then shows "This route does not avoid hazard areas" |
| **Supabase** | The community reports database | Reading: browser, directly (with a public key). Writing: only through our Worker |
| **OpenFreeMap** | The light gray background map | Browser; free, no key; © OpenStreetMap contributors |
| **USGS archive + Iowa Environmental Mesonet** | Past river readings and past NWS alerts for the Helene replays | Built in by a script (`build-helene`); the app never calls them |

Full details (exact addresses, limits, test results, quirks) are in DATA_SOURCES.md. Every source was tested with real requests before we built on it, and real saved responses are used in the tests (`tests/fixtures`).

---

## 5. How the hazard engine decides a status

**The four levels** are the same for every hazard: **0 Normal** (no active official alerts for this hazard here right now), **1 Watch** (could develop, get ready), **2 Warning** (happening or about to, act now), **3 Danger** (life-threatening or emergency-level). Each level has its own icon, word, fill style, and color, so it never relies on color alone.

**Overall status = the highest level among all hazards.** The top one is the big card; others are listed below.

### Rule 1: Official alerts
A table in the code (`shared/hazards/alertMap.ts`) maps each NWS alert name to a hazard and a level. Examples:
- Tornado Watch → Tornado, Watch. Tornado Warning → Warning. Tornado Warning tagged "considerable" or "catastrophic" damage, or "Tornado Emergency" → **Danger**.
- Flood Watch → Flood, Watch. Flash Flood Warning → Warning. Flash Flood Warning tagged "catastrophic" → Danger.
- Heat Advisory → Heat, Watch. Extreme Heat Warning → Warning.
- Anything not in the table → "Other alert," Watch, still shown with the official text and link.

Details that matter:
- **Cancelled and expired alerts are ignored.** Each warning carries a code (VTEC) that says NEW, CONTINUED, CANCELLED, EXPIRED, and so on.
- **Old names still work.** NWS renamed products in 2025 (Excessive Heat → Extreme Heat; Wind Chill → Extreme Cold / Cold Weather).
- **Information-only alerts** (the almost-daily Hazardous Weather Outlook, Frost Advisory) are listed but never raise the status.
- **Which alerts apply:** for a county, any alert that lists it. For an exact spot, the alert must list the county, and if NWS drew a warning area, the spot must be inside it.

### Rule 2: River gauges (flooding)
At or above **action stage** → Watch. At or above **minor flood stage** → Warning. At or above **moderate or major** → Danger. Only gauges in the same county count. Gauges with **no official flood stage never raise the level** (we never invent thresholds). Readings older than 2 hours are treated as possibly offline.

*Example:* Catawba River near Rock Hill: action 13 ft, minor 15 ft, moderate 25 ft, major 30 ft. A reading of 16.4 ft → Flood **Warning** for York County.

### Rule 3: Rain forecast (flooding)
**2 inches or more in the next 24 hours → Watch.** Why: SC gets about 48 inches of rain a year, about 4 a month, so 2 inches in a day is half a month's rain at once. It's this app's own cautious "get ready" signal, not an official NWS threshold, and it never goes above Watch on its own.

### The "can't confirm" rule
If alerts, gauges, or the rain forecast fail to load, or gauge readings are stale, the app **will not show Normal.** It says "We can't confirm conditions" and points to official sources. If something *does* raise the level, that level shows along with a note that some data is missing. This is the most important honesty rule in the app: a broken connection must never look like an all-clear.

### Guidance rules
Fixed text chosen by hazard and level, about an 8th-grade reading level, each line from an official source (NWS, Ready.gov, Red Cross, SC Emergency Management; links in METHODOLOGY). Context changes it:
- Any flood Watch or higher → always "Turn around, don't drown" (6 inches of fast water can knock over an adult; 12 inches can carry away most cars).
- In a FEMA high-risk flood zone with a flood Watch or higher → "be ready to leave, and know your way to higher ground."
- Where 7%+ of households have no car → ask a neighbor, family, or county emergency management about a ride before roads flood.
- High vulnerability → a stronger "Check on others."
- **Shelter-in-place hazards** (tornado, severe storm, winter, heat, cold, wind) → "stay where you are," and **no route button**, even if a flood is also happening.

---

## 6. Vulnerability, flood exposure, and priority (the map scores)

These answer: "If a hazard hits, where are the people with the fewest resources most exposed?" They're for understanding the district, **not** for anyone's status.

- **Percentile rank:** for each of the 149 tracts, what share of SC-5 tracts have a lower value (ties count half). A score of 80 means "higher than about 80% of SC-5 tracts," not "80% of people."
- **Vulnerability (0–100):** the average of four percentile ranks: % age 65+, % households with no vehicle, % below poverty, % with a disability.
- **Flood exposure (0–100):** the percentile rank of the share of the tract's land in FEMA's high-risk flood zone. The real percentage is always shown too.
- **Priority (0–100):** the average of vulnerability and flood exposure. Never shown without its parts.
- **Insufficient data:** tracts with fewer than 200 people or 50 households get no score. We found this rule by investigating outliers: Winthrop University's dorm tract showed 100% poverty because Census could measure only 3 of 1,471 residents, and a Lee County prison tract has no households at all.
- Census numbers are estimates with margins of error, especially for small tracts, and the app says so.

---

## 7. How the route planner works

1. **Build avoid areas** from active Warning- or Danger-level alerts for hazards where leaving makes sense (flood, tropical, evacuation) that have a drawn warning area. Optionally (on by default) add a small square (150 m) around each **community-reported flooded road**.
2. **Make them fit the free service.** OpenRouteService only accepts avoid areas up to 20 km across and 200 km², so each warning area is cut into tiles about 14 km on a side, keeping only tiles near the trip. Tiles containing your start or destination are left out (you can't avoid where you're standing), and the app says "You're starting inside an active warning area."
3. **Ask for routes** through our Worker: the fastest route and up to two alternatives. If the fastest goes through a warning area, ask again with the avoid areas. If that fails, retry with fewer areas and say which couldn't be avoided.
4. **Measure each route:** warning areas entered, miles inside warning areas, FEMA flood zones crossed (asked live from FEMA), and unverified reports within about 100 m.
5. **Measure elevation:** the lowest point on each route, and **low dips** (the road drops 40+ ft below the ground within ¾ mile on both sides, the shape of a creek valley). We tuned the 40-ft rule on real routes: every dip it found was within 200 m of a FEMA flood zone, while a 20-ft rule mostly found ordinary hills.
6. **Score (lower is better):** 1 point per minute + **30** per warning area entered + **5** per mile inside a warning area + **3** per FEMA flood zone crossed + **2** per low dip. Entering a warning area "costs" as much as half an hour of extra driving because that's what we most want to avoid. Every part is shown on the card.
7. **Backup:** if OpenRouteService doesn't answer in 20–25 seconds, the app uses the OSRM demo server with the banner **"This route does not avoid hazard areas."**

**Why not avoid all FEMA flood zones?** Almost every creek crossing is in one, so no route would be found. We count them instead.

**Tested example (Scenario Mode, flash flood emergency, starting at ZIP 29715 Fort Mill, "Away from the warning area"):** three routes to Van Wyck, with 4.4, 7.2, and 8.1 miles inside the warning area; the first wins.

---

## 8. How community reports work

**What's saved:** category, location (rounded to about 1 meter), optional note, time, status, vote counts, and a scrambled device code. **No name, email, phone, account, or IP address.**

**The path of a report:**
1. Your browser makes a random device ID once and keeps it.
2. You pass the Cloudflare **Turnstile** "I'm human" check; it gives the page a one-time token.
3. The page sends the report and token to our **Worker**.
4. The Worker asks Cloudflare if the token is real, then checks: category in the list, location inside SC-5, note length, no phone numbers or emails, and a short offensive-word list. It **hashes** the device ID with a secret (a one-way scramble) and limits attempts per visitor.
5. The Worker calls a database function with the secret key. The database checks everything **again** and allows at most 5 reports per device per hour.
6. Anyone can read active reports straight from Supabase using the public key, but **Row Level Security** only lets the public see active, unexpired reports and safe columns. The public can't add, change, or delete anything directly.

**Community signals:** "Still there" resets the expiry clock; 3 "Fixed" from different devices → resolved; 3 "Flag" → hidden until review. One vote of each kind per device per report.
**Expiry:** flooded-road reports after 48 hours, others after 30 days (since the last "Still there"). This is written into the read rule, so there's no cleanup job to run.
**Safety:** report text is always inserted as plain text, never as HTML, so nobody can inject code (XSS).
**Keep-alive:** free Supabase projects pause after a week of no activity, so a GitHub Action reads one row every 3 days. If it ever pauses: Supabase dashboard → project → Restore.

---

## 9. Tech stack, and why

| Piece | What it is | Why we chose it |
|---|---|---|
| **TypeScript** | JavaScript with types | Catches mistakes before the code runs |
| **Vite** | Build tool | Fast, simple, small output |
| **Plain DOM + a tiny `h()` helper** (no React) | Builds the page elements | Fewer concepts to learn and explain, smaller download; `h()` always inserts text safely |
| **Hand-written CSS with design tokens** | Named colors, sizes, spacing in `tokens.css` | One consistent look; no "template" look |
| **MapLibre GL + OpenFreeMap** | Map drawing + free basemap | CARTO's free tiles now need a key; OpenFreeMap is free and keyless |
| **Lucide icons** | Open-source icon set | One consistent style; only used icons are included |
| **Public Sans + Source Serif 4** | Fonts | Public Sans is the U.S. government's own typeface: very readable, civic; both self-hosted |
| **marked** | Markdown → HTML | Shows METHODOLOGY.md as the "How it works" page |
| **Vitest** | Tests | 171 automated tests for the rules, parsers, routing, reports, and offline logic |
| **GitHub Pages + GitHub Actions** | Hosting + automatic deploy | Free; every push rebuilds and publishes the site |
| **Cloudflare Worker** | The one small server | Free; keeps secrets out of the browser |
| **Supabase** | Postgres database | Free; Row Level Security protects it with a public key |
| **Cloudflare Turnstile** | Spam check | Free, privacy-friendly (no picture puzzles usually) |
| Script-only: **mapshaper, Turf.js, fflate, resvg** | Simplify shapes, measure overlaps, unzip, draw icons | Used only when preparing built-in data |

Languages: **TypeScript, HTML, CSS, SQL**, and JavaScript for scripts.

### The phone app's stack

| Piece | What it does | Why |
|---|---|---|
| **React Native + Expo (SDK 58)** | Real native screens written in TypeScript | One language for both apps; Expo Go lets me test on my phone instantly |
| **Expo Router** | Screens, tabs, and sheets | Screens are just files in a folder |
| **Reanimated + Gesture Handler** | Animations and drags on the phone's UI thread | Stays smooth while data loads |
| **react-native-maps, react-native-svg** | The map, the water line, charts, icons | Native maps; drawing in code instead of image files |
| **expo-haptics, expo-blur, expo-location** | Vibrations, frosted glass, location (with permission) | Native feel |
| **Atkinson Hyperlegible Next + Newsreader** | Fonts | Atkinson was designed by the Braille Institute for low-vision readers |
| **The shared engine (`/shared`)** | The same rules and data code as the website | Written once, used by both apps (each app plugs in how it loads files and saves things) |

---

## 10. Quality

- **171 automated tests pass** (as of October 24, 2026).
- **Lighthouse (mobile):** accessibility **100** and best practices **100** on every page. Performance: Status 97, Report 100, Get ready 100, How it works 99, About 99, Route 96, District map 50. The route page went from 76 to 96 by loading its map only when needed. The district map page is held back by the map library (about 1 MB), which is an honest limitation.
- **Accessibility:** WCAG 2.2 AA contrast (checked with a script), full keyboard use (tested: setting a report location with a ZIP and Enter, switching map layers with Space), visible focus rings, a "Skip to main content" link, labeled controls, screen-reader announcements when the status changes, text versions of the maps, tap targets of at least 44 px, and no color-only information.
- **Screens tested** at 360, 390, 768, 1024, and 1440 px wide with no sideways scrolling.
- **Failure testing:** each data source was blocked on purpose to confirm the app says "couldn't load" instead of looking like an all-clear.

---

## 11. Biggest technical problems and how we solved them

(Pick one or two you can tell well.)

1. **Avoid areas too big for the free router** → cut into ~14 km tiles; leave out tiles containing the start/end; score by areas *entered* plus miles inside.
2. **Cancelled warnings looked active** → read the VTEC code and drop CANCELLED/EXPIRED.
3. **USGS's main service retiring during judging** → built on the new API with the old one as backup.
4. **Misleading Census numbers** (dorms showing 100% poverty) → the "insufficient data" rule.
5. **The "I'm human" check broke** after picking a category → rebuilding the form moved Cloudflare's frame, which reloads and breaks it; fix: remove and recreate the widget each time.
6. **Offline mode failed** even though the file was saved → servers send a `Vary` header, so the browser's lookup didn't match; fix: match saved files by address only.
7. **OpenRouteService hung** (didn't even error) → time limits plus the OSRM backup with a clear banner. (It works again as of October 18.)
8. **Error states that looked like answers** → "No active reports nearby" when the database was down; fixed to say "couldn't load."
9. **Pages jumping while loading** (layout shift) → placeholder boxes the same size as the real content; Status performance went from 89 to 96+.
10. **A real tornado watch missing from the Helene replay** → one NWS message cancelled one watch and extended another; the script now matches the exact alert number.
11. **A slow route page** → the map library loads only when needed (76 → 96).
12. **"Low dips" that were really just hills** → tested 20, 30, and 40 ft against FEMA flood zones on real routes; 40 ft matched 7 of 7.

---

### Phone app problems we solved
- **One engine, two apps.** The phone's bundler (Metro) only looked inside `/mobile` at first, so it couldn't find the shared rules in `/shared`. We added `/shared` to its watch list in `mobile/metro.config.js`, which left the website untouched.
- **Smooth animations.** The scene, the water line, and the storm timeline run on the UI thread with Reanimated "shared values," so loading data never makes them stutter. Rain is three moving layers instead of 80 separate streaks.
- **Colors that never flash.** When the level changes, the new colors are drawn on a hidden layer first and then faded in.
- **No flicker while scrubbing.** Each timeline step loads new simulated data. The screen keeps the old picture until the new one is ready.
- **A crash we caught.** An animation change made the storm timeline crash when it opened ("Cannot access 'held' before initialization"). I found it while testing in the browser before recording, and it was fixed by creating the value before the code that used it.

## 12. Known limitations (say these honestly)

- Not an official warning system; it can be late, wrong, or missing alerts.
- River readings are provisional; gauges go offline; many small creeks have no gauge. Chester, Lancaster, and Lee counties have no gauges with official flood stages.
- FEMA flood zones show long-term risk, not today's flooding, and some maps are old. Not an official determination for a property.
- Census figures are estimates with margins of error.
- No road-closure data (SC 511 has no public feed). Routes can't see every closed or flooded road. Free routing can be slow or out of requests.
- Shelters are only as current as FEMA/Red Cross data.
- Community reports are unverified and not sent to any agency.
- The district map page loads slowly on old phones (Lighthouse performance 50).
- The phone app isn't in the app stores; it runs in Expo Go for testing and the demo. Its route planner is switched off (the web app has it).
- Parts of Spartanburg and Sumter counties are in SC-5 but not covered yet.

---

## 13. Key terms, in one line each

- **API:** a web address a program can ask for data, which answers in a fixed format.
- **JSON:** the text format most APIs answer in (labels and values in curly braces).
- **GeoJSON:** JSON for map shapes: points, lines, and polygons.
- **Polygon:** a closed shape on a map, like a warning area or a county outline.
- **CORS:** a browser rule; a site must say "browsers from other sites may read me." The Census Geocoder doesn't, so we go through the Worker.
- **Proxy / Worker:** a small server that asks another service for us, adding a secret key the browser never sees.
- **Row Level Security:** database rules deciding which rows each kind of user may read or change.
- **Hash:** a one-way scramble; you can compare hashes but can't turn one back into the original.
- **Service worker:** a script the browser keeps for a site, which can serve saved files offline.
- **Percentile rank:** the share of items with a lower value.
- **VTEC:** a code in each NWS warning saying whether it's new, continued, cancelled, or expired.
- **Gage height:** how high the water surface is at a gauge, in feet. **Flood stage:** the height where NWS says flooding begins there.

---

## 13b. The phone app's "Living Status" design

**The idea in one line:** the phone's Status screen doesn't show a status card, it *is* the status. The whole background is a scene that matches the level: calm night-blue water at Normal, amber dusk at Watch, burnt orange with higher, moving water at Warning, and deep red with the highest water and a slowly pulsing glow at Danger. If rain is forecast, thin rain streaks fall behind everything.

**Why it fits a hazard app:** a worried person can read the situation from across the room before reading a word, and the rising water is the hazard itself, not decoration. Color is never the only signal: the level is always written as a giant word, with the hazard, a headline and the reasons underneath.

**Patterns we learned from (in our own words; we copied no artwork):**
- Apple Weather: the screen is the condition; information sits on top in see-through cards with small labels; the big title shrinks into a slim bar as you scroll.
- Flighty (a flight tracker): a small "LIVE · Updated 3 min ago" ribbon so you always know how fresh the data is, and time bars that show how far through an alert we are.
- Stock and video apps: a bar you drag with your finger to move through time. Our storm timeline uses this so judges can watch Normal turn into Danger.

**How it works:** the scene is drawn with SVG shapes and moved by Reanimated on the phone's UI thread. It pauses when you leave the tab or the app goes to the background, and with Reduce Motion on, the water and rain stand still and level changes become a simple fade.

**Honesty rules kept:** Scenario Mode turns the ribbon violet ("SIMULATION · not live data") with a dashed violet line at the top, and the timeline says "SIMULATED" and "Made-up storm." When some data didn't load, the scene turns a neutral gray and says "Can't confirm," so missing data never looks like a calm all-clear.

## 13c. The "Night Tide" look, and the design skills that shaped it

On Oct 24 the phone app got a design system called **Night Tide**: near-black screens, one cyan accent, and four status colors (teal Normal, yellow Watch, orange Warning, rose Danger) that differ in brightness as well as color, so people with color blindness can tell them apart. Every status also has an icon and a word. Text uses **Atkinson Hyperlegible Next**, a typeface the Braille Institute designed for people with low vision, because the app has to be readable on a cracked phone in a storm. The rules live in `design-system/highwater/MASTER.md` and, in code, in `mobile/src/theme/tokens.ts`, so every screen updates together.

| Skill | What it did for the app |
|---|---|
| UI UX Pro Max | Searched its database of styles, palettes and font pairings to produce three options; Night Tide was chosen and saved as MASTER.md |
| expo-native-ui | Made the new style feel native (iOS-style continuous corners) |
| impeccable (critique, layout, typeset, adapt, polish, audit) | Found and fixed spacing, label and text-size problems; checked small phones and the largest text size |
| emil-design-eng | Reviewed every animation earlier the same day: stronger easing, faster UI motion, instant emergency info |
| expo-design-system | Audited for hardcoded colors and turned repeated ones into named tokens |

## 14. Fifteen likely judge questions, with short answers to say out loud

**1. What does your app do, in one sentence?**
It shows people in SC-5 what flood and weather dangers are near them right now and what to do, using live government data and written rules.

**2. Who is it for?**
Everyone in our eight counties, especially older adults, families without a car, and people with lower incomes, because they have the least time and the fewest options in a storm.

**3. Is this AI? How does it decide the status?**
No AI runs in the app. It uses written rules: a table of weather alerts, river gauges compared with their official flood stages, and a 2-inch rain rule. The highest level wins, and "Why this status" lists every reason.

**4. Give me an example of how a level is decided.**
If the Catawba River near Rock Hill reads 16.4 feet and its flood stage is 15, that's a Flood Warning for York County. A Flash Flood Warning tagged "catastrophic" is Danger. Two inches of forecast rain in 24 hours is Watch.

**5. Where does the data come from?**
The National Weather Service (alerts and rain), U.S. Geological Survey river gauges, NOAA flood stages, FEMA flood zones and shelters, and the Census. Each number shows its source and time.

**6. What happens if a data source is down?**
It never shows "Normal" by mistake. It says "can't confirm" and points to official sources. If you're offline, it shows the last saved info with its time.

**7. Why is there no route button during a tornado?**
Driving during a tornado is dangerous. Official advice is to shelter on the lowest floor in an interior room, so the app says "Stay where you are and take shelter."

**8. Is the route safe?**
We never call it safe. It's "lower-exposure": it avoids the warning areas we know about, but it can't see every flooded road. It tells you to never drive through water and to follow officials.

**9. Why does the phone screen change color?**
That's the "living scene." The whole screen shows the danger level, so you can tell from across the room. The level is always written as a big word too, so it never depends only on color.

**10. Did you think about color-blind users?**
Yes. Normal is teal instead of green, so nothing relies on red versus green, and the four colors also differ in brightness. Every level has an icon and a word.

**11. Why two apps, a website and a phone app?**
The website works on any phone with no download, so judges and residents can try it instantly. The phone app shows what a native version feels like. Both use the same rules code, so they always agree.

**12. What was your hardest technical problem?**
[ADD YOURS: pick one from section 11 and tell it as a story: what went wrong, how you found it, how you fixed it. Good ones: cancelled warnings that still said "Flood Warning," or screens that showed "nothing here" when data hadn't loaded.]

**13. How do you stop spam on reports without accounts?**
An "I'm human" check, server checks on the category, location, and text, a limit of 5 reports per device per hour, and auto-hiding after 3 flags. The device ID is scrambled, so we never know who anyone is.

**14. What would you add next?**
The parts of Spartanburg and Sumter counties in SC-5, opt-in notifications when the level changes, a Spanish version, and publishing the phone app to the app stores.

**Bonus: can people rely on it in an emergency?**
It's a helper, not an official warning system, and it says so on every screen. Official alerts, local officials, and 911 come first.
