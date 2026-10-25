# Submission checklist (Sunday, October 25, 2026)

Deadline: **Monday, October 26, 2026** [CHECK the exact time and time zone on congressionalappchallenge.us]. Plan: submit Sunday so there's a day of margin.

## 1. Before you open the form

- [ ] Read the **2026 rules** and note the form's word limits. [CHECK] Then pick the short or long version of each answer in `SUBMISSION.md`.
- [ ] Rewrite every answer in your own words. Fill in every **[ADD YOURS]** and **[CHECK]** in `SUBMISSION.md`, `DEMO_SCRIPT.md`, and `README.md`.
- [ ] Practice the 15 judge questions at the end of `FINAL_SUMMARY.md` out loud.

## 2. The video

- [ ] Recorded with the checklist in `DEMO_SCRIPT.md` (Do Not Disturb, full brightness, charged, dev server restarted).
- [ ] Length is **under 3:00** (aim for 2:30 to 2:50).
- [ ] Says your name, the app name, the one-sentence purpose, the audience, and the tools and languages.
- [ ] Uploaded to YouTube as **Public** [CHECK whether the rules require Public or allow Unlisted].
- [ ] Open the video link in a **private/incognito window** (signed out) and confirm it plays.
- [ ] Paste the link into `README.md` and `SUBMISSION.md` where it says [ADD VIDEO LINK].

## 3. Links to paste into the form

| What | Link |
|---|---|
| Web app | https://vsakethc-gif.github.io/highwater-sc5/ |
| Demo video | https://youtu.be/_xY-lvTFR6s |
| Code (GitHub) | https://github.com/vsakethc-gif/highwater-sc5 |

- [ ] The GitHub repo is **public**: open it in an incognito window. (It was public on Oct 24.)
- [ ] The README shows at the top of the repo page with the live link and the video link.

## 4. Check the web app on a phone you haven't used

Use a friend's or family member's phone (no saved settings or cached files), on cell data if you can:
- [ ] The app opens and shows a status for York County.
- [ ] Pick another county; the status changes.
- [ ] District map loads (it's the slowest page; give it a few seconds).
- [ ] Scenario Mode → "Hurricane Helene arrives (real data, Sept 27, 2024)": the SIMULATION banner shows and the status changes. Then exit Scenario Mode.
- [ ] Route page during a flood scenario plans routes; during the tornado scenario it says to stay where you are.
- [ ] Report page opens and the "I'm human" check loads.
- [ ] "How it works" page opens.

## 5. Keep the reports database awake through judging

Supabase pauses free projects after about 7 days with no activity, which would break community reports. This is already handled:
- A GitHub Action (`.github/workflows/keepalive.yml`) reads one public row **every 3 days** to keep it awake. It last ran successfully on Oct 22.
- [ ] Check it's still running: on GitHub go to the repo → **Actions** → **Keep Supabase awake** and confirm recent green checks. You can click **Run workflow** to run it by hand.
- [ ] Note: GitHub turns off scheduled actions on a repo with **no activity for 60 days**. Judging should be over before that, but if judging runs long, push any small change (or run the workflow by hand) to keep it going.
- [ ] If it ever pauses anyway: log in at supabase.com, open the project, and click **Restore project**. It takes a few minutes. Reports will show "unavailable" until then; the rest of the app keeps working.

## 6. Final things

- [ ] Don't change the app code after submitting (it's frozen).
- [ ] Keep the Cloudflare Worker running (free; nothing to do) and don't delete any accounts until judging is over.
- [ ] Save a copy of everything you pasted into the form.
- [ ] Screenshot the confirmation page or email after you submit.
