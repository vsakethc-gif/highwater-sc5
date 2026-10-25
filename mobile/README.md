# Highwater phone app (React Native + Expo)

The native phone version of Highwater, for testing on a real phone and for the demo video. **It is not published to any app store.** It runs inside the free **Expo Go** app.

It uses the same "brain" as the website: the hazard rules, guidance, data code, and Scenario Mode all live in [`../shared`](../shared) and are used by both apps. Only the screens are different (native components here, web pages in `../src`).

## Run it on your phone

1. Install **Expo Go** from the App Store (iPhone) or Google Play (Android).
2. On the computer, in this folder:
   ```bash
   npm install
   npm start
   ```
   (`npm start` first copies the built-in data from `../public/data`, then starts the Expo dev server and shows a QR code.)
3. Scan the QR code: iPhone, use the **Camera** app; Android, use the **Scan QR code** button in Expo Go.
4. Your phone and computer must be on the **same Wi-Fi**. If they can't be (school or public Wi-Fi often blocks this), run `npx expo start --tunnel` instead.
5. The app only runs while `npm start` is running on the computer. Before recording, restart it and reopen the app in Expo Go.

## Folders

| Folder | What lives there |
|---|---|
| `src/app/` | Screens (Expo Router: every file is a screen; `(tabs)` is the bottom tab bar) |
| `src/components/` | Status card, gauge rows (water tubes and sparklines), guidance checklist, tab bar, location picker |
| `src/theme/` | Design tokens for light and dark mode (`tokens.ts`) and the motion system (`motion.ts`) |
| `src/platform.ts` | Plugs the phone into the shared code: bundled data files, AsyncStorage, random IDs |
| `src/state.tsx` | The chosen place and Scenario Mode, shared by every tab |
| `scripts/copy-data.mjs` | Copies the website's built-in data into `src/generated-data/` before each start |
