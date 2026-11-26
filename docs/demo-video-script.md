# MixLab — demo video script (~3 minutes)

The judges score: a clear hypothesis, versions behind a flag, a metric from real events, results you can explain. Plus: use of Flagsmith, impact, creativity, and the video itself.

**Before recording**
- Have these tabs open and logged in:
  1. The deployed player, with `?debug` added to the URL.
  2. Flagsmith → MixLab → Baseline → Features → `ad_config`.
  3. Flagsmith → Baseline → Experiments → "Ad frequency vs Premium (baseline)" (Completed; the results are still there).
  4. The AA, Guardrail and PersonaSwap experiment pages.
  5. A terminal in the repo.
- Turn the player's volume down a little, since the music is real.
- Speak slowly. About 420 words in total, so about 140 words a minute.
- **Note:** the experiments are now completed, so the player's debug panel shows `control` and "In experiment: false" for everyone. That is the shipped state. Say so when you show it (scene 3).

---

### 1. The problem — 0:00–0:20

**Screen:** the player's home page, then click a few genres.

> Every free music app has the same problem. Play more ads, and some listeners pay for Premium to get rid of them. Play too many, and they just leave. So how often should ads play? I built MixLab, an ad-supported music player, to answer that with a real A/B test in Flagsmith.

### 2. Hypothesis — 0:20–0:40

**Screen:** README, "Hypothesis" section (or a simple slide).

> My hypothesis: playing an ad every 3 songs instead of every 6 raises the share of listeners who click Go Premium by at least 25%, but more listeners abandon, meaning they leave before hearing 10 of the 20 songs. And every 10 songs does the opposite. So Premium clicks is the primary metric, and abandonment is the guardrail.

### 3. The app and the flag — 0:40–1:15

**Screen:** play a mix in the player. Show an ad break with the Go Premium button, open the debug panel, then switch to the `ad_config` flag in Flagsmith.

> Here's the player. Real Creative Commons music, a 20-song mix, and ad breaks. You can see them right in the track list. Every ad has a Go Premium button.
>
> The ad schedule comes from one Flagsmith flag, `ad_config`. It's multivariate, with three JSON values: every 6 songs, the control; every 3; and every 10. Only the number changes, so any difference has one cause. The app calls `getExperimentFlag`, which assigns a version and records the exposure, then sends `premium_clicked` and `session_abandoned` with `trackEvent`, under the same ID. If Flagsmith is unreachable, it falls back to every 6.
>
> The debug panel shows my ID and version. It says control, because the test is over and control is what we shipped. I'll come back to that.

### 4. The traffic — 1:15–1:35

**Screen:** terminal, run `npm run sim -- --env baseline --listeners 300 --dry-run` (or show an earlier run's output). Then the persona table in the README.

> All the traffic is simulated, which the organisers allow, and I'll be upfront about it. Simulated listeners (fans, casual listeners and budget listeners) go through the same playlists and ad schedules. Ads annoy them; annoyed listeners with money may click Premium; listeners who run out of patience leave. They send real events through the Flagsmith SDK. The model never knows which version a listener got. And Flagsmith's counts matched my local counts exactly, every run.

### 5. Results — 1:35–2:25

**Screen:** Baseline experiment results (lift, interval, chart) → Guardrail experiment → A/A experiment.

> Over 4,300 listeners, every_3 raised Premium clicks by 60%. The 95% credible interval runs from +40% to +80%, so even the low end beats my 25% target. Flagsmith gives it over a 99% chance to be best.
>
> But the guardrail matters. Flagsmith allows one metric per experiment, so I re-ran the same listeners in a twin environment with abandonment as the primary metric. every_3 makes 63% more listeners leave early, with an interval from +45% to +81%. That's real.
>
> And here's why I read intervals, not banners. In my A/A test, both versions are identical, yet Flagsmith shows an 89% "winner". The interval crosses zero, so there's no real difference. Compare that with every_3, where the interval is nowhere near zero.
>
> With a budget-heavy audience, every_3 still wins, but the cost depends on who your listeners are.

### 6. Decision and ship — 2:25–2:55

**Screen:** the "Complete experiment" dialog screenshot (`docs/images/ship-control.jpg`), then the README "What we ship" section.

> So, what did I ship? Flagsmith suggested every_3, and I kept every 6. Per 100 listeners, every_3 gains about 13 Premium clicks but loses about 16 listeners before song 10, mostly casual listeners. A click isn't a sale, but a lost listener is certain. every_10 loses most Premium clicks without clearly keeping anyone.
>
> So I ended every experiment with "Roll out control", and now everyone gets an ad every 6 songs. Next, I'd test every 4 or 5, and every_3 only for fans, using a Flagsmith segment.

### 7. Close — 2:55–3:05

**Screen:** GitHub repo / README top.

> Everything (the player, the simulator, the results and how to run it) is in the repo. Built with Flagsmith Experimentation and Claude Code. Thanks for watching.

---

**Checklist after recording**
- Under about 3 minutes 15 seconds.
- Each number said aloud matches the README: +60% (+40% to +80%), +63% (+45% to +81%), 89% A/A with an interval crossing 0, about 13 vs 16 per 100.
- The video says clearly that all traffic is simulated.
- Add the video link to the top of the README and to the submission.
