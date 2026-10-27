# Changes by group

## Authentication and task editing

Fixed frontend registration so it creates a backend user before returning to login. Login and registration report errors inline and support Enter. App initialization tolerates corrupt saved-user JSON. The shared API helper centralizes the URL/JSON handling, sends JWT headers and clears invalid/expired sessions on 401. The backend returns 401 for expired/invalid JWTs, validates registration types/email/password limits, loads server/.env consistently and supports DB_PATH for isolated tests.

Changed: src/Register.js, src/Login.js, src/App.js, src/api.js, src/Task.js, server/auth.js, server/middleware.js, server/db.js, server/server.js, package.json, package-lock.json, server/package.json, .gitignore, configuration examples, src/App.test.js and src/Task.test.js. Tests: 3 frontend tests and initial API auth/edit checks passed. Express was the missing runtime dependency; Playwright was added as a development dependency for repeatable browser verification.

Task.js retains the task component and now provides a MUI detail dialog. It uses snake_case API field names and numeric IDs, resolves member assignees, and only closes after a successful save. A failed save leaves values visible. Original React/MUI architecture and backend routes remain.

## Required board workflows and data integrity

Connected owner column management, member invitation/removal, task comments, priority/assignee search controls, quick-add, colored priorities, overdue state, initials, counts, native drag/drop and fallback movement. Reused existing APIs; added assignment resource URL adapters rather than duplicating the main mutation logic. Added server validation for types/calendar dates and combined search/filter, removed the unreachable duplicate column route and corrected task ordering in one shared transactional helper. Removing membership unassigns that user's tasks without deleting tasks or comments.

Changed: src/Board.js, src/BoardList.js, src/Column.js, src/Task.js, server/boards.js, server/ordering.js, server/resources.js, server/server.js and tests/api.test.cjs. Tests: 7 API integration tests passed; complete real-browser run passed. No schema change or data-reset migration was made.

## Documentation and demo data

Replaced the CRA README with setup, usage, sample credentials, screenshots and documentation links. Added a guarded seed script, seed SQL, ER diagram (SVG and editable Mermaid), API documentation, ordering explanation, initial/final requirement checklist, test evidence, submission checklist and viva notes. Seed tests verify exact counts and byte-preserving refusal on an existing database.

Changed: README.md, server/seed.js, server/seed.sql, docs/* and docs/screenshots/*. Tests: seed and foreign-key checks passed; source documentation links and packaging checked. No sample data was inserted into your real database.

## UI corrections after functional verification

Fixed mobile member wrapping, native-select label overlap and keyboard submission on authentication forms. Kept the existing MUI styling, adding task cards/dialogs, inline alerts, focus outlines, horizontal board scroll and clear empty/drop states.

Changed: src/index.css, public/index.html and the existing UI components. Tests: rebuilt successfully, frontend tests passed, final browser run passed at desktop and 390px mobile width. Screenshots use synthetic data and were visually inspected.

## Still requires the student

Apply/review changes, confirm startup with your own private configuration and existing database, run the local checklist, approve meaningful commits/push and submit through the college portal. Optional activity history/stretch features remain out of scope for this sprint. Windows and the personal dataset were not directly tested.
