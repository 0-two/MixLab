# aa-w1 — A/A check, 3,000 listeners

- **When:** 26 Nov 2026, ~18:37 UTC
- **Environment:** AA (project MixLab 56629), experiment "A/A check: identical every_6 ad configs" (id 705), flag `ad_config_aa`, primary metric `premium_clicked`
- **Both versions are the same:** `{"ad_every_n_songs":6,"ad_length_seconds":15}` (control and every_6_copy, split 50/50)
- **Command:** `npm run sim -- --env aa --flag ad_config_aa --listeners 3000 --personas sim/personas/baseline.yaml --seed 45 --run aa-w1`
- 62.9 s, 0 failed, all enrolled. Run once; not re-run.

## Local counts

| Version | Listeners | premium_clicked | session_abandoned |
|---|---|---|---|
| control | 1,486 | 297 (20.0%) | 382 (25.7%) |
| every_6_copy | 1,514 | 332 (21.9%) | 360 (23.8%) |

## Flagsmith (as of 26 Nov 2026, 18:39 UTC)

| Version | Exposures | Rate | Lift vs control | 95% credible interval | Win probability |
|---|---|---|---|---|---|
| control | 1,486 | 20.0% | — | — | 11% |
| every_6_copy | 1,514 | 21.9% | +9.7% | **[−5.6%, +25.0%]** | 89% |

Flagsmith's banner says "every_6_copy is outperforming Control by +9.7% with 89% probability … consider rolling out".

## Reading

- The two versions are identical, so any gap is luck. The 95% credible interval **includes 0** (−5.6% to +25%), so the data shows no real difference: the A/A check passes.
- An 89% chance-to-be-best looks convincing but is not a confirmed winner. With two identical versions the chance-to-be-best bounces around by luck; values this far from 50% are common at this sample size. This is exactly why we decide from the credible interval (does it exclude 0, and by how much?) rather than the banner alone.
- Compare with Baseline: every_3's interval is +40% to +80% — nowhere near 0 — so that result is not luck.
- Assignment is balanced (1,486 vs 1,514; 49.5% / 50.5%), and the guardrail rates are close (25.7% vs 23.8%).
