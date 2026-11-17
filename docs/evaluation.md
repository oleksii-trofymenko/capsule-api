# Evaluation

`npm run eval` scores the stylist on 30 scenarios and prints one number out of 100. Run it after
any change to a prompt, the graph, retrieval or a model, and put the score in the commit or pull
request. A change that lowers the score beyond the run-to-run spread below is not finished.

**Current reference: 94.2 ±1.2, the stylist graph (T11).** Compare changes with that. The T04
baseline (92.0, the old playground chat) is kept below as history.

It needs Ollama with the configured models. It does not need the database or the API server.
A run takes about four minutes on the development machine. Full replies and verdicts are written
to `eval-results/`, which git ignores.

## What is scored

Each scenario (`src/eval/scenarios.ts`) is a conversation, a sentence on what a good reply does,
and optional checks done in code. The reply is scored three ways:

| Part        | How                                                                                                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules       | Share of checks passed. Code checks on every reply: it is not empty, leaks no model reasoning, shows no internal ids. Per scenario: tools called, phrases that must or must not appear, asks a question, prices within budget. The judge adds two: suggests only owned items, follows the rules |
| Tone        | Judge grade from 1 to 5 against the persona's voice, scaled to 0 to 100                                                                                                                                                                                                                         |
| Wearability | Judge grade from 1 to 5 for replies that suggest an outfit, scaled to 0 to 100                                                                                                                                                                                                                  |

The score is the mean of the three. The judge is the configured `reasoning` model, given the
prompt in `src/eval/judge-prompt.ts` and asked for a validated verdict. An empty reply is failed
in code without asking the judge.

## Limits

- The judge is the same local model as the stylist, so it is lenient with its own habits. The
  code checks carry the rules that matter most for that reason.
- The stylist under test is the stylist graph (`src/stylist/`) with the occasion library. The
  person owns the playground's sample wardrobe, passed in memory so the judge's list of owned
  items matches exactly, and has no style profile.
- Scenarios still name the old playground's tools. The graph has no tools; it reports what it
  gave the model on that turn, and `src/eval/main.ts` maps it: wardrobe to `search_wardrobe`,
  dress code to `get_dress_code`, date to `get_today`. Because the graph always loads these for an
  outfit or an answer, some of those checks now pass by construction. Renaming the checks to
  capabilities is a separate evaluation revision.
- Replies vary between runs at temperature 0.2. Compare a change against the spread, not a single
  number.

## Baseline

2026-11-17. Stylist: the playground chat with the T03 persona, `gemma4:12b` for reasoning and as
the judge, on the RTX 5070 Ti. Two runs:

| Run | Rules | Tone | Wearability | Score | Judge failures |
| --- | ----- | ---- | ----------- | ----- | -------------- |
| 1   | 95.6  | 84.2 | 100         | 93.3  | 0              |
| 2   | 96.1  | 80.2 | 96.1        | 90.8  | 1              |

**Baseline: 92.0, spread ±1.3.** A median scenario takes about 3 s for the reply plus the
judge's time.

Scenarios that failed in both runs, and why:

- `funeral`: says the person lacks dark formal clothes. The playground's keyword search misses the
  charcoal trousers and navy blazer (found in T02).
- `tie-at-office`, `winter-pieces`: the judge marks items as not owned when the reply names them
  loosely ("navy blazer", "white button-down shirt").
- `red-dress`: the reply suggests buying a red dress, which the judge counts as pushing a purchase.
- `preferences`: the reply asks about an occasion instead of acknowledging the size and neckline.

Seen in one run each: `black-tie` and `size-from-photo` returned an empty reply. The first
loops on occasion lookups until the playground's limit of six model calls; the second produced
nothing at all.

## Stylist graph (T11)

2026-11-17. The stylist graph replaces the playground chat as the subject; same model, judge and
scenarios. Three runs:

| Run | Rules | Tone | Wearability | Score |
| --- | ----- | ---- | ----------- | ----- |
| 1   | 98.5  | 89.2 | 94.8        | 94.2  |
| 2   | 98.5  | 90.8 | 96.9        | 95.4  |
| 3   | 98.0  | 87.5 | 93.8        | 93.1  |

**Mean 94.2, spread ±1.2: above the T04 baseline of 92.0.** Without the tool-name checks, rules
rose from 95.0 and 95.5 to 98.3; the baseline passed all of those checks too, so the gain is not
structural. A median scenario now takes about 1 s.

Two changes got it there. Thinking is off for Ollama chat models: gemma4 otherwise spent most of
its output on a hidden reasoning channel, and graph replies took 20 to 40 s and often came back
empty (score 68.3). The persona no longer mentions tools: it told the model to use a "wardrobe
tool", so with the wardrobe given in the prompt it said the items were not there (score 90.0).

Still failing in some runs: `garden-party` (no linen named), `feedback-too-stiff` (the swap is
not named as a jumper or waxed jacket), `winter-pieces`, `trend-wide-leg` and `forecast`.
