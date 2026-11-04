# Restore the stats wording once the app ships fractal_variability

MCP 1.9.0 shipped before the `infranodus-app` code that produces these fields.

## Why

- `fractal_variability` and `degree_distribution` come from the app branch
  `feat/fractal-variability` (e.g. commit `50737440`), which is not merged into
  the app's `master` or `feat/memory`.
- On production, `analyze_text_signature` returns incomplete results and the
  stats tools omit these fields. Nothing crashes.
- `src/instructions.ts` was softened to say the fields appear when the backend
  provides them, so models don't report stats that aren't there.

## Todo

- [ ] Merge and deploy `feat/fractal-variability` in `infranodus-app`. It
      branched in September, so check for conflicts and infrasonic dependencies.
- [ ] In `src/instructions.ts`, restore the firm wording for FRACTAL VARIABILITY,
      DEGREE DISTRIBUTION and TEXT SIGNATURE, and remove the TODO comment.
- [ ] Delete this file.

## Verification

Run `npm run test:live` with `INFRANODUS_API_BASE=https://infranodus.com/api/v1`.
`test/live/statsSurface.live.mjs` failed 18 of 18 on 2026-11-04 and should pass.
