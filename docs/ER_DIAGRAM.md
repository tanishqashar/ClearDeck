# Entity relationship diagram

![TaskBoard database relationships](ER_DIAGRAM.svg)

```mermaid
erDiagram
    USERS ||--o{ BOARDS : owns
    USERS ||--o{ BOARD_MEMBERS : joins
    BOARDS ||--o{ BOARD_MEMBERS : includes
    BOARDS ||--o{ COLUMNS : contains
    BOARDS ||--o{ TASKS : contains
    COLUMNS ||--o{ TASKS : orders
    USERS o|--o{ TASKS : assigned
    USERS ||--o{ TASKS : creates
    TASKS ||--o{ COMMENTS : has
    USERS ||--o{ COMMENTS : writes
    USERS {
        integer id PK
        text name
        text email UK
        text password_hash
        text created_at
    }
    BOARDS {
        integer id PK
        text name
        text description
        integer owner_id FK
        text created_at
    }
    BOARD_MEMBERS {
        integer id PK
        integer board_id FK
        integer user_id FK
        text role
    }
    COLUMNS {
        integer id PK
        integer board_id FK
        text name
        integer position
    }
    TASKS {
        integer id PK
        integer board_id FK
        integer column_id FK
        text title
        text description
        text priority
        text due_date
        integer assignee_id FK
        integer created_by FK
        integer position
        text created_at
        text updated_at
    }
    COMMENTS {
        integer id PK
        integer task_id FK
        integer user_id FK
        text content
        text created_at
    }
```

board_members has a unique (board_id, user_id) pair. An owner is also inserted as an owner member when creating a board. Tasks may be unassigned. Foreign-key deletes cascade from boards through columns/tasks/comments and board membership; deleting an assignee user sets the assignment to NULL. The API enforces that a task's column and assignee belong to the same board. Removing membership clears that board's assignments for the removed user.
