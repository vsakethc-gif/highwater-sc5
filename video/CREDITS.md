# Video credits

Every outside clip, photo and fact used in the HighWater demo video. All footage is from U.S. government sources. App footage is real screen recordings of HighWater.

## Footage and images

| What | Source | Date | Credit / license | Where it's used |
|---|---|---|---|---|
| Hurricane Helene animation: hourly rain and river gauges along Helene's path, colored by flood severity | U.S. Geological Survey, Water Resources Mission Area (VizLab). https://www.usgs.gov/media/videos/hurricane-helene-animation-usgs-vizlab | Sept 24 to 29, 2024 data | "USGS" · Public Domain | Scene 1 (cold open) |
| Hurricane Helene just after landfall, GOES-16 GeoColor, 11:25 PM EDT Sept 26, 2024 | NOAA NESDIS, Satellite Snapshots (Office of Geostationary Earth Orbit Observations). https://www.nesdis.noaa.gov/news/hurricane-helene-makes-landfall-florida | Sept 26, 2024 | "NOAA / NESDIS" · U.S. government work (the page has no license line; NOAA imagery is generally public domain) [CHECK] | Scene 1 |
| South Carolina National Guard engineers clearing Helene debris, Greenville, SC | DVIDS video 940665, "South Carolina National Guard supports emergency response for Hurricane Helene (Engineers)". https://www.dvidshub.net/video/940665 | Sept 30, 2024 | "Sgt. 1st Class Roberto Di Giovine, SC Army National Guard (DVIDS)" · marked Public Domain | Scene 1, if downloaded (labeled "Greenville, SC") [ADD when you download it] |

## Facts on the opening cards (our own words)

| Card | Source |
|---|---|
| 49 people died in South Carolina | SC Emergency Management Division, "SC Continues to Recover, One Year After Hurricane Helene," Sept 22, 2025. https://www.scemd.org/news/sc-continues-to-recover-one-year-after-hurricane-helene/ |
| In SC-5, the Wateree River near Camden rose past its major flood stage (37.7 ft by early Sept 29; major = 35 ft) | USGS gauge readings (archived, as used in HighWater's Helene replay) and NOAA flood stages |

## App footage

All app shots are the real HighWater phone app. Nothing on screen is recreated or edited.
- **Most shots** (live status, the storm timeline, the Helene replay, the tornado warning, the report screen) were recorded by running the phone app's own code, built for the web with Expo, in a hidden Chrome window at iPhone size (390 × 844 points). The recording script is `video/capture/app.mjs`. It taps, drags and scrolls through the app the way a person would. It records with "reduce motion" on, because the web build otherwise stacks the cards on top of each other, so the app's rain animation doesn't appear in these shots.
- **The district map** comes from my screen recording on my phone, because the map only runs on a real phone. Two floating developer-tool buttons from the test build are softly blurred there.
- In the edit, shots are framed with slow zooms. The background colors, giant words, rain, light flashes and labels are added around the phone, not on it. Scenario Mode shots show the "SIMULATION" label.

## Voice

My own voice, recorded during my phone screen recording. Pauses and some lines are cut out, steady background noise is reduced (`video/scripts/denoise.mjs`, spectral gating), and the volume is evened out. No AI or text-to-speech voice is used.

## Music

None yet. [ADD the track, its source and license if you choose one, for example from the YouTube Audio Library]

## Software

Edited with Remotion (free license for individuals). Fonts: Atkinson Hyperlegible Next (Braille Institute, OFL) and Newsreader (OFL).
