# Project rules

## Git commits — always include a tokens-spent count

Every git commit made in this repository MUST include an approximate count of the
tokens spent producing that commit's work, as a trailer line in the commit
message body:

```
Tokens (approx): ~Nk
```

- Place it just **above** the `Co-Authored-By` line.
- `N` is the best available estimate — sum of any subagent token totals the
  harness reports plus a rough allowance for main-thread work.
- It is explicitly **approximate**; never imply exact precision.
- Also state the figure in the response that accompanies the commit.
- This rule applies to commits made through GitHub connectors and automated
  tools as well as local `git commit` operations.

## Verification before committing

Before committing code, run the smallest relevant verification set:

- Backend changes: `npm test`
- Frontend changes: `npm run web:build`
- Full-stack or user-flow changes: `npm test` and `npm run test:e2e`
- Coverage-sensitive changes: `npm run coverage`

Do not claim tests passed unless they were actually executed.

If a required command cannot be run, state:

1. Which command was not run
2. Why it could not be run
3. What manual verification is still required

Never commit known failing tests without explicitly documenting the failure.

## Git and branch safety

- Do not commit directly to `main` unless the user explicitly requests it.
- Create a descriptive branch for each independent task.
- Before editing, inspect the current branch and recent commits.
- Do not overwrite or revert unrelated user changes.
- Keep commits narrowly scoped.
- Before reporting completion, compare the working branch against its base.
- Never merge, force-push, delete a branch, or close a pull request without
  explicit approval.

## Permanent bug learnings

Every error, frustrating bug, failed approach, or time-consuming rabbit hole is
an opportunity to improve the repository's permanent operating instructions.

At the end of every task:

1. Summarize any errors, frustrating bugs, misleading assumptions, failed
   approaches, and rabbit holes encountered.
2. Extract a concrete, reusable rule that would prevent or shorten the same
   problem in the future.
3. Add that learned rule as a Markdown rule file under `.claude/rules/`.
4. Update an existing rule file instead of creating a duplicate when the lesson
   belongs to an established topic.
5. Make the rule specific and actionable: include the triggering condition, the
   required behavior, and any verification needed.
6. If the task produced no meaningful new lesson, explicitly state that no new
   rule was warranted; do not create filler rules.

Do not consider a task complete until its applicable learned rule has been saved
in `.claude/rules/`.

## Offline and PWA behavior

Treat offline behavior as a supported product feature, not an optional
enhancement.

- `GET /api/users` must continue to provide the last cached server snapshot.
- Offline user mutations must be queued locally and reflected optimistically.
- Queued mutations must survive page reloads.
- Replay mutations in their original order when connectivity returns.
- Do not send a server update for a temporary offline-only user ID.
- Editing an offline-created user must update its queued create operation.
- Pending users without coordinates must not be rendered on the globe.
- When a user is deleted, clear its point, pulse ring, pinned tooltip, hover
  state, and selected/focused state.
- Changes to offline logic require browser testing with DevTools network mode
  set to Offline, followed by reconnection testing.

## Environment variables and secrets

- Never commit real API keys, Firebase service-account JSON, tokens, or `.env`.
- Treat `FIREBASE_SERVICE_ACCOUNT` and `OWM_API_KEY` as server-only secrets.
- Only the documented Firebase web configuration may be returned by
  `/api/config`.
- Do not expose server environment variables to Vite through `VITE_*` unless
  they are intentionally public.
- Update `.env.example` and the README whenever configuration requirements
  change.
- Preserve `OWM_MOCK=1` as the deterministic, network-free end-to-end test path.
