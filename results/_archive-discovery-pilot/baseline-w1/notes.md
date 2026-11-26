# baseline-w1 — first wave (simulator v1, one persona)

- **When:** 26 Nov 2026, ~04:45 UTC
- **Environment / experiment:** Baseline · "Discovery ratio - baseline" (Flagsmith experiment 537), 100% enrolled, split 34/33/33
- **Command:** `npm run sim -- --env baseline --listeners 300 --personas sim/personas/single.yaml --seed 42 --run baseline-w1`
- **Persona mix:** one "average" persona (novelty appetite 0.4, patience 3.0) — see `sim/personas/single.yaml`
- **Run health:** 300/300 listeners enrolled, 0 failed, 0 config fallbacks, 5.8 s

## Primary metric: `discovery_saved` (Flagsmith dashboard, refreshed 04:46 UTC)

| Variation | Exposures | Occurrence rate | Lift vs control | 95% credible interval | Win probability |
|---|---|---|---|---|---|
| Control (`familiar_heavy`, 10%) | 115 | 9.6% | — | — | < 1% |
| `balanced` (30%) | 99 | 35.4% | +269.6% | [+38.7%, +500.5%] | 99% |
| `discovery_heavy` (50%) | 86 | 47.7% | +398.4% | [+96.0%, +700.8%] | > 99% |

Flagsmith's exposures and conversion rates match the simulator's local counts exactly (`local-summary.json`).

## Guardrail: `session_abandoned` (simulator local counts)

The experiment wizard allows one metric, so the guardrail comes from the simulator's own counts here.

| Variation | Abandoned (left before 5 tracks) |
|---|---|
| Control | 24 / 115 (20.9%) |
| `balanced` | 9 / 99 (9.1%) |
| `discovery_heavy` | 6 / 86 (7.0%) |

## Plain English

With a single, mildly curious listener type, more new songs means more people save a new song, and the
effect is large: at 30% new songs, about 1 in 3 listeners saved one, against 1 in 10 at 10%. Flagsmith is
> 99% sure that 50% is the best of the three **on the primary metric**.

Read this wave with care:

- **Small sample.** ~100 listeners per variation, so the credible intervals are very wide (+39% to +500% for `balanced`).
- **One persona.** Everyone has the same appetite for new music. The hypothesis is about the *mix* of
  listeners (comfort listeners getting tired of new songs), which this wave cannot show. That is step 7.
- **The control's 20.9% abandonment is most likely noise.** In an offline dry run of 3,000 listeners with the same
  persona, abandonment was 13–15% in every variation. Most early exits come from the model's flat 4%-per-track
  "left for other reasons" chance, which is the same for every variation.

**Not a decision yet.** Flagsmith suggests rolling out `discovery_heavy`; we don't, because the guardrail
has not been tested with realistic listener types.
