# Guardrail twin — `session_abandoned` as the primary metric, 4,300 listeners

The experiment wizard allows one metric per experiment, so the Baseline experiment could only judge `premium_clicked`. This twin run gives the guardrail its own Flagsmith analysis.

- **When:** 26 Nov 2026, ~19:25 UTC
- **Environment:** Guardrail (project MixLab 56629), experiment "Ad frequency vs abandonment (guardrail twin)" (id 710), flag `ad_config`, **primary metric `session_abandoned` (lower is better)**
- **Listeners:** the same 4,300 listener IDs, seeds and personas as Baseline waves 1–3, sent with `--save-as` so Baseline's results stay untouched:

```bash
npm run sim -- --env guardrail --run baseline-w1 --listeners 300  --seed 42 --save-as guardrail-w1
npm run sim -- --env guardrail --run baseline-w2 --listeners 1000 --seed 43 --save-as guardrail-w2
npm run sim -- --env guardrail --run baseline-w3 --listeners 3000 --seed 44 --save-as guardrail-w3
```

- 0 failed, all enrolled. Local summaries: `results/guardrail-w1..w3/local-summary.json`.
- **Not an exact replay:** Flagsmith buckets each identity per experiment, so in this environment some listeners landed in a different version than in Baseline (e.g. control 1,482 here vs 1,435 in Baseline). The listeners are the same people (persona, genres, random seed); the version split is a fresh random draw. That makes it an independent second run of the same test.

## Flagsmith (as of 26 Nov 2026, 19:31 UTC)

| Version | Exposures | Left before song 10 | Change vs control | 95% credible interval | Chance to be best (lowest) |
|---|---|---|---|---|---|
| Control (every 6) | 1,482 | 24.9% | — | — | 8% |
| every_3 | 1,389 | **40.5%** | **+62.8%** | **[+45.0%, +80.5%]** | < 1% |
| every_10 | 1,429 | 22.8% | −8.4% | [−20.3%, +3.5%] | 92% |

Matches the local totals (369/1,482, 563/1,389, 326/1,429).

Premium clicks in the same run (local counts; not this experiment's primary): control 310/1,482 = 20.9%, every_3 467/1,389 = 33.6%, every_10 120/1,429 = 8.4% — the Baseline result again.

## Reading

- **every_3's cost is real.** Abandonment rises by about 63% (24.9% → 40.5%), and even the low end of the interval is +45%. The guardrail half of the hypothesis is confirmed with Flagsmith's own statistics.
- **every_10 does not clearly help.** It lowers abandonment by 8% on average, but the interval (−20% to +3.5%) includes 0, so we cannot say it keeps more listeners than every 6. Flagsmith's banner calls it the "winner" at 92%, but, as in the A/A check, that is the chance it is the lowest, not proof of an effect. And every_10 costs ~60% of Premium clicks.
- So the trade-off for shipping is only between **every_6** and **every_3**: about +13 Premium clicks vs +16 early leavers per 100 listeners.
