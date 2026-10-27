# TaskBoard requirement checklist

Source of truth: supplied Project2 Kanban Task Management Scope. The scanned audit is secondary. Initial state refers to GitHub master d73dd81, also matching the uploaded task_management(1).zip source except whitespace. Statuses below distinguish code inspection from execution. See TEST_RESULTS.md for final observed evidence.

| Requirement | Initial state | Final status and evidence |
|---|---|---|
| AUTH-1 Register unique name/email/password | Broken: form never called API | Working and verified — API and frontend tests passed; browser test passed |
| AUTH-2 bcrypt password storage | Implemented but unverified | Working and verified — hash comparison API test |
| AUTH-3 Login returns JWT for API calls | Implemented but unverified | Working and verified — API login and protected requests |
| AUTH-4 Return unauthenticated users to login | Broken for expired sessions | Working and verified — Frontend/API tests passed; browser test passed |
| AUTH-5 Logout clears token | Implemented but unverified | Working and verified — Shared clearSession; browser test passed |
| BRD-1 List owned and joined boards | Implemented but unverified | Working and verified — API authorization tested; browser test passed |
| BRD-2 Create name/description and 3 columns | Partial: description input missing | Working and verified — API transaction and browser creation |
| BRD-3 Owner rename/delete with cascade | Implemented but unverified | Working and verified — API permission and cascade tests |
| BRD-4 Owner adds/removes existing members | Backend only | Working and verified — API permission tests; browser invite |
| BRD-5 Member initials in header P2 | Missing | Working and verified — Implemented; screenshot/browser test passed |
| BRD-6 Dashboard task counts P3 | Missing | Working and verified — Implemented via count query and dashboard display |
| COL-1 Horizontal columns in saved order | Partial: mobile stacked | Working and verified — Implemented horizontal overflow; API order tested |
| COL-2 Add/rename columns | Backend only | Working and verified — API tested; browser test passed |
| COL-3 Confirm delete; block nonempty column | Backend only | Working and verified — API blocks nonempty columns; browser test passed |
| COL-4 Reorder columns P2 | Backend; duplicate dead route | Working and verified — Duplicate removed; API tested; browser test passed |
| COL-5 Column task count P3 | Missing | Working and verified — Implemented; count includes hidden filtered tasks |
| TSK-1 Quick add at bottom of column | Wrong UI location | Working and verified — Implemented; browser test passed |
| TSK-2 Detail modal edits all fields, member assignee | Broken API field mapping | Working and verified — all fields persist in API test; editor failure unit test |
| TSK-3 Confirm task deletion | Missing confirmation | Working and verified — Implemented; browser test passed |
| TSK-4 Drag/drop within and across columns persisted | Missing UI; defective API positions | Working and verified — API ordering tests passed; browser test passed |
| TSK-5 Colored priority labels | Missing | Working and verified — Implemented MUI Chips, visible priority text |
| TSK-6 Overdue red unless last column P2 | Missing | Working and verified — Implemented using local calendar date; browser test passed |
| TSK-7 Assignee initials P2 | Missing | Working and verified — Implemented with name and initials |
| TSK-8 Accessible Move to control P3 | Missing | Working and verified — Implemented native select; browser test passed |
| CMT-1 Add/view comments author/time | Backend only | Working and verified — API tested; browser test passed |
| CMT-2 Delete own comments only P2 | Backend only | Working and verified — server rejects other authors |
| SRC-1 Search title and description | Partial: title only UI | Working and verified — Both fields in frontend and combined API; API tested |
| SRC-2 Priority and assignee/My tasks P2 | Backend only | Working and verified — Implemented filters combine; browser test passed |
| ACT-1 Activity log P3 | Missing | Missing — deliberately deferred optional activity history |
| Bcrypt/JWT, parameterized SQL, membership checks | Implemented but unverified | Working and verified — Password, unauthorized role and outsider tests passed |
| React escapes user text against XSS | Implemented but unverified | Working and verified — React text nodes retained; browser injection test passed |
| SQLite FKs/cascades/transactional moves | Partial: move used transaction but wrong ordering | Working and verified — foreign_key_check, cascade and contiguous positions tests |
| No full page reload on CRUD/move | Implemented but unverified | Working and verified — React state refreshed from API; browser tests cover interactive operations |
| 100-task board under 2 seconds locally | Unverified | Working and verified — API and browser timed; browser results 207–245 ms for 100+ tasks in this environment |
| Shared API helper and reusable functions | Missing helper | Working and verified — src/api.js and server/ordering.js added |
| Validation/error handling | Partial | Working and verified — Types, actual date validation, JSON errors, inline alerts, editor retains failed saves |
| Responsive horizontal board, empty states, drop highlight | Partial | Working and verified — Implemented; browser screenshots/overflow check |
| Git source with meaningful commits | Existing history | Implemented but unverified — Existing history preserved; new commits/push await owner approval |
| schema.sql | Present | Working and verified — Preserved unchanged; six related tables |
| seed.sql: 2 users, 1 board, 3 columns, >=8 tasks | Missing | Working and verified — guarded seed test, exact counts and no overwrite |
| ER diagram | Missing | Working and verified — docs/ER_DIAGRAM.md and SVG |
| README overview/setup/credentials/API/screenshots | Boilerplate | Working and verified — Replaced with project-specific README |
| API docs or Postman collection | Missing | Working and verified — docs/API.md (documentation alternative allowed) |
| Task ordering explanation | Missing | Working and verified — docs/ORDERING.md |
| Submission checklist | Missing | Working and verified — docs/SUBMISSION_CHECKLIST.md |
| Optional stretch features | Missing | Not applicable to MVP: WebSockets, labels, checklists, activity log, dark mode, deployment deferred |
| Out-of-scope extras | Not built | Not applicable — attachments, email/integrations, sprints/epics, time tracking, billing, mobile app |

## Specification ambiguities

The scope explicitly permits React. It labels TSK-4 drag/drop P1, though the final guideline calls drag/drop optional; the implementation includes native HTML5 drag/drop. The role definition gives column management to the owner, while the endpoint table says Member/Owner for add/rename. Existing owner-only column permissions are retained, documented and tested; the evaluator should confirm that interpretation.

## Audit corrections

The audit's critical registration and task-field issues were confirmed in source. A transaction around the old move algorithm did not guarantee correct positions; new tasks used 0 and moves left gaps. The root manifest already contained most backend dependencies, but Express was missing. Raw HTML inputs do not by themselves imply an XSS defect; React already escapes text nodes. No claims about the uploaded personal database's task counts are made, since it was not opened.
