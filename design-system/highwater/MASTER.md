# Design System Master File: Highwater (phone app), "Night Tide"

> **LOGIC:** When building a specific screen, first check `design-system/highwater/pages/[screen].md`.
> If that file exists, its rules **override** this Master file. Otherwise follow the rules below.
> The code version of these rules is `mobile/src/theme/tokens.ts`; if the two ever disagree, fix one.

**Project:** Highwater (React Native + Expo phone app)
**Chosen:** 2026-10-24, option A "Night Tide" of three generated with UI UX Pro Max
(`--design-system` on "premium dark weather app atmospheric emergency"; styles Dark Mode (OLED) +
Glassmorphism; fonts from the Accessible & Ethical style). The tool's own first draft (a light
sky-blue web palette) was replaced by this file because it didn't fit a dark-first phone app.
**Keeps:** the "living scene" from REDESIGN.md (Status background, water line and rain that change
with the danger level), every screen, the Scenario timeline, animations, haptics, Reduce Motion.

---

## Colors

| Role | Hex | Contrast | Token |
|------|-----|----------|-------|
| Background | `#070B10` | | `dark.bg` |
| Surface (cards, sheets) | `#111821` | | `dark.surface` |
| Surface raised | `#18222D` | | `dark.surfaceRaised` |
| Text | `#F2F5F8` | 18.0:1 on bg | `dark.ink` |
| Text, secondary | `#A7B2BD` | 8.3:1 on surface | `dark.inkMuted` |
| Text, meta | `#8A96A2` | ≥ 4.9:1 on raised | `dark.inkFaint` |
| Accent (one only) | `#5EC8E5` | 9.2:1 on surface | `dark.accent` |
| Hairline | `rgba(255,255,255,0.08)` | | `dark.hairline` |

### Status (always with an icon and a word, never color alone)

| Level | Color | On surface | Brightness |
|-------|-------|------------|------------|
| Normal | `#6FD3C2` teal | 10.0:1 | 0.54 |
| Watch | `#F4D35E` yellow | 12.2:1 | 0.67 |
| Warning | `#FF9A4D` orange | 8.5:1 | 0.45 |
| Danger | `#FF7A93` rose | 7.2:1 | 0.37 |

Normal is teal-blue, not green, so no pair relies on red vs. green; the four also step in brightness,
which is what color-blind readers see first.

### The living scene (Status)

Each level: a vertical sky gradient (deep, near-black at the bottom), a brighter water line, and the
level's status color as its accent. Text on the scene: white, 72% white, 62% white (all ≥ 4.5:1).

## Typography

| Use | Font | Weights |
|-----|------|---------|
| Big moments (the level word, screen titles on scenes) | Newsreader | 500, 600 |
| Everything else (UI, body, numbers) | Atkinson Hyperlegible Next | 400, 500, 600, 700 |

Atkinson Hyperlegible was designed by the Braille Institute for low-vision readers: letters that are
easy to tell apart (I l 1, O 0) matter on a cracked phone in a storm. Numbers use tabular figures.
Scale: 12 / 13 / 15 / 16 / 17 / 20 / 24 / 30 / 40 / 64.

## Space and shape

- 4-point grid; screen padding 20; 16 between sections and modules; generous, never squished.
- Radius: 8 small, 14 medium, 18 modules, 28 sheets, pill for chips.
- Surfaces are flat or frosted glass (scene and floating controls only), with 1 px light hairlines.
  No drop shadows on dark.

## Motion

Strong ease-out for entering and settling, ease-in-out for moving across the screen, no ease-in.
UI motion under 300 ms; the scene color change, water rising, route line drawing and Scenario timeline
are the signature moments and may be longer. Emergency information (911, Danger, the power-line
warning) appears instantly. Reduce Motion: fades only.

## Avoid

Purple/pink gradients, gradient text, neon glows, emoji as icons, light-gray text on dark below 4.5:1,
red-vs-green-only status, decorative blur outside the scene and floating controls, identical card grids.
