# Issue reproduction screenshots

Out-of-band asset branch. It hosts the screenshot evidence embedded in the
reproduction comments on issues #16–#36, plus each reproduction's notes and
API state snapshots. It is not part of the application and must never be
merged into `develop` or `main`.

Every reproduction ran against `develop` @ 06cccf6 on a local dev stack
(Next.js web + Hono API + Postgres demo database), signed in as the
`+clerk_test` smoke account, on 2026-08-02. Each `issue-<n>/` directory
contains the screenshots referenced by that issue's comment, a `notes.md`
with the exact steps executed and the expected-vs-observed computation, and
where useful the raw `/me/state` JSON captured at the moment of the
screenshot.
