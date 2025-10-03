# User Documentation Playbook – pdfdancer TypeScript Client

A practical, minimal system to create, publish, and maintain professional end-user documentation for the `pdfdancer-client-typescript` library.

## Objectives
- Make users successful quickly (install, auth, first call, key tasks).
- Keep docs accurate as API and SDK evolve with low overhead.
- Operate with simple, automatable workflows.

## Audience
- Developers using the TypeScript client in Node or browsers.

## Minimum viable stack (ship this first)
- Authoring: Markdown/MDX in-repo under `docs/`
- API Reference: TypeDoc from TSDoc in `src/` (generated into docs site)
- Site generator: Docusaurus (versioning, nice defaults)
- Hosting: GitHub Pages (or Vercel)
- Local preview: Docusaurus dev server

Out of scope for v0: search indices, analytics, feedback widgets.

## Information architecture (IA)
- Overview (positioning, supported runtimes, minimal example)
- Quickstart (install, auth, first call, save result)
- Guides (task-focused: auth/config, paragraphs, pages, images)
- Recipes (copy-paste snippets)
- API Reference (auto-generated from TSDoc)
- Versioning & migration (per major)
- FAQ and Troubleshooting
- Changelog (link to Releases)

## Authoring standards
- Source of truth: TSDoc in `src/` for types and signatures.
- Code examples must compile; prefer importing from `examples/` to avoid drift.
- Tone: task-first; short intro → code → what happened → next steps.
- Formatting: Prettier for MD/MDX; markdownlint in CI.

## Examples management
- Put runnable examples in `examples/` (Node and Browser variants if needed).
- Test examples in CI (compile, and run Node ones).
- Import examples into MDX pages (later) so docs always show real code.

## API Reference generation
- Add `typedoc.json` and TSDoc comments in `src/`.
- Generate docs via TypeDoc and integrate with Docusaurus TypeDoc plugin.

## Workflows
- Local: `npm run docs:dev` to preview the site.
- PRs: If `src/` or `docs/` changes, build docs in CI and fail on errors.
- Releases: On tag/release, regenerate API docs and publish the site.

## Versioning policy
- Maintain “Next” (from `main`) and versioned docs per semver major (e.g., 2.x).
- Each major includes a migration guide; link from release notes and affected pages.

## Publishing (GitHub Pages baseline)
- CI pipeline:
  - Install deps
  - Generate API docs (TypeDoc)
  - Build Docusaurus site
  - Upload artifact and deploy to Pages

## Quality gates
- Docs build must pass on PRs
- Broken links fail the build
- markdownlint for MD/MDX
- TypeDoc warnings treated as errors
- Example compile/run checks (Node)

## Governance
- Doc owner(s): assign maintainers in CODEOWNERS for `docs/**` and `src/**`.
- Review: technical reviewer for API accuracy + docs reviewer for clarity.

## Maintenance cadence
- On every release: regen API docs, verify examples, publish site.
- Quarterly sweep: update Quickstart and prune obsolete guides.

## Migration & deprecation
- Add per-major migration docs; annotate breaking API in reference pages.

---

## Minimal implementation plan (status)
- [ ] Add Docusaurus in `docs/` (preset-classic)
- [ ] Add TypeDoc + Docusaurus TypeDoc plugin
- [ ] Add `typedoc.json` with `src/index.ts` as entry
- [ ] Add Quickstart, one Guide, and wire API Reference page
- [ ] Add CI workflow: build docs on PRs; deploy on release/main
- [ ] Add `examples/` and a job that compiles/runs them
- [ ] Create “Next” docs; prepare versioning on first major bump

## For now (temporary prototype)
You can preview this playbook via the simple viewer:
- Run: `npm run docs:preview`
- Open: `http://localhost:5173`

When ready, replace this viewer with Docusaurus and the TypeDoc integration per plan above.
