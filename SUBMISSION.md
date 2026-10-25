# Submission answers (drafts)

These are drafts for the Congressional App Challenge form. Each answer comes in two lengths: a **short** one (under 100 words) and a **long** one (under 250 words), because I don't know the form's limits yet. Rewrite them in my own words before pasting. Anything marked **[CHECK]** needs checking and anything marked **[ADD YOURS]** needs my own words.

- **Web app (works on any phone or computer):** https://vsakethc-gif.github.io/highwater-sc5/
- **Code:** https://github.com/vsakethc-gif/highwater-sc5
- **Demo video:** [ADD VIDEO LINK]
- **Deadline:** Monday, October 26, 2026 [CHECK the exact time on the official site]. I plan to submit Sunday, October 25.

---

## 1. App name

**Short:** Highwater

**Long:** Highwater. The name comes from "high water," the phrase people use when rivers and creeks rise. Flooding is the hazard the app was built around first, and the app's main screen shows a water line that rises as the danger level goes up.

---

## 2. One-sentence purpose

**Short:** Highwater shows people in South Carolina's 5th District what weather and flood dangers are near them right now and what to do about them, in plain words.

**Long:** Highwater is a free app that pulls live data from the National Weather Service, the U.S. Geological Survey, and FEMA into one simple status for your county or your exact location (Normal, Watch, Warning, or Danger), explains why, tells you what to do next, and lets you report problems like flooded roads or downed trees so neighbors can see them.

---

## 3. Target audience

**Short:** People who live in SC-5's eight counties (Cherokee, Chester, Fairfield, Kershaw, Lancaster, Lee, Union, and York), especially older adults, families without a car, and people with lower incomes, who usually have the least time and the fewest options when a storm hits.

**Long:** Highwater is for everyone who lives in South Carolina's 5th Congressional District: Cherokee, Chester, Fairfield, Kershaw, Lancaster, Lee, Union, and York counties. (Parts of Spartanburg and Sumter counties are also in SC-5, but the app doesn't cover them yet.)

I especially had in mind the people who have the hardest time in a disaster: older adults, households without a car, and families with lower incomes. The district map shows where those people live, using Census data, next to FEMA flood zones, so you can see where help matters most.

Because it's meant for emergencies, it's built to work in rough conditions: on an old or cracked phone, in bright sun, with weak signal (it saves the last status for offline use), with a screen reader, or at large text sizes. It's free, has no ads, and needs no account. [ADD YOURS: a sentence about why this audience matters to you, for example someone you know.]

---

## 4. How the app works

**Short:** Highwater reads live data: National Weather Service alerts and rain forecasts, U.S. Geological Survey river levels from 39 gauges, and FEMA flood zones and shelters. Written rules (no AI) turn that into one of four levels: Normal, Watch, Warning, or Danger. The app shows why, gives steps for that exact hazard, maps the district, plans routes away from warning areas, and lets people report problems. Scenario Mode replays storms, including real data from Hurricane Helene, so you can see how it reacts.

**Long:**
1. **Data in.** The app reads live public data: every National Weather Service alert for South Carolina, the NWS rain forecast, river and stream levels from 39 U.S. Geological Survey gauges in SC-5 (17 of them have official flood stages from NOAA), FEMA flood zones, and FEMA's list of open shelters. Census data and boundaries are prepared ahead of time.
2. **Rules, not AI.** A rule-based engine turns that into a level for each hazard: Normal, Watch, Warning, or Danger. For example, a Flood Warning is Warning, a Flash Flood Warning tagged "catastrophic" is Danger, a gauge above its official flood stage is Warning, and 2 inches of rain forecast in 24 hours is Watch. The highest level wins. If data doesn't load, it says "can't confirm" instead of showing an all-clear.
3. **Guidance.** Each hazard and level has steps based on official advice (NWS, Ready.gov, Red Cross, SC Emergency Management).
4. **Routes.** During floods or hurricanes, the web app plans routes that go around active warning areas. During a tornado it shows "Stay where you are and take shelter" with no route button. [CHECK: the route planner is turned off in the phone app; it's in the web app.]
5. **Reports.** Anyone can report a flooded road or streetlight out without an account. Reports are public and unverified, with the official place to get each fixed.
6. **Scenario Mode** replays labeled simulations, including two built from real Hurricane Helene data.

---

## 5. Technical challenge and how I solved it

**Short:** The hardest part was combining data from different agencies that don't agree on formats, and never showing a false all-clear. The weather service feed includes messages that *cancel* a warning but still say "Flood Warning," so at first the app would have warned about floods that were already over. We read a hidden code in each message to skip cancelled ones. We also blocked each data source on purpose and found two screens that said "nothing here" when really the data hadn't loaded; now they say "couldn't load."

**Long:** [ADD YOURS: pick one or two and use your own words.]

- **Combining agencies.** Weather alerts, river levels, flood stages, and Census data each come from a different agency in a different format. River gauges have USGS ID numbers, but flood stages are listed by NOAA under different IDs, so we had to match them up. The weather feed also includes messages that cancel a warning while still saying "Flood Warning." We read a hidden code in each message (NEW, CONTINUED, CANCELLED, EXPIRED) and skip the cancelled ones. A real cancelled warning is saved in the tests.
- **Never a false all-clear.** We blocked each data source on purpose to see what people would get. Two screens said "No active warning areas" when the data simply hadn't loaded. Now they say "couldn't load," and the main status says "can't confirm" instead of "Normal."
- **One engine, two apps.** I built a website and a phone app. Instead of writing the rules twice, both use one shared "brain" folder. Each app only plugs in how it loads files and saves things. When the phone app couldn't find the shared folder, we fixed its settings without touching the website.
- **Smooth animations.** The phone app's main screen is a moving scene of water and rain. If the animation ran on the same "thread" as loading data, it would stutter. We used Reanimated so animations run on the phone's UI thread and stay smooth even while data loads.

---

## 6. Tools and coding languages

**Short:** TypeScript (almost all of the code), HTML and CSS (the website), SQL (the reports database and its security rules), and JavaScript (data scripts). The website uses Vite and MapLibre. The phone app uses React Native with Expo. Supabase stores community reports, one Cloudflare Worker keeps the routing key secret, and GitHub Pages hosts the site.

**Long:**
- **Languages:** TypeScript (the website, the phone app, the shared rules engine, and the server function), HTML and CSS (the website's pages and design), SQL (the database tables and security rules), JavaScript (the scripts that prepare Census, FEMA, and boundary data).
- **Website:** Vite (builds the site), MapLibre GL JS with OpenFreeMap tiles (the map), Lucide icons, Vitest (171 automated tests).
- **Phone app:** React Native + Expo (SDK 58), Expo Router (screens and tabs), React Native Reanimated and Gesture Handler (animations and gestures on the UI thread), react-native-maps, react-native-svg, expo-haptics (vibration feedback), expo-location, and the fonts Atkinson Hyperlegible Next and Newsreader. It runs in Expo Go for testing and the demo; it isn't in the app stores.
- **Services (all free):** GitHub Pages (hosting), a Cloudflare Worker (keeps the routing key secret and checks reports), Supabase (the reports database, with Row Level Security), Cloudflare Turnstile (the "I'm human" check), OpenRouteService (directions that can avoid areas), GitHub Actions (automatic deploy).
- **Data:** National Weather Service, U.S. Geological Survey, NOAA National Water Prediction Service, FEMA, U.S. Census Bureau, and Iowa State's archive of past weather alerts (for the Helene replays).

---

## 7. What I learned

**Short:** [ADD YOURS] Ideas to choose from: how to read government data (APIs and JSON) and that agencies don't agree on formats; that "no data" and "no danger" are different things, and an app should never mix them up; how a phone draws animations on a separate thread; and how to design for people in the worst moment, with big clear words, colors that work for color-blind people, and 911 always one tap away.

**Long:** [ADD YOURS: write this one completely in your own words; judges want to hear you.] Things you can talk about, all real parts of this project:
- **Reading real data.** What an API is, what JSON looks like, and how different agencies describe the same river differently.
- **Honesty in design.** The difference between "no alerts" and "the alerts didn't load," and why the app says "can't confirm" instead of guessing. Also why it never says "safe."
- **Safety advice isn't always "leave."** For a tornado the right advice is to shelter in place, so the app removes the route button.
- **Accessibility.** Contrast ratios, color-blind-friendly colors, screen readers, Reduce Motion, and why the font was chosen for low-vision readers.

---

## 8. What I'd do next

**Short:** Add the parts of Spartanburg and Sumter counties that are in SC-5, add road closures if South Carolina publishes a free feed, make the map load faster on old phones, publish the phone app in the App Store and Google Play, and send optional push notifications when the level changes.

**Long:**
- **Cover all of SC-5.** Add the parts of Spartanburg and Sumter counties that are in the district.
- **Push notifications.** Let people opt in to a notification when their county's level changes.
- **Publish the phone app** to the App Store and Google Play so people don't need Expo Go. [CHECK: this costs money (Apple's developer fee), so it would need a sponsor or school support.]
- **Road closures.** I looked for a free public feed of SC road closures and didn't find one I could use. If one appears, routes could avoid closed roads too.
- **Faster map on old phones.** The district map is the slowest page (its map library is about 1 MB).
- **Work with county emergency managers** so they can mark community reports as checked, and so the app links to their latest shelter list.
- **Spanish.** Add a Spanish version of the guidance.

---

## How judges can try it

- **Web app:** open https://vsakethc-gif.github.io/highwater-sc5/ on any phone or computer. No download or account needed. Pick a county at the top.
- **See it react to a storm:** use **Scenario Mode** (the button in the top corner) and pick "Hurricane Helene arrives (real data, Sept 27, 2024)" or the tornado scenario. Everything in Scenario Mode is labeled SIMULATION, and nothing is sent anywhere.
- **Phone app:** the native phone app (React Native + Expo) is shown in the demo video. It runs through Expo Go for testing, so judges would need my development server running to open it. The web app has the same rules and data.
- **How it decides:** every rule, threshold, and data source is on the "How it works" page.
