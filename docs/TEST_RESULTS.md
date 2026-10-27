# Verification results

Validation date: 27 October 2026. Base: master d73dd81b33ce3f87ceb03edb1d7941b7b1aa07bc. This file combines historical Linux/headless-Chromium evidence with the latest Windows/system-Chrome verification shown below. This is observed test evidence, not a guarantee for every device or dataset.

## Latest audit results

These are the results from the latest verification of the current repair workspace. The browser run used system Google Chrome, a temporary SQLite database, dynamically assigned local ports, and an isolated temporary screenshot directory.

| Check | Observed result |
|---|---|
| `npm.cmd run test:api` | 7 tests passed, 0 failed |
| `npm.cmd test -- --watchAll=false --runInBand` | 3 suites passed, 18 tests passed, 0 failed |
| `npm.cmd run build` | Successful production build |
| Isolated browser integration test | Passed; zero uncaught page errors |
| 100+ task browser rendering | 746.8 ms from opening the board to rendered task cards; below the 2,000 ms requirement |

The browser test also covered registration, login, board creation, member invitation, quick-add, task editing and persistence, comments, filtering, drag/drop, Move to fallback, column management, mobile overflow, deletion, XSS-safe text rendering, board/member permissions, logout and expired-session handling. The expired-session check intentionally produced a 401 response and passed.

The browser result was run through an isolated temporary copy of `tests/browser.cjs` so existing documentation screenshots were not overwritten. The managed Playwright Chromium binary was not used; the run selected the installed system Chrome through `CHROMIUM_EXECUTABLE`.

## Historical results

The following results were recorded during an earlier validation run and are not browser-test results from the latest audit:

| Check | Historical observed result |
|---|---|
| Backend JavaScript syntax | Passed |
| Real Chromium frontend/API/database run | Passed; zero uncaught page errors |
| 100+ tasks, click Open to rendered cards | 207 ms and 244.7 ms on two complete passing runs; below 2 seconds locally |
| 100-task board API response | About 2 ms in clean-install retest; separate from browser rendering |
| Mobile 390 x 844 | Passed: document does not overflow horizontally; board scroll stays internal |
| Clean installation in an independent directory | Passed with environment-specific Node-header workaround below; API/frontend tests and build also passed there |
| Seed and data integrity | Exact 2 users, 1 board, 3 columns, 8 tasks; foreign_key_check empty; refuses and byte-preserves an existing demo DB |
| Screenshots and ER SVG | Generated from synthetic data and visually inspected |
| Git patch / archive checks | See packaging verification at the end of this file |

## What the API tests cover

1. Register three users; normalize email, reject duplicates/invalid registration, compare stored bcrypt hash, login, wrong password, missing token and expired JWT.
2. Create a board with three columns, block outsider access, invite member, persist every editable task field, and reject member board deletion.
3. Append tasks; reorder toward the start and end; move across columns; reject invalid target without changing order; move through the editor; compact after deletion; verify foreign keys.
4. Comment author/name/time and author-only deletion; title/description search; priority/My tasks filtering; invalid assignee/date; owner-only columns; rename/reorder/delete columns; invalid reorder set; nonempty column protection; outsider read/write denial; owner self-removal rejection; remove member and clear assignments.
5. Read 100+ tasks, reject malformed JSON/wrong types, rename/delete board and verify cascading child deletion.
6. Assignment-style resource URLs for task details/edit/move/delete, comments, columns and combined search/filter, retaining membership checks.
7. Demo seed exact counts and refusal to overwrite an existing file, with byte comparison proving the guard did not modify it.

## What the historical browser run covered

Production React frontend uses real Fetch requests to Express with a new temporary SQLite database. It registers two users, logs in, creates a board/description, invites a member, quick-adds tasks, edits title/description/priority/date/assignee, reopens the board after refresh to verify persistence, adds/deletes a comment, combines search/priority/assignee filters, drags within and across columns, reopens to check saved order, uses the Move to fallback, creates/renames/reorders/deletes a column, checks mobile overflow, cancels/confirms task deletion, times a board with over 100 tasks, verifies HTML-like task titles render as text, renames/deletes a board, tests logout and joined-member UI permissions, removes a member and confirms lost API access, and returns to login on an expired token.

The expired-token scenario intentionally produces a 401 response. That expected rejection is not a test failure. Refresh currently returns to the dashboard; reopening the board verifies persisted content and ordering. Remembering the selected board URL was not added.

## Failures encountered and resolved

- The original register form never sent a request. Unit, API and browser tests now confirm the real registration path.
- The original editor used the wrong API field names and closed before success. Tests now prove persistence and that a rejected save retains the editor.
- The original move route used a transaction but left incorrect positions. Integer renumbering tests now pass.
- A browser test found member chips forcing document-wide horizontal overflow at 390px. Explicit flex wrapping fixed it. Native select labels also overlapped when their value was empty; always-shrunk labels fixed that visual issue.
- Early browser checks used exact required-field labels and incorrectly expected the selected board to survive a page reload. The test selectors and reopen step were corrected; no product behavior was altered to conceal those test mistakes.
- Restored ZIP dependency scripts lacked Linux execute permission. Only ignored dependency permissions were corrected.
- A native rebuild and the first clean npm ci failed because this host rejected ownership changes while extracting Node headers (EINVAL fchown). Downloading the exact same Node 24.22.1 headers without ownership changes and pointing npm_config_nodedir to that temporary directory allowed an independent npm ci to succeed. Final clean API tests, frontend tests and build passed. No dependency versions were changed for this workaround.
- Playwright's normal browser download returned truncated archives. A Chromium binary supplied through a separate temporary npm package was used instead; its archive was extracted without ownership changes. The successful browser runs set CHROMIUM_EXECUTABLE to that temporary binary. The project's standard browser script defaults to normal Playwright Chromium.

## Remaining limits and manual actions

- The uploaded personal SQLite database and .env contents were never opened, copied into the source checkout or modified. Compatibility with that specific existing dataset is not directly tested; schema.sql remains unchanged and no destructive migration is present.
- Your actual Windows machine, college portal, and other browsers were not tested. Run setup and the smoke checklist locally before submission.
- Column-management permissions preserve the role table's owner-only rule. The assignment endpoint table conflicts on add/rename; this interpretation is disclosed in API.md and REQUIREMENTS.md.
- Activity history (ACT-1, P3), labels, checklists, dark mode, real-time updates and deployment remain unimplemented optional features.
- JWT logout is local; no server-side token-revocation list. Filtering is client-side in the board UI, with equivalent protected backend search/filter endpoints available.
- No commit, push, deployment or portal submission was performed. Review and approve your own Git changes.
- Dependency deprecation warnings from the existing Create React App toolchain remain. No broad toolchain upgrade or dependency security certification was attempted in this sprint.

## Packaging verification

Passed: the final complete patch applied to a clean export of the original master commit and reproduced every delivered source byte. The ZIP passed CRC integrity and file-exclusion checks for secrets, personal databases, dependencies and Git internals. The original history and upload archive stay untouched. The separate HOW_TO_APPLY.md explains how to keep your local configuration and data.
