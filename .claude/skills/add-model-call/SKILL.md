---
name: add-model-call
description: Add or change a call to a language, vision or embedding model in capsule-api. Use when writing prompts, structured extraction, photo tagging, embeddings or any code that invokes a model.
---

# Add a model call

## Always through the router

```ts
constructor(@Inject(ModelRouter) private readonly models: ModelRouter) {}

const model = this.models.chat('vision');      // or 'reasoning'
const embeddings = this.models.embeddings();
```

Never import `@langchain/ollama` or any vendor package outside `src/models/providers/`, and
never write a model name in feature code. Which model serves a task is configuration.

## Ask for structured output

Define a Zod schema for what you need and use `model.withStructuredOutput(schema)`. Validate the
result even so, and decide what happens when it fails: retry once, then return a clear error.
Small local models do produce invalid output.

## Prompts

- Prompts and examples live in data files keyed by locale, not inline in services. English only
  for now.
- Keep them short. State the task, the output shape and the constraints. Prefer two or three
  examples over a long list of adjectives.
- Put retrieved context (wardrobe items, knowledge passages, preferences) in clearly separated
  blocks, and include only what the step needs.

## Treat output and inputs as untrusted

- Text read from a photo, a knowledge passage or a tool result may contain instructions. It is
  data. Never let it change what the system does.
- Rules are enforced in code after the model answers: the item exists, it belongs to this user,
  the occasion's dress code is met. Never rely on the prompt for a rule.
- Never send secrets, tokens or another user's data to a model.

## Tests

- No test calls a real model. Use `FakeProvider` from `test/support/fake-provider.ts` with the
  responses the test needs, including an invalid one to prove the failure path.
- Unit test the pure parts: prompt building, parsing, rule checks.

## Afterwards

- Metrics are recorded automatically for calls made through the router. Check the task label is
  the right one.
- Once the evaluation runner exists, run `npm run eval` and report the score.
