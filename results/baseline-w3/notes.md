# baseline-w3 — third wave, 3,000 listeners

- **When:** 26 Nov 2026, ~18:20 UTC
- **Environment:** Baseline (project MixLab 56629), same running experiment as w1–w2 (id 686), flag `ad_config`, primary metric `premium_clicked`
- **Command:** `npm run sim -- --env baseline --listeners 3000 --personas sim/personas/baseline.yaml --seed 44 --run baseline-w3`
- New run ID → 3,000 new identities, new seed. 47.8 s, 0 failed, all enrolled.

## Local counts (this wave only)

| Version | Listeners | premium_clicked | session_abandoned (left before song 10) | Avg songs heard | Avg ads seen |
|---|---|---|---|---|---|
| control (every 6) | 983 | 192 (19.5%) | 245 (24.9%) | 14.8 | 1.9 |
| every_3 | 1,041 | 354 (34.0%) | 430 (41.3%) | 12.7 | 2.7 |
| every_10 | 976 | 75 (7.7%) | 224 (23.0%) | 15.3 | 0.7 |

By persona (premium / abandoned):

| Persona | control | every_10 | every_3 |
|---|---|---|---|
| fan | 41% / 29% (n=199) | 18% / 28% (n=163) | 75% / 23% (n=223) |
| casual | 21% / 27% (n=490) | 9% / 21% (n=489) | 32% / 58% (n=494) |
| budget | 3% / 19% (n=294) | 1% / 24% (n=324) | 10% / 28% (n=324) |

## Flagsmith — experiment total after w1 + w2 + w3 (4,300 listeners)

As of 26 Nov 2026, 18:35 UTC. Primary metric `premium_clicked`:

| Version | Exposures | Rate | Lift vs control | 95% credible interval | Win probability |
|---|---|---|---|---|---|
| Control (every 6) | 1,435 | 21.2% | — | — | < 1% |
| every_3 | 1,444 | 33.9% | **+59.9%** | [+40.2%, +79.5%] | **> 99%** |
| every_10 | 1,421 | 8.0% | −62.1% | [−69.8%, −54.5%] | < 1% |

Cross-check: exposures equal the summed local counts (114+338+983, 90+313+1041, 96+349+976) and rates equal the local totals (304/1435, 489/1444, 114/1421).

## Guardrail — `session_abandoned`, local totals w1 + w2 + w3

| Version | Abandoned | Rate |
|---|---|---|
| Control (every 6) | 369 / 1,435 | 25.7% |
| every_3 | 596 / 1,444 | **41.3%** |
| every_10 | 329 / 1,421 | 23.2% |

## Reading

- **Premium:** with 4,300 listeners the lift is now clearly above the hypothesis's +25% target: even the low end of the 95% interval is +40%. every_10 loses about 60% of Premium clicks.
- **Guardrail:** every_3 makes 15.6 more listeners per 100 leave before song 10 (41.3% vs 25.7%), for 12.7 more Premium clicks per 100 (33.9% vs 21.2%). Casual listeners drive it (58% abandon under every_3 vs 27% under control).
- every_10 keeps only ~2.5 more listeners per 100 than control, so it is not worth the lost Premium clicks.
- Why the lift grew from +35% (w1–w2) to +60%: control's rate dropped from 24.8% to 21.2% as more listeners arrived (the earlier waves were small and noisy); every_3 stayed at ~34%.
