# AGENTS.md

Conventions for anyone — human or coding agent — changing this repository.

This file is the normative source for how commits, pull requests and issues
are written here. `CLAUDE.md` imports it, so Claude Code reads the same rules.

## Repository map

| Path              | What it is                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| `apps/web`        | Next.js 15 App Router frontend, Clerk auth, TanStack Query                |
| `apps/api`        | Hono REST API — Clerk JWT verification, Prisma, transactional money flows |
| `packages/shared` | Pure domain math and Zod schemas, imported by both apps                   |

TypeScript source files and React components are named in `snake_case`. Match
the surrounding file rather than introducing a second convention.

## Commands

```bash
pnpm dev               # api :8787 + web :3000
pnpm typecheck
pnpm test              # DB-free: shared math + api pure modules
pnpm test:integration  # needs Postgres on :5433
pnpm format            # Prettier, writes
pnpm format:check      # Prettier, verifies — this is what CI runs
```

**Run `pnpm format` before every commit.** `format:check` is a step in the
`verify` job, so an unformatted file fails the build. Prettier owns `.md` and
`.yml` as well as TypeScript.

A new `apps/api` test belongs in `test/unit/` if it needs no database, or
directly in `test/` if it does. The integration config's glob is deliberately
non-recursive, so a test in any other subdirectory is run by neither config.

## Branches

Branch from `develop` and target `develop`. `main` is release-only and changes
only through a `develop → main` release pull request.

Branch names are `<type>/<short-kebab-description>`, where `<type>` is the
Conventional Commits type of the work: `feat`, `fix`, `chore`, `test`, `ci`,
`docs`, `refactor`, `perf`, `build`. Release branches are date-stamped, e.g.
`release/2026-07-30`.

One pull request is one logical change. Stage explicitly with
`git add <paths>` — never `git add -A`.

## Commit messages

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
The subject is lowercase and imperative, with an optional scope of `web`, `api`
or `shared`:

```text
docs: write down the branching model and both environments
feat(api): reject a token minted for another Clerk application
```

The body is where this repo differs from most. It argues. Structure it as:

1. The problem, stated first. What was wrong or missing before this commit.
2. What changed.
3. A bulleted list under `Details that are deliberate rather than incidental:`
   covering decisions a reader might otherwise mistake for accidents.
4. A closing paragraph beginning `Verified:` that states what you actually ran
   and what it reported. Not what you intended to run.

Never add `Co-Authored-By` trailers, "Generated with" footers, or any other AI
attribution. The repository owner authors their own history.

## Pull requests

The title is identical to the commit subject.

`.github/pull_request_template.md` prefills the body in the browser.
**`gh pr create --body` bypasses the template entirely**, so when filing
headlessly, reproduce this skeleton exactly:

````markdown
#### What type of PR is this?

#### What this PR does / why we need it

#### Which issue(s) this PR fixes

Fixes #

#### Special notes for your reviewer

#### Test plan

#### Does this PR introduce a user-facing change?

```release-note
NONE
```
````

The test plan lists commands you actually ran, with their results — not
commands you intend to run. `verify` and `integration` are both required
checks, and neither has `paths:` filters, so every pull request runs the full
suite including Postgres.

Never merge. Open the pull request and hand back the URL.

## Issues

Four forms live in `.github/ISSUE_TEMPLATE/`. Every field renders as a stable
`### Label` heading, which is what makes `gh issue view <n> --json body`
deterministically parseable.

`gh issue create --body` also bypasses the forms, so reproduce the right
skeleton and apply the label by hand with `--label`:

| Form            | Label            | `###` headings, in order                                                                             |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| Bug report      | `type/bug`       | Area · Summary · Steps to reproduce · Expected behaviour · Actual behaviour · Environment · Evidence |
| Feature request | `type/feature`   | Area · Problem · Proposal · Alternatives considered · Done when                                      |
| Tech debt       | `type/tech-debt` | Area · Current state · Why it hurts · Proposed change · Blast radius                                 |
| Docs            | `type/docs`      | Location · Problem · Details                                                                         |

`Area` is one of `web`, `api`, `shared`, `infra`, `docs`. `Environment` is one
of `local`, `staging`, `production`. `Blast radius` is one of `none`,
`staging only`, `production`.

An `area/*` label may be added alongside the `type/*` label.

## Scratch space

`.claude/` is gitignored. Planning documents and scratch files belong in
`.claude/plans/`, never in the tracked tree — anything tracked is
Prettier-checked in CI.
