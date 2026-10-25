# Demo video script (target 2:30 to 2:50, never over 3:00)

Read the narration out loud at a calm pace (about 2.5 words a second). Practice once with a timer. Each row's narration fits its time if you don't pause long.

**Important [CHECK]:** the route planner is switched off in the phone app, so the route and tornado-route shots use the **web app in your phone's browser** (https://vsakethc-gif.github.io/highwater-sc5/). Everything else is the phone app in Expo Go. Say "on the web version" when you switch so judges aren't confused.

## Before you hit record

- Phone app open in Expo Go on **Status**, Scenario Mode **off**, county **York**.
- The web app open in a second browser tab on your phone.
- More → Scenario Mode is one tap away (you'll use "Replay a storm").

## Shot list

| Time | On screen (what to tap) | Narration (read this) |
|---|---|---|
| 0:00–0:28 | Phone app, Status screen, live (calm blue scene). Don't tap anything. | "Hi, I'm [ADD YOURS] from York County. This is Highwater, a free app that shows people in South Carolina's 5th District what flood and weather dangers are near them right now, and what to do. It's for our eight counties, especially older adults and families without a car. I built it in TypeScript with React Native and Expo." |
| 0:28–0:38 | Same screen. Tap the **LIVE** ribbon to show the sources sheet, then swipe it closed. | "During Hurricane Helene, storm information was spread across a dozen websites. Highwater pulls live Weather Service, USGS, and FEMA data into one status." |
| 0:38–1:05 | **More → Replay a storm.** The ribbon turns violet. Slowly drag the timeline from left to right, pausing at each step. | "This is Scenario Mode, a simulation, and it's labeled that way. Watch the whole screen change as a made-up storm gets worse. Normal. Flood Watch: rain is coming. Flood Warning: the water line rises and the phone vibrates. And Danger: a flash flood emergency. The background, the water, and the rain all show the danger level, but the level is always written out too, so it doesn't depend on color." |
| 1:05–1:27 | Drag back to **Warning**. Scroll down slowly: the big word shrinks into the top bar. Open **Why this status** (See all), then show **What to do now**. | "At Warning, it tells you exactly why: the official Flood Warning and a river gauge above its flood stage, each with its source. These are written rules, not AI. Then it gives steps from official guidance, like 'Turn around, don't drown.'" |
| 1:27–1:50 | Switch to the **web app** tab. Scenario Mode → "Flash flood emergency in Fort Mill and Rock Hill" → **Route** → "Away from the warning area" → Plan routes. | "On the web version, during a flood it can plan a lower-exposure route that goes around the active warning areas, and it shows how many miles of each route are inside one. It never calls a route safe, and it reminds you to follow officials." [CHECK: rehearse this flow once; if routing is slow, cut to the next shot] |
| 1:50–2:05 | Web app: Scenario Mode → "Tornado warning in Lancaster County" → **Route**. Then the phone app's Status for the same scenario (More → More scenarios → tornado). | "But for a tornado, leaving is the wrong advice. There's no route button. It says: stay where you are and take shelter, on the lowest floor, away from windows." |
| 2:05–2:22 | Phone app: **Exit** Scenario Mode. **Report → Streetlight out** → move the map → **Use this spot** → Send report → the checkmark draws in. | "Anyone can report a problem, like a streetlight out, with no account and no personal info. Reports are public and marked unverified, and the app shows the official place to actually get it fixed." [CHECK: sending for real needs the "I'm human" check to pass; or send it in Scenario Mode, where it stays on your phone] |
| 2:22–2:32 | Phone app: Status → scroll to the bottom → **How this works** (opens the methodology page). | "Every rule, threshold, and data source is written out on this page, so anyone can check how it decides." |
| 2:32–2:50 | Back on the phone's Status scene, or you on camera. | "[ADD YOURS: one real thing you learned, in your own words.] Highwater isn't an official warning system. In an emergency, always follow local officials and call 911. Thanks for watching." |

Total: about 2:50. If you run long, shorten the 1:05 shot first, then the route shot.

## Recording checklist

- [ ] Turn on **Do Not Disturb** (no notifications popping up on the recording).
- [ ] Screen **brightness all the way up**; turn off auto-brightness.
- [ ] Phone **charged** (or plugged in) and Low Power Mode **off** (it can slow animations).
- [ ] **Restart the dev server** first: in the project, run `npx expo start --tunnel ngrok --port 8082` from the `mobile` folder, then reopen the app in Expo Go. A stale server causes "request timed out."
- [ ] Close other apps so the phone doesn't stutter.
- [ ] Turn **Reduce Motion off** for the recording so the animations show.
- [ ] Use the phone's built-in **screen recorder** (iPhone: Control Center → Screen Recording; Android: Quick Settings → Screen record). Turn the microphone on if you narrate live, or record the voice separately.
- [ ] Do one full practice run, then record. Trim the start and end so it's **under 3:00**.
- [ ] Upload to YouTube as **Public** (not Unlisted or Private) [CHECK the 2026 rules for which is required].

## YouTube title and description

**Title:** Highwater: a flood and weather readiness app for South Carolina's 5th District (Congressional App Challenge 2026)

**Description:**

Highwater is a free app that shows people in South Carolina's 5th District (Cherokee, Chester, Fairfield, Kershaw, Lancaster, Lee, Union, and York counties) what weather and flood dangers are near them right now, and what to do about them.

It combines live data from the National Weather Service, U.S. Geological Survey river gauges, and FEMA into one status: Normal, Watch, Warning, or Danger. It explains why, gives steps from official guidance, maps the district, plans lower-exposure routes during floods, and lets people report problems like flooded roads. The status comes from written rules, not AI.

Built with TypeScript, React Native + Expo, and Vite.

Try it: https://vsakethc-gif.github.io/highwater-sc5/
Code: https://github.com/vsakethc-gif/highwater-sc5

Highwater is not an official warning system. In an emergency, follow local officials and call 911.

Made by [ADD YOURS] for the 2026 Congressional App Challenge, SC-5.
