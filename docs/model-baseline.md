# Model baseline (T02)

Measured 2026-11-17 on the development machine: RTX 5070 Ti 16 GB, Ollama 0.40.16.

## Decision

**Keep `gemma4:12b` for both `vision` and `reasoning`.** It beat the alternative on every
measure for both tasks. It uses about 9 GB of VRAM (Q4_K_M, 11.9B parameters), which leaves room
for `nomic-embed-text` on the same card. No change to `.env.example`.

| Task      | Model          | Score                | Warm median | Warm p90 | Cold first call |
| --------- | -------------- | -------------------- | ----------- | -------- | --------------- |
| Vision    | **gemma4:12b** | 41/50 all tags right | 2.6 s       | 2.6 s    | 67 s            |
| Vision    | qwen3-vl:8b    | 16/50 all tags right | 4.7 s       | 7.9 s    | 17 s            |
| Reasoning | **gemma4:12b** | 16/20 good answers   | 2.3 s       | 4.4 s    | 2.9 s           |
| Reasoning | qwen3:8b       | 12/20 good answers   | 5.6 s       | 15.6 s   | 18 s            |

"Cold first call" includes loading the model into VRAM. Ollama unloads an idle model after a few
minutes by default, so the first request after a quiet period pays this cost again.

## Vision tagging

**Method.** 50 photos, each tagged once with temperature 0.2. The model had to answer as JSON
against a fixed schema: `category` (23 values), `colour` (17 values), `pattern` (7 values) and a
short description. Each answer was compared with a hand label that lists every acceptable
answer, so a blazer worn over a skirt accepts `blazer`, `jacket` or `skirt`.

**Photos.** Openly licensed images from Wikimedia Commons (CC0, CC BY, CC BY-SA or public
domain), downscaled to 768 px. The set covers 19 garment types and a mix of shots: product photos,
items worn by a person, mannequins, museum pieces, hanging and flat lays. The images and labels
stay outside the repository. They are not phone photos of a real wardrobe, so this is a first
read. The owner will add their own photos for a second run.

**gemma4:12b results**

| Measure                      | Correct |
| ---------------------------- | ------- |
| Valid JSON within the schema | 50/50   |
| Category                     | 46/50   |
| Colour                       | 45/50   |
| Pattern                      | 45/50   |
| All three                    | 41/50   |

Misses worth knowing:

- Four category misses. Two of them are arguably label problems: a person wearing several items,
  where the model picked a different "main" item than the label did (a lace top over denim
  shorts; a houndstooth coat over a scarf). The other two: folded red trousers called `shorts`,
  and a worn skirt called `dress`.
- Colour: navy and black, and light blue and lilac, get confused. Neither matters much for
  styling, but the user should be able to correct it in one tap (T08).
- Pattern: a few `striped` or `floral` on plain items. A user correction covers these too.

**qwen3-vl:8b** was markedly worse. It named all four pairs of heels as `shorts`, called two
coats a `t-shirt`, and chose `textured` or `striped` for most plain items.

## Reasoning (styling chat)

**Method.** 20 styling prompts through `POST /v1/playground/chat`, with the playground's tools
and sample wardrobe (14 items, 6 occasions). The prompts cover the occasions in the sample data,
occasion rules (white trainers at a wedding), gaps in the wardrobe (beach, black tie, red dress),
a vague request, a seasonal request and a body-related remark. Each answer was graded by hand:
it only suggests owned items, follows the occasion rules, admits a gap plainly, asks one question
when the request is vague, and never comments on a body. To switch the model, the API was
restarted with `MODEL_REASONING` set in the shell; no code changed.

**gemma4:12b.** It called the expected tool on 20/20 prompts with no errors. 16/20 answers were
good. It refused trainers at a wedding with the reason, asked one question when the request was
vague, said plainly there is no red dress or beachwear, and stayed neutral about the body
remark.

The 4 failures share one cause. The model searched narrowly, got an empty result and reported a
gap that is not real: no formal top for a wedding (it owns a white shirt), no white shirt to go
with the blazer, no rain gear (it owns a waxed jacket), and a funeral answer that asked the user
what they own. Most of this comes from the playground's `search_wardrobe`. It matches whole
words against name, colour, formality and season, so "formal" misses a shirt tagged "smart" and
"rain" matches nothing. See the findings below.

**qwen3:8b.** Slower, and less reliable:

- One empty answer (job interview).
- One rambling answer about being "stuck in a loop" (office).
- Suggested items the wardrobe does not have ("black dress shoes", "rent a blouse").
- A tie for the beach.
- Exposed internal item ids such as `w09` to the user.

## Findings for later tasks

- **Wardrobe search (T07, T11).** Keyword matching produces false "you don't own that" answers.
  The real wardrobe search needs related terms (formal ↔ smart, rain ↔ waterproof) or embedding
  search. The stylist prompt should also tell the model to widen a search before saying
  something is missing. The evaluation set (T04) should include "owned but not found" cases.
- **Unknown occasions (T10).** For a garden party, gemma4 looked up the wedding-guest dress code.
  The occasion library needs a clear "not found, here is the closest" path.
- **Cold start.** The first vision call after loading took 67 s. Set Ollama `keep_alive` for the
  vision model, or warm it at startup, before T08 ships.
- **Several items in one photo (T08).** The prompt asks for "the most prominent item". Photos of
  a person wearing a full outfit should produce one tag set per item, or ask which item is meant.
- **Local setup.** The `minio/minio` image can no longer be pulled from Docker Hub, so `npm run
setup` fails at MinIO. This baseline only needed Postgres. Fix it in its own branch before T06,
  which uses object storage.
