CLEARDECK
A collaborative Kanban task management application built with React, Node.js, Express, and SQLite.

ClearDeck helps users organize work into boards, columns, and tasks, with support for task assignments, due dates, priorities, comments, search, and filtering.

Project note: This README is stored in docs/README.md. Commands below should be run from the project root, not from the docs directory.

!! IF THE FOLLOWING IMAGES CANNOT BE PREVIEWED- YOU CAN ACCESS THEM IN doc -> screenshots !!
| Screen | Preview |
|---|---|
| Login | [TaskBoard Login Page](screenshots/LoginPage.png) |
| Dashboard | [ClearDeck dashboard](screenshots/Dashboard.png) |
| Boards | [ClearDeck boards](screenshots/Boards.png) |
| Task details | [ClearDeck task details](screenshots/Task-Details.png) |
| ClearDeck logo | [ClearDeck logo](screenshots/CLEARDECK_LOGO.png) |
| Database ER diagram | [ClearDeck entity relationship diagram](screenshots/ER_DIAGRAM.png) |
  
Features
Authentication: User registration and login with password hashing and token-based authentication.
Board management: Create, rename, and delete boards.
Team collaboration: Support for board owners, members, and inviting existing registered users.
Kanban workflow: Organize tasks into columns, including the default To Do, In Progress, and Done workflow.
Column management: Add, rename, delete, and reorder columns, subject to the application's permissions and validation rules.
Task management: Create, view, update, and delete tasks with titles, descriptions, priorities, due dates, assignees, and column placement.
Task ordering: Move tasks within a column or between columns while preserving their order.
Comments: Add comments to tasks, with server-side checks for comment ownership.
Search and filters: Search task titles and descriptions, and filter by priority or assignee where supported by the interface.
Responsive interface: React-based user interface with Material UI styling.
Automated checks: Frontend, API, and browser test files are included in the repository.
Technology stack
Area	Technologies
Frontend	React, JavaScript, CSS, Material UI
Backend	Node.js, Express
Database	SQLite using better-sqlite3
Authentication	bcrypt, JSON Web Tokens (JWT)
Configuration	Environment variables with dotenv
Testing	React/Jest tests, API tests, browser tests
Project structure
TaskBoard/
├── docs/
│   ├── screenshots/
│   ├── README.md
│   ├── API.md
│   ├── CHANGES.md
│   ├── ER_DIAGRAM.md
│   ├── ORDERING.md
│   ├── REQUIREMENTS.md
│   ├── SUBMISSION_CHECKLIST.md
│   └── TEST_RESULTS.md
├── public/
├── server/
│   ├── auth.js
│   ├── boards.js
│   ├── db.js
│   ├── middleware.js
│   ├── ordering.js
│   ├── resources.js
│   ├── schema.sql
│   ├── seed.js
│   ├── seed.sql
│   └── server.js
├── src/
│   ├── assets/
│   ├── api.js
│   ├── App.js
│   ├── AppShell.js
│   ├── Board.js
│   ├── BoardList.js
│   ├── Column.js
│   ├── Login.js
│   ├── Register.js
│   └── Task.js
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json

The tree above highlights the main application files. Refer to the actual project directory for the full list of files.

Getting started
Prerequisites
Install a current supported version of Node.js and npm. The project has separate frontend and backend package configurations.

1. Install frontend dependencies
Run these commands from the project root:

npm ci

2. Configure the backend
Create server/.env using server/.env.example as a template. Set a strong, private JWT_SECRET value in the local environment file.

Do not commit server/.env or place real credentials in source control. Keep the existing database file safe if it contains data you need.

3. Configure the frontend API URL
The root .env.example documents the frontend API configuration. For local development, the API URL is typically:

REACT_APP_API_URL=http://localhost:5000/api

If your project already has a working local .env, preserve it and check its value before changing configuration.

4. Start the backend
Open a terminal at the project root and run:

npm run server

The backend is expected to run on port 5000 unless your configuration specifies otherwise.

5. Start the frontend
Open a second terminal at the project root and run:

npm start

The React development server typically opens at http://localhost:3000.

Database caution: Review the seed script before running it. Do not delete or overwrite server/taskboard.db if it contains data you need. Use only disposable development data for seed/demo workflows.

Testing
Run the checks supported by the project scripts in package.json. The following commands are commonly configured for this project; confirm the exact script names in your current package.json if they differ:

npm run test:api
npm test -- --watchAll=false --runInBand
npm run build
npm run test:browser

Browser tests may require Playwright Chromium and the relevant local services or ports to be available. See TEST_RESULTS.md for the project's recorded test results and SUBMISSION_CHECKLIST.md for submission checks.

Documentation
API documentation
Entity relationship diagram and database notes
Task ordering strategy
Requirements
Change log
Test results
Submission checklist
Security and data handling
Passwords should be stored as hashes rather than plaintext.
Protected API routes should validate authentication and authorization on the server.
Database operations should use parameterized queries and appropriate validation.
Keep secrets in local environment files and exclude them from version control.
JWT storage and invalidation behavior depend on the current implementation; consult the source code and API documentation for exact behavior.
Current scope
ClearDeck focuses on core Kanban task and board management. Features not implemented in the current source should not be assumed to exist. For exact endpoint behavior, permissions, schema details, and known limitations, use the linked documentation and inspect the implementation.

License
No license is specified in this README. Add a license file and update this section if the project is to be distributed under a particular open-source license.