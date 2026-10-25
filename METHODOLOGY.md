# How it works

Highwater turns official public data into a status for your location, using fixed rules written out on this page. It is **transparent, rule-based analysis**: there is no artificial intelligence in the app, and no secret formula. Every status lists the reasons behind it under "Why this status?"

> **This app is not an official warning system.** It can be late, wrong, or missing alerts. Official National Weather Service alerts, local officials, and 911 come first.

## The four status levels

| Level | Name | What it means |
|---|---|---|
| 0 | Normal | No active official alerts for this hazard here right now |
| 1 | Watch | Conditions could develop. Get ready. |
| 2 | Warning | It is happening or about to. Act now. |
| 3 | Danger | Life-threatening, extreme, or emergency-level alert |

Each level always has its own icon, word, and color, so it never depends on color alone.

**Overall status** = the highest level among all hazards at your place. The top hazard is shown first, and any others are listed below it.

**"Can't confirm."** If official alerts, river gauges, or the rain forecast fail to load, or gauge readings are more than 2 hours old, the app will not show "Normal." It says it can't confirm conditions and points you to official sources. If something *does* raise the level, that level is shown along with a note that some data is missing.

## Where the data comes from

| Data | Source | How often it updates |
|---|---|---|
| Official alerts (all hazard types) | National Weather Service, api.weather.gov | Checked every 10 minutes while the app is open |
| River and stream levels | U.S. Geological Survey Water Data API (provisional) | About every 15 minutes |
| Official flood stages | NOAA National Water Prediction Service | Built into the app's gauge list |
| Rain forecast | National Weather Service forecast grid | Checked every 10 minutes |
| Flood zones | FEMA National Flood Hazard Layer | Checked live for a point; tract shares built in |
| Population data | U.S. Census Bureau, American Community Survey 2020–2024 | Built into the app |
| Boundaries and ZIP centers | U.S. Census Bureau 2024 boundary and gazetteer files | Built into the app |

Full technical details, test results, and limits for each source are in `DATA_SOURCES.md` in the source code.

## Rule 1: Official alerts

Each National Weather Service alert is matched to a hazard and a level using this table.

| Hazard | Watch (1) | Warning (2) | Danger (3) |
|---|---|---|---|
| Flooding | Flood Watch, Flash Flood Watch, Flood Advisory, Hydrologic Outlook, Flood Statement | Flood Warning, Flash Flood Warning | Flash Flood Warning with a "considerable" or "catastrophic" damage threat, or "Flash Flood Emergency" wording |
| Tornado | Tornado Watch | Tornado Warning | Tornado Warning with a "considerable" or "catastrophic" damage threat, or "Tornado Emergency" / "particularly dangerous situation" wording |
| Severe storm | Severe Thunderstorm Watch, Severe Weather Statement, storm-related Special Weather Statement | Severe Thunderstorm Warning | Severe Thunderstorm Warning with a "destructive" damage threat |
| Tropical storm or hurricane | Tropical Storm Watch, Hurricane Watch, Storm Surge Watch, Tropical Cyclone Local Statement | Tropical Storm Warning, Hurricane Warning, Storm Surge Warning | Extreme Wind Warning; Hurricane Warning mentioning a major hurricane |
| Winter storm or ice | Winter Storm Watch, Winter Weather Advisory | Winter Storm Warning, Ice Storm Warning, Snow Squall Warning | Blizzard Warning |
| Extreme heat | Heat Advisory, Extreme Heat Watch | Extreme Heat Warning | — |
| Extreme cold | Cold Weather Advisory, Extreme Cold Watch, Freeze Watch, Freeze Warning | Extreme Cold Warning | — |
| High wind | Wind Advisory, Lake Wind Advisory, High Wind Watch | High Wind Warning | — |
| Fire weather | Fire Weather Watch | Red Flag Warning, Extreme Fire Danger | — |
| Fog or smoke | Dense Fog Advisory, Dense Smoke Advisory, Freezing Fog Advisory | — | — |
| Air quality | Air Quality Alert, Air Stagnation Advisory | — | — |
| Evacuation order | — | — | Evacuation Immediate |
| Other official alert | Any alert not listed above | Civil Emergency Message, Civil Danger Warning | Shelter In Place Warning |

Notes:

- NWS renamed some products in 2025 ("Excessive Heat" became "Extreme Heat"; "Wind Chill" products became "Extreme Cold" and "Cold Weather"). The old names are still recognized.
- **Information only:** the Hazardous Weather Outlook (issued almost every day) and the Frost Advisory (mainly about plants) are listed with the alerts but never raise the status.
- **Cancelled and expired alerts are ignored.** Every warning carries a code that says whether the message is new, continued, extended, cancelled, or expired. Cancelled or expired messages never raise a status.
- **Which alerts apply to you.** For a whole county: any alert that lists the county. For a single spot (your location or a ZIP code): the alert must list the county, and if NWS drew a warning area, the spot must be inside it.

## Rule 2: River gauges (flooding)

| Gauge reading | Flood level |
|---|---|
| At or above **action stage** | Watch |
| At or above **minor flood stage** | Warning |
| At or above **moderate or major flood stage** | Danger |

- Flood stages are official values from NOAA for each gauge. Example: Catawba River near Rock Hill: action 13 ft, minor 15 ft, moderate 25 ft, major 30 ft.
- Only gauges in the same county count.
- **Gauges with no official flood stage never raise the level.** They're shown for context only, labeled "No official flood stage." We never invent thresholds.
- Readings more than **2 hours old** are treated as possibly offline. They never raise or clear a status, and the status is marked as possibly incomplete.
- **Trend:** the newest reading compared with the oldest one in the last 3 hours. A change of 0.1 ft or more is "Rising" or "Falling"; less is "Steady."

## Rule 3: Rain forecast (flooding)

- **2 inches or more of rain forecast in the next 24 hours raises flooding to Watch.**
- Why 2 inches: South Carolina averages about 48 inches of rain a year, or about 4 inches a month. Two inches in one day is half a month's rain falling at once, which is enough to make creeks rise and low roads flood. This is a cautious "get ready" signal chosen for this app, not an official NWS threshold and not a prediction. It never raises the level above Watch on its own; NWS issues its own Flood Watches and Warnings using local flash-flood guidance.
- The forecast comes from the National Weather Service grid square covering your spot, or the county seat for a whole county. NWS gives rain in millimeters for time blocks of 1 to 6 hours; we add up the part of each block inside the next 24 (or 48) hours and convert to inches.

## Vulnerability, flood exposure, and priority (district map)

These scores answer: "If a hazard hits, where are the people with the fewest resources most exposed?" They are for understanding the district, **not** for deciding anyone's status.

All scores are **relative to the 149 census tracts in SC-5's 8 counties**. A score of 80 means "higher than about 80% of SC-5 tracts," not "80% of people."

**Vulnerability score (0–100):** for each tract, take the percentile rank of each of these four measures among SC-5 tracts, then average the four ranks:

1. Share of people age 65 and older (Census table B01001)
2. Share of households with no vehicle (B25044)
3. Share of people below the poverty line (B17001)
4. Share of people with a disability (B18101)

A percentile rank is the share of tracts with a lower value, counting ties as half.

**Flood exposure score (0–100):** the percentile rank of the share of the tract's land inside FEMA's Special Flood Hazard Area (the high-risk "1% annual chance" zone, zones A and V). The share is measured by overlaying FEMA's flood-zone shapes on each tract. The real percentage is always shown next to the score.

**Priority score (0–100):** the average of the vulnerability and flood exposure scores. The tract panel always shows the separate parts and the current county status, never the combined number alone.

**Insufficient data:** a tract with fewer than 200 people or fewer than 50 households (for example, a college dorm or a prison) gets no vulnerability or priority score. Its percentages would be misleading. Three SC-5 tracts are in this group.

**Map colors** use five equal bands (0–19, 20–39, 40–59, 60–79, 80–100) on a light-to-dark scale chosen to be readable with color-vision differences.

## Guidance ("What to do")

Guidance is fixed text chosen by hazard and level, written at about an 8th grade reading level. It is based on:

- **Flooding:** [NWS: Turn Around Don't Drown](https://www.weather.gov/safety/flood-turn-around-dont-drown), [Ready.gov: Floods](https://www.ready.gov/floods), [SC Emergency Management: Floods](https://www.scemd.org/prepare/types-of-disasters/floods/), [Red Cross: Flood safety](https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/flood.html)
- **Tornado:** [NWS: During a tornado](https://www.weather.gov/safety/tornado-during), [Ready.gov: Tornadoes](https://www.ready.gov/tornadoes)
- **Severe storms:** [NWS: Thunderstorm safety](https://www.weather.gov/safety/thunderstorm), [Ready.gov: Severe weather](https://www.ready.gov/severe-weather)
- **Tropical storm or hurricane:** [Ready.gov: Hurricanes](https://www.ready.gov/hurricanes), [SC Emergency Management: Hurricanes](https://www.scemd.org/prepare/types-of-disasters/hurricanes/), [NWS: Hurricane safety](https://www.weather.gov/safety/hurricane)
- **Winter storm and extreme cold:** [Ready.gov: Winter weather](https://www.ready.gov/winter-weather) (generators at least 20 feet from windows and doors; never heat with a gas stove or oven; a body temperature below 95°F is an emergency), [NWS: Winter safety](https://www.weather.gov/safety/winter), [NWS: Cold safety](https://www.weather.gov/safety/cold)
- **Extreme heat:** [Ready.gov: Extreme heat](https://www.ready.gov/heat) (never leave people or pets in a closed car; heat stroke vs. heat exhaustion), [NWS: Heat safety](https://www.weather.gov/safety/heat)
- **High wind:** [NWS: During high winds](https://www.weather.gov/safety/wind-during)
- **Fire weather:** [NWS: Fire weather alerts](https://www.weather.gov/safety/wildfire-ww) ("be extremely careful with open flames"), [Ready.gov: Wildfires](https://www.ready.gov/wildfires)
- **Fog:** [NWS: Driving in fog](https://www.weather.gov/safety/fog-driving)
- **Air quality:** [AirNow: AQI basics](https://www.airnow.gov/aqi/aqi-basics/)
- **Evacuation orders:** [Ready.gov: Evacuation](https://www.ready.gov/evacuation)
- **Any other alert:** follow the official alert's own instructions ([NWS weather safety](https://www.weather.gov/safety/), [Ready.gov alerts](https://www.ready.gov/alerts)).

For each hazard, a Watch-level alert shows "get ready" steps and a Warning- or Danger-level alert shows "act now" steps.

Context rules that change the advice:

- **Any flood Watch or higher** always includes "Turn around, don't drown," with NWS's figures: 6 inches of fast-moving water can knock over an adult, and 12 inches can carry away most cars.
- **In a FEMA high-risk flood zone** (when you use your location) with a flood Watch or higher: adds "be ready to leave, and know your way to higher ground."
- **Where 7% or more of households have no car** (about twice the SC-5 tract median of 3.5%): adds advice to ask a neighbor, family member, or county emergency management about a ride before roads flood.
- **Where the vulnerability score is 60 or higher, or many households have no car:** strengthens "Check on others."
- **Shelter-in-place hazards** (tornado, severe storm, winter storm, extreme heat or cold, high wind, and the extreme wind of a hurricane): "stay where you are and take shelter." The app **never** suggests driving away and never shows a route button for these, even if a flood is also happening.
- **Leaving can make sense** only for flooding (Warning or Danger), a Tropical Storm or Hurricane Warning, and official evacuation orders. Even then, the advice is to follow local officials first.

Every guidance block ends with: *This app is not an official warning system. Follow instructions from local officials. In an emergency, call 911.* The app never calls a place or route "safe."

## Lower-exposure route planner

The route planner helps people see a way out that avoids active warning areas we know about, and where to go. It is called a **lower-exposure** route, never a "safe" route. Every route screen says: *Routes can't see every closed or flooded road. Never drive through water. If officials give evacuation directions, follow theirs instead. Call 911 if you are in danger.*

**When it's offered.** Only when leaving can make sense: a flood Warning or Danger, a Tropical Storm or Hurricane Warning, or an official evacuation order. During a tornado, severe storm, winter storm, extreme heat or cold, or high-wind warning, the planner is turned off and the app says to take shelter where you are.

**Where to.** (1) The nearest shelter that FEMA and the American Red Cross list as **open** (we never list a shelter unless its status is OPEN, and we show when we checked); if none are open, the app says so and links your county emergency management office. (2) "Away from the warning area": the nearest town center (Census 2024 list of 32 SC-5 cities and towns) that is outside every active warning area and at least 3 km from the start. (3) A place you choose (ZIP code, address, or a tap on the map).

**What gets avoided.** Active Warning- or Danger-level NWS alerts for flooding, tropical storms, and evacuation orders that come with a drawn warning area. Warnings that cover whole counties without a drawn area can't be routed around, and the app says so. We do **not** avoid FEMA flood zones (almost every creek crossing is in one, so no route would be found); we count them instead.

**How it works.**

1. Ask OpenRouteService (through our Cloudflare Worker, which keeps the key secret) for the fastest route and up to two alternatives.
2. If the fastest route passes through an active warning area, ask again with those areas as "avoid areas." OpenRouteService only accepts avoid areas up to 20 km across and 200 km², so big warning areas are cut into tiles of about 14 km × 14 km, keeping only tiles near the trip. You can't avoid the spot you're standing in, so tiles containing the start or destination are left out and the app says "You're starting inside an active warning area."
3. If that fails, try again with only the tiles the fastest route crosses; if that fails too, say which areas couldn't be avoided.
4. For each route, count the FEMA high-risk flood zones it crosses (asked live from FEMA), the warning areas it enters, and the miles it spends inside warning areas. Then measure its **elevation** (OpenRouteService returns a height for every point of the route):
   - **Lowest point:** the lowest spot on the route, in feet, and how far along it is.
   - **Low dips:** places where the road drops at least **40 ft (12 m)** below the ground within about **¾ mile (1.2 km)** on both sides, which is the shape of a creek or river valley, where roads flood first. We tested this on real York County routes. At 20 ft, only 6 of 15 "dips" were near a creek (the rest were ordinary hills). At 40 ft, all 7 were within 200 m of a FEMA high-risk flood zone.
   - Heights come from satellite elevation data and are approximate. A low road isn't always flooded, and a high road can still be blocked. The backup router (OSRM) has no heights, so its cards say "Not available."
5. Compare routes with this formula (lower is better):

| Part | Points |
|---|---|
| Travel time | 1 per minute |
| Each active warning area the route enters (not counting one you start or end in) | 30 |
| Each mile driven inside an active warning area | 5 |
| Each FEMA high-risk flood zone crossed | 3 |
| Each low dip (creek or river valley) | 2 |

Entering a warning area "costs" as much as half an hour of extra driving because that's what we most want to avoid. Low dips overlap with flood zones (most dips are in one), so each costs a little less. The weights are a judgment call, and every part is shown on each route card.

**If the routing service is down or slow** (no answer in 20–25 seconds), the app uses the public OSRM demo server instead, which can't avoid anything, and shows: **"This route does not avoid hazard areas."**

"Open in Google Maps / Apple Maps" opens the same start and end in those apps, which don't know about our avoid areas; the screen says so.

## Community reports

People can report a streetlight out, traffic signal out, downed tree or debris, flooded road, blocked storm drain, pothole or road damage, damaged sign, downed power line, or something else. **Reports are unverified, public, and are NOT sent to any government agency.** After sending, the app shows the official place to report each problem so it actually gets fixed: SCDOT's Maintenance Work Request form for roads (it also shows who's responsible for local roads), Duke Energy's Street & Area Light Repair or Dominion Energy SC for streetlights and power, or the county's website.

**Downed power line:** before anything else, a full-screen notice says to stay at least **30 feet** away and call 911 and the power company (tap-to-call buttons). That distance comes from both utilities serving SC-5: Duke Energy and Dominion Energy SC.

**Privacy:** no name, email, phone, account, or IP address is stored. Locations are rounded to about 1 meter. Notes are limited to 280 characters, and notes containing phone numbers or email addresses are refused. A random ID stored in your browser (not tied to who you are) is hashed with a secret and used only to limit how many reports one device can send.

**How a report is checked:** Cloudflare Turnstile ("I'm human" check) → our Worker checks the category, location (inside SC-5), note length, personal info, and a short list of offensive words → the database checks it all again and allows at most 5 reports per device per hour.

**Community signals:**

| Action | Effect |
|---|---|
| "Still there" | Keeps the report visible longer (resets its expiry clock) |
| "Fixed" by 3 different devices | Report is closed as resolved |
| "Flag" by 3 different devices | Report is hidden until the app's owner reviews it |

Each device can do each action once per report. **Expiry:** flooded-road reports disappear 48 hours after the last "Still there"; all others after 30 days.

**On routes:** route cards count unverified flooded-road, downed-tree, and power-line reports within about 100 m of the route. "Avoid community-reported flooded roads" (on by default) adds a small area around each reported flooded road to the avoid areas.

**Security:** reports live in a Supabase (Postgres) database protected by Row Level Security. The public can only read active, non-expired reports and safe columns; it can't add, change, or delete anything directly. Only our Worker, using a secret key that never reaches the browser, can save reports and votes. In Scenario Mode, reports stay in the browser tab and are never sent.

## Get ready page

"Get ready" lists the steps for every hazard on one printable page, using the same guidance rules as the status screen.

## Offline use

The app can be installed on a phone's home screen. A service worker (a small script the browser keeps for this site) saves the app's own files, so it opens and shows guidance and the "Get ready" checklists without a signal.

- **Live government data is never answered from that saved copy.** Instead, after each successful live load, the app saves that county's alerts, gauge readings, and rain forecast in the browser.
- If a live load fails, the app shows that saved copy with **"Offline: showing info from [time]"** and every source labeled "(saved copy)."
- A status built from a saved copy is always marked incomplete, so it can never show as an all-clear. Alerts that ended after the copy was saved are dropped, and gauge readings older than 2 hours are still treated as stale.
- No exact location is ever saved. Copies are kept per county.

## Scenario Mode

Scenario Mode replays an emergency to show how the rules respond. Every scenario runs through the exact same rules as live data.

**Two replays of Hurricane Helene use only real data.** They were built by `scripts/build-helene.mjs` from archives:

- **"Hurricane Helene arrives"**: 7:30 AM on Friday, Sept 27, 2024.
- **"Helene: rivers crest"**: 2:30 AM on Sunday, Sept 29, 2024.

For each moment the script keeps:
- every NWS alert that was actually in effect for SC-5 at that minute, using the latest update NWS had sent by then (its text, warning area, and damage threat tag), from the Iowa Environmental Mesonet's archive of NWS alerts;
- the 12 hours of real USGS river readings before that moment, from the USGS archive. A gauge with no archived reading shows as offline, never a made-up value;
- for rain, what a USGS rain gauge in Chester County actually measured in the next 24 and 48 hours. Forecasts from that time aren't archived in a form the app can use.

The replay is shown "as if now": every time is shifted so that moment is the present, so the freshness rules work the same way. Each alert's headline keeps its real issue time.

What the rules decide, using real data:
- **Sept 27, 7:30 AM:** York, Cherokee, Chester, and Union are **Danger**, because NWS tagged both of their Flash Flood Warnings' damage threat "considerable." The other four counties are at Warning.
- **Sept 29, 2:30 AM:** York, Kershaw, Fairfield, and Union are **Danger** from river gauges in moderate or major flood (for example, the Wateree River near Camden in major flood, and Big Dutchman Creek in Rock Hill in moderate flood).

**Six made-up scenarios** show each hazard type: a Flood Watch, a river Flood Warning, a flash flood emergency, a tornado warning, an extreme heat warning, and a tropical storm with a Flood Watch. They are small data files with fake alerts, gauge readings, and rain, and each fake alert starts with "SIMULATED." While a scenario is on, every screen shows **"SIMULATION — not live data,"** the status card says "Simulated," and nothing is saved or sent anywhere.

## Limitations

- Not an official warning system; it can be late, wrong, or missing alerts.
- Live gauge data is provisional and some gauges go offline; many small creeks have no gauge at all. Chester, Lancaster, and Lee counties have no gauges with official flood stages, so only alerts and rain can raise their flood status.
- FEMA flood zones show long-term risk, not where it is flooding today, and some maps are years old. A flood-zone result is not an official determination for a property.
- Census figures are estimates with margins of error, especially for small tracts.
- A ZIP code is placed at its center point and assigned to the county that center falls in.
- The app cannot see road closures (South Carolina 511 has no public data feed).
- Routes can't see every closed or flooded road. The free routing service can be slow, unavailable, or out of daily requests; then the backup route can't avoid anything, and the app says so.
- Shelter information is only as current as FEMA's and the Red Cross's data. Always confirm with county emergency management.
