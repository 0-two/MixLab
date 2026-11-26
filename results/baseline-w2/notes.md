# baseline-w2 — second wave, 1,000 listeners

- **When:** 26 Nov 2026, ~16:10 UTC
- **Environment:** Baseline (project MixLab 56629), same running experiment as w1 (id 686), flag `ad_config`, primary metric `premium_clicked`
- **Command:** `npm run sim -- --env baseline --listeners 1000 --personas sim/personas/baseline.yaml --seed 43 --run baseline-w2`
- New run ID → 1,000 new identities (`sim-baseline-w2-<n>`), new seed. 20.7 s, 0 failed, all enrolled.

## Local counts (this wave only)

| Version | Listeners | premium_clicked | session_abandoned (left before song 10) | Avg songs heard | Avg ads seen |
|---|---|---|---|---|---|
| control (every 6) | 338 | 85 (25.1%) | 89 (26.3%) | 14.8 | 1.8 |
| every_3 | 313 | 102 (32.6%) | 134 (42.8%) | 12.4 | 2.7 |
| every_10 | 349 | 31 (8.9%) | 85 (24.4%) | 15.2 | 0.7 |

By persona (premium / abandoned):

| Persona | control | every_10 | every_3 |
|---|---|---|---|
| fan | 63% / 15% (n=71) | 20% / 25% (n=79) | 75% / 23% (n=73) |
| casual | 21% / 33% (n=165) | 8% / 25% (n=168) | 26% / 63% (n=147) |
| budget | 5% / 23% (n=102) | 1% / 23% (n=102) | 10% / 26% (n=93) |

## Flagsmith — experiment total after w1 + w2 (1,300 listeners)

As of 26 Nov 2026, 16:11 UTC. Primary metric `premium_clicked`:

| Version | Exposures | Rate | Lift vs control | 95% credible interval | Win probability |
|---|---|---|---|---|---|
| Control (every 6) | 452 | 24.8% | — | — | 1% |
| every_3 | 403 | 33.5% | **+35.2%** | [+6.6%, +63.8%] | **99%** |
| every_10 | 445 | 8.8% | −64.6% | [−76.7%, −52.6%] | < 1% |

Cross-check: exposures equal w1 + w2 local counts (114+338, 90+313, 96+349) and the rates equal the local totals (112/452, 135/403, 39/445). Flagsmith says: "every_3 is outperforming Control by +35.2% with 99% probability of being the best variant."

## Guardrail — `session_abandoned`, local totals w1 + w2

Flagsmith's results page shows only the primary metric, so the guardrail comes from the simulator's counts:

| Version | Abandoned | Rate |
|---|---|---|
| Control (every 6) | 124 / 452 | 27.4% |
| every_3 | 166 / 403 | **41.2%** |
| every_10 | 105 / 445 | 23.6% |

## Reading

- **Premium:** the hypothesis holds — every_3 lifts Premium clicks by about a third (≥25% target met at the point estimate; the credible interval's low end is +6.6%, so the true lift could be smaller). every_10 loses about two-thirds of Premium clicks.
- **Guardrail:** every_3 costs a lot of listeners — about 14 more points of early abandonment than control, driven by casual listeners (63% leave early). every_10 saves only ~4 points of abandonment for a large loss in Premium.
- So "every_3 wins" on the primary metric is not the whole decision: per 100 listeners it gains ~9 Premium clicks but loses ~14 more listeners early (about 1.6 early leavers per extra Premium click). The 3,000 wave and a twin environment with `session_abandoned` as primary will put an interval on that trade-off.
