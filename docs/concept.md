# pdfdancer TypeScript Client – Developer Documentation Concept

This document defines a minimal, maintainable documentation approach focused on helping developers use the client library successfully. It intentionally excludes nice-to-haves for now.

## Scope and goals
- Enable developers to install, authenticate, and make their first successful call.
- Provide a small set of task-focused guides for common operations.
- Keep the API reference synced from source using TSDoc via TypeDoc (later; not in scope to implement now).

## Audience and supported environments
- Node.js (LTS), modern browsers. TypeScript-first; works with plain JS.

## Information architecture (slim)
- Overview (readme-level)
- Quickstart (install, auth, first call, save result)
- Guides (short, task-first)
  - Auth & configuration (env vars, token file)
  - Paragraphs: find/add
  - Pages: get/delete
- API Reference (auto-generated later)

## Authoring rules (minimal)
- One task per page; start with a runnable snippet.
- Use consistent imports from `pdfdancer-client-typescript`.
- Prefer Node-focused examples first; note browser differences only when needed.
- Keep snippets compileable with `tsc --noEmit`.

## Delivery plan (slim prototype)
- Create `docs/` with `concept.md` and `quickstart.md`.
- Use the repo `README.md` as the Overview for now.
- Track a short implementation checklist below.

## Implementation checklist (status)
- [x] Create `docs/` directory
- [x] Write this concept document
- [ ] Add `docs/quickstart.md` with install, auth, first call
- [ ] Add stub guide: Auth & configuration (`docs/guides/auth.md`)
- [ ] Decide hosting (README links for now)
- [ ] CI: ensure docs markdown compiles (later)

## Maintenance
- Update Quickstart whenever client initialization or auth changes.
- Keep examples in `docs/` runnable in CI later.
