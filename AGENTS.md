# WanderLog Agent Guide

This repository uses GSD planning artifacts under `.planning/`.

## Current Project

- Project context: `.planning/PROJECT.md`
- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- State: `.planning/STATE.md`
- Codebase map: `.planning/codebase/`
- Research: `.planning/research/`

## Standing Instructions

- Treat `.planning/codebase/*.md` as the current map of implemented source.
- Treat AI/SSE/PWA service worker diagrams as planned until matching source exists.
- Do not read or quote `.env` or secret-bearing files.
- Keep `.planning/**` and `.omx/**` as generated workflow artifacts, not app source.
- Preserve existing user changes in the dirty working tree.

## Verification

Before claiming implementation complete, run the smallest meaningful verification:

- For planning/doc-only work: verify expected files exist and run a secret scan.
- For source work: run focused tests first, then lint/typecheck/build as applicable.
- If full lint/typecheck fail due to existing unrelated issues, report the specific blockers.

## Current Next Step

Phase 1 is **Verification Foundation**. Use `$gsd-discuss-phase 1` or `$gsd-plan-phase 1` before implementation.

