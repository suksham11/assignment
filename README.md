# Team Task Manager

A full-stack web app to manage projects, assign tasks, and track progress with role-based access control.

## Tech Stack

- Backend: Node.js, Express, Sequelize, PostgreSQL
- Frontend: React (Vite)
- Auth: JWT

## Features

- Signup/Login with JWT
- Admin/Member roles
- Project creation and membership management
- Task creation, assignment, and status tracking
- Dashboard metrics (total, pending, in-progress, completed, overdue)

## Getting Started

### 1) Backend setup

```bash
cd backend
npm install
```

Create a .env file in backend/:

```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=team_task_manager
DB_PORT=5432
JWT_SECRET=your_jwt_secret
PORT=5000
```

Run the server:

```bash
npm start
```

### 2) Frontend setup

```bash
cd backend/frontend
npm install
npm run dev
```

Optional frontend environment (backend URL):

```env
VITE_API_URL=http://localhost:5000
```

Frontend runs at http://localhost:5173
Backend runs at http://localhost:5000

## API Overview

- POST /signup
- POST /login
- GET /dashboard
- GET /projects
- POST /projects (admin)
- POST /projects/:projectId/members (admin)
- GET /tasks
- POST /tasks
- PATCH /tasks/:taskId/status
- GET /users (admin)

## Role-based Access

- The first registered user becomes admin.
- Admins can create projects and manage members.
- Members can view their projects and tasks.

## Deployment (Railway)

- Create a Railway project.
- Add a PostgreSQL database.
- Set environment variables from .env.
- Deploy the backend and frontend as separate services.

