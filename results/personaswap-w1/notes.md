# personaswap-w1 — budget-heavy audience, 3,000 listeners

- **When:** 26 Nov 2026, ~18:37 UTC
- **Environment:** PersonaSwap (project MixLab 56629), experiment "Ad frequency vs Premium (budget-heavy audience)" (id 706), flag `ad_config`, primary metric `premium_clicked`
- **Audience:** `sim/personas/budget-heavy.yaml` — fans 10%, casual 30%, budget 60% (Baseline: 20 / 50 / 30). Same persona values, only the mix changes.
- **Command:** `npm run sim -- --env personaswap --listeners 3000 --personas sim/personas/budget-heavy.yaml --seed 46 --run personaswap-w1`
- 64.3 s, 0 failed, all enrolled.

## Local counts

| Version | Listeners | premium_clicked | session_abandoned | Avg songs heard | Avg ads seen |
|---|---|---|---|---|---|
| control (every 6) | 997 | 136 (13.6%) | 254 (25.5%) | 15.0 | 2.0 |
| every_3 | 975 | 237 (24.3%) | 355 (36.4%) | 12.7 | 3.2 |
| every_10 | 1,028 | 36 (3.5%) | 265 (25.8%) | 14.8 | 0.7 |

By persona (premium / abandoned):

| Persona | control | every_10 | every_3 |
|---|---|---|---|
| fan | 57% / 25% (n=87) | 18% / 29% (n=91) | 73% / 27% (n=97) |
| casual | 18% / 27% (n=299) | 6% / 24% (n=299) | 33% / 58% (n=310) |
| budget | 5% / 25% (n=611) | 0% / 26% (n=638) | 11% / 26% (n=568) |

## Flagsmith (as of 26 Nov 2026, 18:40 UTC)

| Version | Exposures | Rate | Lift vs control | 95% credible interval | Win probability |
|---|---|---|---|---|---|
| Control (every 6) | 997 | 13.6% | — | — | < 1% |
| every_3 | 975 | 24.3% | **+78.2%** | [+44.1%, +112.3%] | **> 99%** |
| every_10 | 1,028 | 3.5% | −74.3% | [−83.5%, −65.2%] | < 1% |

Exposures and rates match the local counts exactly.

## Reading

- **Same winner with a poorer audience.** Fewer people click Premium overall (13.6% vs 21.2% in Baseline), but every_3 still lifts it, even more in relative terms (+78% vs +60%) because the base is smaller.
- **Smaller guardrail cost.** every_3 loses ~11 more listeners per 100 before song 10 (36.4% vs 25.5%) for ~11 more Premium clicks per 100 — about one early leaver per extra Premium click, versus ~1.2 in Baseline. Budget listeners tolerate ads well (abandonment barely moves: 25% → 26%); the casual listeners are again the ones who leave (27% → 58%).
- So the trade-off depends on who the audience is: the more casual listeners, the more every_3 costs.
