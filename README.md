# Employee Task Management System

A modern full-stack Employee Task Management System built with Node.js, Express, MySQL, and vanilla JavaScript. It provides task workflows, analytics, notifications, and role-based access using SQL views, procedures, and triggers.

## Quick start

1) Prerequisites
- Node.js 18+ (LTS recommended)
- MySQL 8+

2) Setup
- Copy .env.example to .env and adjust values
- Install dependencies: npm install
- Ensure MySQL is running (e.g., on macOS: brew services start mysql)
- Initialize DB schema and seed data:
    - Import base schema: npm run import-db (runs database.sql)
    - Optional advanced features: execute database-advanced.sql in MySQL (views, triggers, procedures, events)
    - Seed sample users/tasks: npm run setup

3) Run
- Development: npm run dev
- Production: npm start

App is served at http://localhost:3002 by default. Static frontend is in public/ (default route loads index.html). The modern UI is available at /etask.html.

## Features

Authentication & Authorization
- JWT-based auth, role-based access (admin, manager, employee)
- Registration with email validation

Dashboard & Analytics
- Role-aware dashboard stats via SQL views and procedures
- Task analytics and user performance endpoints

Task Management
- CRUD, assignment, priorities, due dates, estimates
- Kanban status updates and audit history (triggers)

Notifications
- DB-driven notifications with read/unread, priority, and joins to tasks/users

Database capabilities
- Stored procedures, triggers, transactions, views, scheduled events

Frontend
- Vanilla JS, Bootstrap 5, Font Awesome; pages: index.html and etask.html

## Environment variables

Create a .env (see .env.example):

- PORT=3002
- DB_HOST=localhost
- DB_USER=root
- DB_PASSWORD=your_password
- DB_NAME=task_management_db
- JWT_SECRET=change-me
- SESSION_SECRET=change-me-too
- CORS_ORIGIN=http://localhost:3002

Note: Server currently reads PORT from env but also uses inline defaults in server.js. Keep PORT and the frontend API base URL aligned. The frontend currently targets http://localhost:3002/api.

## Project structure

```
├── server.js                 # Express app (serves /public and REST API)
├── setup.js                  # Seeds sample users and tasks
├── import-database.js        # Imports database.sql
├── database.sql              # Base schema and seed
├── database-advanced.sql     # Procedures, views, triggers, events
├── public/
│   ├── index.html            # Landing + basic login
│   ├── etask.html            # Modern eTask UI
│   ├── css/
│   │   ├── style.css
│   │   └── etask.css
│   └── js/
│       ├── app.js            # Basic app logic / Google Sign-In hooks
│       └── eTask-app.js      # Main eTask application (dashboard, kanban, etc.)
├── GOOGLE_SETUP.md           # Google Sign-In setup guide
├── package.json
├── README.md
└── .env (local)
```

## Running the database setup

1) Import base schema and data
- npm run import-db (executes statements from database.sql)

2) Apply advanced features (optional but recommended)
- Open database-advanced.sql in MySQL Workbench or CLI and execute it
- This creates stored procedures (sp_create_user, sp_assign_task, sp_update_task_status, sp_get_user_dashboard), triggers, views (e.g., vw_task_summary, vw_user_task_stats), and events

3) Seed sample data
- npm run setup

Default users after setup
- Admin: admin / password
- Manager: manager / password
- Employee: john / password

## API endpoints (summary)

Auth
- POST /api/login
- POST /api/register
- POST /api/google-login (expects server-side verification of Google ID token)
- POST /api/logout

Dashboard & analytics
- GET /api/dashboard
- GET /api/analytics
- GET /api/task-statistics
- GET /api/users/stats (admin/manager)

Tasks
- GET /api/tasks
- GET /api/tasks/:id
- POST /api/tasks
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- PUT /api/tasks/:id/status (kanban quick status)
- GET /api/tasks/:id/history

Users (admin only)
- GET /api/users
- POST /api/users
- PUT /api/users/:id
- DELETE /api/users/:id

Profile
- PUT /api/profile

Notifications
- GET /api/notifications
- PUT /api/notifications/:id/read

Response shapes can vary between endpoints; standardization work is planned.

## Notes on ports and frontend API base URL

- Server default: PORT=3002
- Frontend uses API base URL http://localhost:3002/api (see public/js/eTask-app.js)
- If you change PORT, update the frontend base URL accordingly or introduce a config layer.

## Security notes

- Use strong JWT_SECRET and SESSION_SECRET values in production
- Consider verifying Google ID tokens on the server using google-auth-library
- Limit CORS origins to trusted domains (set CORS_ORIGIN)
- Prefer HttpOnly cookies for tokens if you migrate from localStorage
- Add Helmet and rate limiting in production

## Contributing

1) Fork the repository
2) Create a feature branch (git checkout -b feat/your-feature)
3) Commit (git commit -m "feat: add your feature")
4) Push (git push origin feat/your-feature)
5) Open a Pull Request

## License

MIT

## Support

- Check existing issues
- Open a new issue with steps to reproduce and logs

## Acknowledgments

- Bootstrap, Font Awesome, MySQL, Express.js