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

## Project tracking — SimplerDevelopment MCP (real-time)

Track all work in the SimplerDevelopment portal via the
`mcp__claude_ai_Simpler_Development__*` tools, **in real time** — the board is the
source of truth for what's in flight, not an after-the-fact record. Keep it live
as you work; if you'd mention it in a standup (started something, made a call,
hit a blocker, shipped something), reflect it on the board as it happens.

### This project's coordinates (client SimplerDevelopment, id 104)

- Project: **RentRedi User Manager — Take-Home Assessment** — `projectId: 206`
- Active sprint: **RentRedi Initial Assessment** — `sprintId: 29`
- Columns: Backlog `886` · To Do `887` · In Progress `888` · In Review `889` · Shipped `890`
- Labels: Backend `69` · Frontend `70` · CI/CD `71` · Bug Fix `72` · Feature `73` · Infra `74`
- Epics: Core app `940` · Frontend `941` · CI/CD `942` · Prod incident `943` · Feature restoration `944`

### Workflow

1. **Before starting** a unit of work, create a card (`kanban_create_card`) in
   **To Do** on the active sprint (`sprintId: 29`), with the right `cardType`
   (task / story / bug / spike / epic), a `parentCardId` if it belongs under an
   epic, and `storyPoints`. Create the card first so nothing is untracked.
2. **On pickup**, `kanban_move_card` to **In Progress** and set
   `workflowState: in_progress`.
3. **Record decisions as you make them** with `kanban_card_add_comment` —
   trade-offs, why you chose one approach over another, gotchas found. Decisions
   belong on the card, not only in commit messages.
4. **When it's open for review/verification** (PR up, awaiting QA), move to
   **In Review** (`workflowState: in_review`).
5. **When merged + deployed + verified**, move to **Shipped**
   (`workflowState: done`).
6. Keep sprints (`sprints_create`) and epics reflecting reality, so
   `kanban_list_board` always shows the true state.

### Use the wider toolset when it fits

The SD MCP is more than a kanban: decision records (`brain_decisions_*`), a
knowledge base / docs (`brain_documents_*`, `brain_create_note`), CRM, projects,
and proposals are all available. Prefer a durable portal artifact (a decision
record, a document) over an ad-hoc local file when the work warrants something
the team can see. Run `whoami` / `projects_list` if the coordinates above ever
drift.

## Document drift — check on every merge to `main`

Docs rot silently: the code changes and the README / ADRs / knowledge base keep
describing the old behavior. **Every merge into `main` must include a document-
drift check** — the docs are part of the change, not an afterthought.

### When (the trigger)

Before any PR merges to `main` (and before calling a change "done"), ask: does
this change make any existing prose inaccurate? Treat these as automatic drift
triggers:

- **Dependency swap / removal** — e.g. reactfire → `firebase/database` `onValue`.
  Grep the docs for the old library/name.
- **Feature added / removed / renamed** — e.g. the single-input autocomplete
  replacing separate ZIP + country inputs.
- **New / changed / removed API endpoint** — e.g. `GET /api/locations/suggest`
  must appear in the README's endpoint table.
- **Changed data shape, request body, or env var** — update the README tables
  and `.env.example`.
- **Changed deploy target, URL, provider, or config** — README live-demo link,
  Railway/Firebase notes.
- **A superseded decision** — the relevant ADR must be updated or marked
  `Superseded`, not left `Accepted` describing the old approach.

### What to check (scope)

`README.md`, everything under `knowledge-base/` (ADRs, `Architecture/` incl. the
System Map mermaid, `Concepts/`, `Meta/Glossary`), `.env.example`, load-bearing
code comments, and the SimplerDevelopment board/ADR tickets. A fast sweep:
`git diff --name-only origin/main...HEAD` to see what changed, then grep the docs
for any removed symbol/feature/endpoint/env name.

### Required action

- **Fix drift in the same PR** whenever practical — the doc edit ships with the
  code edit.
- **If a full doc rewrite is out of scope**, do the minimum truthful fix (a
  one-line "superseded: now uses X" note on the ADR + a tracking ticket on the
  board under the Production-readiness / docs backlog). Never leave a doc
  confidently describing behavior that no longer exists.
- When an ADR's *decision* still holds but its *implementation detail* changed,
  keep the ADR `Accepted` and add a short "Implementation note (superseded): …"
  rather than rewriting the rationale.

### Verify before completion

State, in the completion summary, either "no doc drift" or the exact docs you
updated. Do not report a merge complete without having run the drift check.

> Known standing debt (2026-07-24): the ReactFire → `firebase/database` swap left
> ~15 doc references stale (README + most of `knowledge-base/`, incl. ADR-0006);
> the create-form is now an autocomplete but docs still say "ZIP + country";
> `GET /api/locations/suggest` is undocumented; and ADR-0012 (Sentry) exists only
> on the `archive/local-sandbox-history` branch. Clear these when touching the
> relevant areas.
