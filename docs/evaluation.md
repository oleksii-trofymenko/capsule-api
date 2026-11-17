# Evaluation

`npm run eval` scores the stylist on 30 scenarios and prints one number out of 100. Run it after
any change to a prompt, the graph, retrieval or a model, and put the score in the commit or pull
request. A change that lowers the score beyond the run-to-run spread below is not finished.

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
- Scenarios use the playground's sample wardrobe and occasions until the real ones exist (T07,
  T10). The stylist under test is the playground chat until the stylist graph (T11) replaces it.
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
