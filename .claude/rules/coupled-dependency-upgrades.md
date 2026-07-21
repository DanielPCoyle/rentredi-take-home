# Coupled dependency upgrades

When related packages enforce peer-version compatibility, do not merge their major-version Dependabot PRs independently.

- Upgrade React and ReactDOM together.
- Upgrade Vite and `@vitejs/plugin-react` together; include other Vite plugins when their peer ranges require it.
- Upgrade Vitest and `@vitest/coverage-v8` together.
- Treat `npm ci` peer-resolution failures as a dependency grouping problem before changing application code.
- Configure Dependabot groups for coupled packages so generated PRs contain a coherent, installable dependency set.
- Verify the grouped update with CI, production build, Playwright, Lighthouse, CodeQL, and dependency review before merging.
