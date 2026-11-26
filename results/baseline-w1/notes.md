# baseline-w1 — first wave, 300 listeners

- **When:** 26 Nov 2026, ~16:00 UTC
- **Environment:** Baseline (project MixLab 56629), experiment "Ad frequency vs Premium (baseline)" (id 686), flag `ad_config`, primary metric `premium_clicked`
- **Command:** `npm run sim -- --env baseline --listeners 300 --personas sim/personas/baseline.yaml --seed 42 --run baseline-w1`
- **Run:** 8.7 s, 0 failed, every listener enrolled in the running experiment (no warnings)

## Local counts (simulator)

| Version | Listeners | premium_clicked | session_abandoned (left before song 10) | Avg songs heard | Avg ads seen |
|---|---|---|---|---|---|
| control (every 6) | 114 | 27 (23.7%) | 35 (30.7%) | 14.1 | 1.7 |
| every_3 | 90 | 33 (36.7%) | 32 (35.6%) | 13.4 | 3.1 |
| every_10 | 96 | 8 (8.3%) | 20 (20.8%) | 15.4 | 0.8 |

By persona (premium / abandoned):

| Persona | control | every_10 | every_3 |
|---|---|---|---|
| fan | 46% / 21% (n=28) | 18% / 18% (n=17) | 88% / 13% (n=16) |
| casual | 19% / 36% (n=53) | 11% / 21% (n=47) | 36% / 56% (n=45) |
| budget | 12% / 30% (n=33) | 0% / 22% (n=32) | 10% / 17% (n=29) |

## Flagsmith

- Exposures: **300 enrolled — Control 114, every_10 96, every_3 90**, identical to the local counts.
- `premium_clicked` analysis: still "Collecting data…" right after the run (events take time to reach the warehouse). The first computed analysis already included wave 2, so the experiment totals are in `../baseline-w2/notes.md`.

## Reading so far

Direction matches the hypothesis: every_3 lifts Premium clicks (36.7% vs 23.7%, about +55% relative) but more listeners leave early (35.6% vs 30.7%); every_10 has the fewest early exits but far fewer Premium clicks. With ~100 listeners per version the abandonment gap is small and noisy — the 1,000 and 3,000 waves will tell.
