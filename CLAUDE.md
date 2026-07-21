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
