# Permanent bug learnings

When a task exposes an error, frustrating bug, misleading assumption, failed
approach, or time-consuming rabbit hole, convert that experience into a
permanent repository rule before declaring the task complete.

## Required process

1. Record what failed or caused unnecessary investigation.
2. Identify the underlying cause rather than documenting only the symptom.
3. Write a concrete rule that states:
   - when the rule applies,
   - what action must be taken,
   - what must be verified before completion.
4. Save the rule in `.claude/rules/` using a descriptive kebab-case filename.
5. Update an existing rule when the lesson belongs to an established topic;
   avoid duplicate or contradictory rule files.
6. Do not create filler rules. When no meaningful lesson was learned, state that
   explicitly in the completion response.

## Learned from this task

When adding a process rule that requires a repository artifact, create the first
artifact in the same task. Do not document a mandatory workflow while leaving
its required directory or example absent.
