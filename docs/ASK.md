# Ask

The Ask tab answers questions about neurotechnology using only the records NeuroBase
holds. It is a retrieval system with an optional writer, not a chatbot with a database
attached: the evidence is fixed before any prose is written, and the prose is optional.

## How an answer is produced

1. **Strip the question to its subject.** "Which companies are developing implanted
   speech neuroprostheses?" becomes "companies are developing implanted speech
   neuroprostheses" (`src/ask/retrieve.ts`). A strip that would leave nothing is
   discarded, so short questions survive.
2. **Retrieve, precisely first.** The question runs through the same search service the
   rest of the product uses, with the filters the parser reads from the wording applied.
   Asking for recruiting trials should answer with recruiting trials.
3. **Broaden if that found nothing.** A question phrased so its filters exclude
   everything is re-run on ranking alone, and the answer says the filters were dropped.
   Precision when it is available, an answer when it is not.
4. **Write the answer.** With a model configured, it is given the retrieved records and
   nothing else. Without one, the answer is assembled from the records directly.
5. **Cite.** Every record used is numbered, and the markers in the answer link to it.

## The two modes

|                       | Generated                                      | Extractive                            |
| --------------------- | ---------------------------------------------- | ------------------------------------- |
| When                  | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set | No key, or the model call failed      |
| Prose                 | Written by the model from the records          | Assembled from the records themselves |
| Can it invent a fact? | Only by ignoring its instructions              | No — every line is a database row     |
| Citations             | Required on every factual sentence             | One per line, always                  |

The mode is stated on the answer, in those words. A model failure falls back to
extractive rather than failing the request: losing the prose is acceptable, losing the
evidence is not.

## The prompt

`src/ask/service.ts` holds it. The instructions are ordered by importance, and the first
one is the point: _use nothing outside the records_. It also tells the model that a
registered trial is not evidence a treatment works — the distinction the interface makes
everywhere else, which a model will otherwise blur.

The model never sees the question alone. It sees a numbered digest of each retrieved
record: entity type, title, subtitle, up to six metadata pairs, the date and the matched
passage.

## What it will not do

- It will not answer from a model's own knowledge of the field. If the records do not
  cover the question, it says which records exist and stops.
- It will not estimate, extrapolate or infer a number the records do not state.
- It will not hide how it searched. Every answer reports the terms used, the filters read
  from the wording, whether those filters were applied, and how many records matched.

## Configuration

```bash
ANTHROPIC_API_KEY=sk-ant-...   # preferred; the prompt was written against Claude
OPENAI_API_KEY=sk-...          # used when no Anthropic key is set
ANSWER_MODEL=claude-sonnet-5   # optional override
```

With neither set the tab still works, in extractive mode.

`POST /api/ask` takes `{ "question": string, "limit"?: number }` and returns the same
`AskAnswer` the page renders. It is rate-limited to 20 requests a minute per client,
harder than search, because an answer can cost a model call.
