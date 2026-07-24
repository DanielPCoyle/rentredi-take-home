# A symlinked node_modules can get committed and break the Docker build

## What broke (source of this rule)

To speed up `git worktree` setup, `node_modules` was created as a **symlink**
into a shared install (`ln -s .../node_modules "$WT/node_modules"`). A later
`git add -A` in that worktree **committed the symlink** (mode `120000`) because
`.gitignore` used `node_modules/` — a **trailing-slash pattern matches
directories only, not a symlink**. The commit merged to `main`; every subsequent
Railway build then failed at the image step:

```
[ERRO] copy / /app
Build Failed: cannot replace to directory .../app/node_modules with file
```

`npm ci` creates a real `node_modules` directory, and Docker cannot overlay the
committed `node_modules` symlink onto it. The build had passed on the commit just
before (no symlink tracked), so green history masked it — merges silently stopped
deploying and prod stayed on the older image (cf. `deploy-verification.md`).

## Required behavior

1. **`.gitignore` must ignore `node_modules` WITHOUT a trailing slash** (so it
   also matches a symlink), i.e. `node_modules` and `web/node_modules`, not
   `node_modules/`.
2. **Never `git add -A` / `git add .` in a worktree that has a `node_modules`
   (or `web/node_modules`) symlink.** Stage explicit paths
   (`git add src/... web/src/...`). Prefer symlinking only if `.gitignore` is
   already symlink-safe.
3. **Before committing in any worktree, run `git status --short` and reject any
   `node_modules` entry.** A `120000 blob node_modules` in `git ls-tree` or a
   staged `node_modules` is never correct.
4. **Recovery:** `git rm --cached node_modules` (keeps the working symlink),
   fix `.gitignore`, commit. Then verify a real Railway build **succeeds** and
   reaches a healthy running deployment — do not assume the merge deployed.

## Verify

`git ls-files | grep -E '(^|/)node_modules$'` must be empty, and
`git check-ignore node_modules` must report it ignored, before pushing.
