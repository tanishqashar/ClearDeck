# Submission checklist and viva notes

## Before submission

- [ ] Review docs/TEST_RESULTS.md, including any unverified items.
- [ ] Back up your existing local database and .env privately before applying the source changes.
- [ ] Install dependencies from the root with npm ci. Keep the existing server/.env and database.
- [ ] Confirm startup on your own Windows machine: npm run server, then npm start.
- [ ] Run API/frontend tests and npm run build locally.
- [ ] Demonstrate registration/login/logout and expired authentication.
- [ ] Demonstrate create/rename/delete board and default columns.
- [ ] Demonstrate a second user joining by invitation and outsider denial.
- [ ] Demonstrate column add/rename/reorder, and blocked nonempty deletion.
- [ ] Demonstrate task details, assignment, comments, search/filter and saved movement after refresh.
- [ ] Keep demo credentials in README for fresh demo data; never publish personal credentials.
- [ ] Confirm schema.sql, seed.sql, ER diagram, API documentation, ordering explanation and screenshots are included.
- [ ] Review git diff and git status; ensure no configuration secrets or database files are staged.
- [ ] With your approval, create small meaningful commits, push to your existing repository and verify the submitted branch/link.
- [ ] Upload the required repository link and any files requested by your college's portal. No portal submission was performed here.

All checkboxes are intentionally left for the submitting student to confirm. Automated evidence is in TEST_RESULTS.md; these checkboxes do not imply checks failed.

## Applying the supplied source safely

The source-only ZIP excludes personal configuration, databases, dependencies and .git. Copy its changed source into your existing project, preserving your .git folder, server/.env and server/taskboard.db. Do not replace your whole working folder blindly. A complete Git patch is also supplied for tracked and new files from d73dd81. Run git apply --check before applying it. Use either the patch or the source copy, not both. If your current working tree already has other edits, compare them before merging.

## Explain during the viva

**Authentication:** Registration validates inputs and bcrypt-hashes passwords. Login compares the hash and signs a one-hour JWT. The browser sends it as a Bearer header. Every protected API verifies it; invalid/expired authentication returns 401. The shared client helper clears the session on 401, while permission failures keep the valid login.

**Authorization:** Logging in does not grant access to every board. Each board/task endpoint checks the owner or board membership. Owner-only operations check owner_id on the server. Comment deletion checks both current membership and the author's user ID. Hiding a UI button is only a usability aid.

**Relationships:** One user owns many boards. board_members connects users and boards many-to-many. A board has ordered columns and tasks. A task belongs to a column, has an optional member assignee, and has comments. SQLite foreign keys and cascading deletes protect relationships. Removing a board member clears that person's assignments in that board without deleting the task/history.

**Ordering:** Cards use consecutive integer positions inside each column. A move removes the card from the old list, inserts it into the destination list, and renumbers affected lists in one transaction. Reloading reads saved positions from SQLite. This prevents gaps/duplicate positions left by the old move algorithm.

**State and integration:** React components keep state with hooks. src/api.js sends requests and reports JSON errors. After a successful mutation, the board reloads its data into state without reloading the page. The editor stays open and preserves values if saving fails.

**Validation and XSS:** SQL placeholders bind data separately from SQL statements. React text nodes escape user content. Server validation checks string types, real calendar dates, priorities, assignee membership and target-column ownership. Client validation improves feedback but never replaces server checks.

**Testing:** API tests start a real Express server and a separate SQLite file. Browser tests use the production build with real HTTP requests and their own temporary database. Unit tests cover error paths difficult to trigger manually. Read the results to distinguish API timing from complete browser load timing.

**Scope decisions:** React is explicitly allowed. Column management remains owner-only because the role description reserves it to owners, although the endpoint table is inconsistent. Native drag/drop is implemented despite the final guideline describing it as optional. Activity logs and other optional stretch features were deferred to complete the MVP.
