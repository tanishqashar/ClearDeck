# TaskBoard API

Base URL: `http://localhost:5000/api`. Requests and responses use JSON. Protected requests send `Authorization: Bearer <token>`; obtain a real token from login. Never put tokens or real passwords in committed documentation.

Registration: `POST /auth/register` with `{ "name": "Student", "email": "student@example.test", "password": "choose-a-local-password" }`. Returns 201 and userId; registration does not log the user in. Login: `POST /auth/login` with email/password returns 200, token and user (id, name, email). JWT lifetime is one hour. Logout clears browser storage; this MVP does not implement server-side token revocation.

## Assignment routes

All paths below are relative to `/api`. For task updates, send all editable fields; omitted due date/assignee clear those fields. IDs and positions in JSON must be numbers. Position is a nonnegative final index; a larger task position appends.

| Method | Path | Body or query | Access |
|---|---|---|---|
| GET | /boards | none | Logged in: only owned/joined boards, with task_count |
| POST | /boards | name, optional description | Logged in; returns boardId and creates default columns |
| GET | /boards/:id | none | Member/owner; returns board, columns, tasks |
| PUT | /boards/:id | name, optional description | Owner |
| DELETE | /boards/:id | none | Owner; cascades children |
| GET | /boards/:id/members | none | Member/owner; id/name/email/role |
| POST | /boards/:id/members | email of existing registered user | Owner |
| DELETE | /boards/:id/members/:userId | none | Owner; cannot remove self; clears removed user's task assignments |
| POST | /boards/:id/columns | name | Owner (see permission interpretation below) |
| PUT | /columns/:id | name OR position | Owner |
| DELETE | /columns/:id | none | Owner; 400 if tasks exist |
| POST | /columns/:id/tasks | title; optional description/priority/due_date/assignee_id | Member/owner; appends |
| GET | /tasks/:id | none | Member/owner; task fields and comments |
| PUT | /tasks/:id | title, description, priority, due_date, assignee_id, column_id | Member/owner |
| PATCH | /tasks/:id/move | columnId, position | Member/owner; target column must belong to same board |
| DELETE | /tasks/:id | none | Member/owner |
| GET | /boards/:id/tasks | q, priority, assignee query params, combinable | Member/owner |
| POST | /tasks/:id/comments | content | Member/owner |
| DELETE | /comments/:id | none | Comment author or board owner, with current board access |

`priority`: Low, Medium or High. `due_date`: today or a future valid YYYY-MM-DD, or null. `assignee_id`: current board member ID or null. Unassigned is represented by null, not an empty ID. Empty task title, past/invalid dates, invalid types, unknown priority, invalid IDs/positions, and foreign-board columns are rejected. Tasks in the final ordered column cannot be edited or moved, but can be deleted.

## Existing board-scoped routes retained

The frontend keeps the existing route structure, which remains supported alongside the assignment resource routes:

| Method | Path | Notes |
|---|---|---|
| POST | /boards/:id/tasks | Same task fields, including column_id |
| PUT / DELETE | /boards/:id/tasks/:taskId | Update/delete |
| PUT | /boards/:id/tasks/:taskId/move | column_id, position |
| PUT / DELETE | /boards/:id/columns/:columnId | Rename/delete |
| PUT | /boards/:id/columns/reorder | columnIds: full ordered array, each ID once |
| GET | /boards/:id/tasks/search?q= | Title/description keyword |
| GET | /boards/:id/tasks/filter?priority=&assignee_id=&mine=true | Combinable filters |
| GET / POST | /boards/:id/tasks/:taskId/comments | List/add comments |
| DELETE | /boards/:id/tasks/:taskId/comments/:commentId | Delete own comment or any comment as board owner |

## Status and permission rules

200: success. 201: created. 400: invalid input or nonempty column deletion. 401: missing, invalid or expired authentication. 404: resource unavailable, not found, or hidden from a non-member/non-owner. 409: duplicate email or duplicate board member. 500: unexpected server error. Errors are JSON `{ "error": "message" }`.

The role table gives column management to owners, whereas the endpoint table allows members for add/rename. TaskBoard preserves owner-only column management from the existing project. Members can create/edit/delete/move tasks and add comments, but cannot rename/delete boards, change columns or manage membership. The server enforces these permissions independently of hidden UI buttons.

Foreign keys protect relationships, and application checks ensure board/column/assignee consistency. Removing a member preserves their historical comments. The author loses access after removal, so cannot delete comments until invited again. Passwords use bcrypt and SQL uses bound parameters.

## Quick manual verification

1. Register three users: owner, member and outsider. Login each separately in Postman.
2. Create a board as owner; check three default columns and positions 0,1,2.
3. Confirm outsider receives 404 for board/task/comment reads and mutations.
4. Invite member; verify the board appears in their dashboard. Member can edit tasks but cannot delete the board.
5. Create cards, move within/across columns, refresh and check contiguous positions.
6. Add a comment as member. The member can delete it, and the board owner can also delete it; another regular member cannot delete it.
7. Remove member; their next board request is denied and assignments become null.
8. Use an invalid/expired token; expect 401 and frontend return to login.

Automated versions live in `tests/api.test.cjs`. They create a temporary database and never use `server/taskboard.db`.
