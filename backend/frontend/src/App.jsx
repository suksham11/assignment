import React, { useEffect, useMemo, useState } from "react";
import { api, clearToken, loadToken, saveToken } from "./api.js";

const initialAuth = () => {
  const rawUser = localStorage.getItem("ttm_user");
  const token = loadToken();
  if (!rawUser || !token) return { user: null, token: null };
  try {
    return { user: JSON.parse(rawUser), token };
  } catch {
    return { user: null, token: null };
  }
};

const statusOptions = ["pending", "in-progress", "completed"];

export default function App() {
  const [auth, setAuth] = useState(initialAuth);
  const [mode, setMode] = useState("login");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  const isAdmin = auth.user?.role === "admin";

  const resetNotice = () => setNotice("");

  const handleAuth = async (evt) => {
    evt.preventDefault();
    resetNotice();
    setLoading(true);

    const form = evt.currentTarget;
    const payload = Object.fromEntries(new FormData(form));

    try {
      if (mode === "signup") {
        await api.signup(payload);
      }
      const data = await api.login({
        email: payload.email,
        password: payload.password,
      });
      saveToken(data.token);
      localStorage.setItem("ttm_user", JSON.stringify(data.user));
      setAuth({ user: data.user, token: data.token });
      form.reset();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem("ttm_user");
    setAuth({ user: null, token: null });
    setDashboard(null);
    setProjects([]);
    setTasks([]);
    setUsers([]);
  };

  const refreshAll = async () => {
    resetNotice();
    setLoading(true);
    try {
      const [dash, projectsData, tasksData, usersData] = await Promise.all([
        api.getDashboard(),
        api.getProjects(),
        api.getTasks(),
        isAdmin ? api.getUsers() : Promise.resolve([]),
      ]);
      setDashboard(dash);
      setProjects(projectsData);
      setTasks(tasksData);
      setUsers(usersData);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.token) {
      refreshAll();
    }
  }, [auth.token]);

  const projectOptions = useMemo(() => projects, [projects]);
  const memberOptions = useMemo(
    () => users.filter((user) => user.role === "member"),
    [users],
  );
  const assigneeOptions = useMemo(() => {
    if (isAdmin) return users;
    return auth.user ? [auth.user] : [];
  }, [auth.user, isAdmin, users]);
  const projectStats = useMemo(() => {
    const memberIds = new Set();
    projects.forEach((project) => {
      (project.Users || []).forEach((member) => memberIds.add(member.id));
    });
    return {
      totalProjects: projects.length,
      totalMembers: memberIds.size,
      totalTasks: tasks.length,
    };
  }, [projects, tasks.length]);

  const handleCreateProject = async (evt) => {
    evt.preventDefault();
    resetNotice();
    setLoading(true);
    const payload = Object.fromEntries(new FormData(evt.currentTarget));

    try {
      await api.createProject(payload);
      evt.currentTarget.reset();
      await refreshAll();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (evt) => {
    evt.preventDefault();
    resetNotice();
    setLoading(true);

    const payload = Object.fromEntries(new FormData(evt.currentTarget));
    const projectId = payload.projectId;

    try {
      await api.addMember(projectId, { userId: payload.userId });
      evt.currentTarget.reset();
      await refreshAll();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (evt) => {
    evt.preventDefault();
    resetNotice();
    setLoading(true);
    const payload = Object.fromEntries(new FormData(evt.currentTarget));

    try {
      await api.createTask({
        title: payload.title,
        description: payload.description,
        status: payload.status,
        projectId: payload.projectId,
        userId: payload.userId || undefined,
        dueDate: payload.dueDate || null,
      });
      evt.currentTarget.reset();
      await refreshAll();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId, status) => {
    resetNotice();
    setLoading(true);
    try {
      await api.updateTaskStatus(taskId, { status });
      await refreshAll();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Delete this project and its tasks?")) return;
    resetNotice();
    setLoading(true);
    try {
      await api.deleteProject(projectId);
      await refreshAll();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    resetNotice();
    setLoading(true);
    try {
      await api.deleteTask(taskId);
      await refreshAll();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  const jumpToCreateProject = () => {
    const target = document.getElementById("create-project");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!auth.user) {
    return (
      <main className="auth-shell">
        <section className="auth-card fade-up">
          <div className="auth-header">
            <p className="eyebrow">Team Task Manager</p>
            <h1>Move work forward together.</h1>
            <p className="lead">
              Organize projects, assign tasks, and track delivery with clarity.
            </p>
          </div>
          <form className="auth-form" onSubmit={handleAuth}>
            {mode === "signup" && (
              <label>
                Name
                <input
                  name="name"
                  type="text"
                  placeholder="Your name"
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="Min 6 characters"
                required
              />
            </label>
            {notice && <p className="notice">{notice}</p>}
            <button className="primary" type="submit" disabled={loading}>
              {loading
                ? "Working..."
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup"
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar fade-up" style={{ "--delay": "40ms" }}>
        <div>
          <p className="eyebrow">Team Task Manager</p>
          <h1>Welcome back, {auth.user.name}</h1>
        </div>
        <div className="actions">
          <button className="ghost" onClick={refreshAll} disabled={loading}>
            Refresh
          </button>
          <button className="ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {notice && <div className="notice-banner">{notice}</div>}
      {loading && <div className="notice-banner">Syncing latest data...</div>}

      <section className="stats-grid">
        <StatCard label="Total tasks" value={dashboard?.total ?? 0} />
        <StatCard label="Pending" value={dashboard?.pending ?? 0} />
        <StatCard label="In progress" value={dashboard?.inProgress ?? 0} />
        <StatCard label="Completed" value={dashboard?.completed ?? 0} />
        <StatCard
          label="Overdue"
          value={dashboard?.overdue ?? 0}
          tone="alert"
        />
      </section>

      <section className="content-grid">
        <Panel
          title="Projects"
          className="projects-panel"
          action={
            isAdmin ? (
              <button
                className="ghost"
                type="button"
                onClick={jumpToCreateProject}
              >
                New project
              </button>
            ) : null
          }
        >
          <ul className="list">
            {projects.map((project, index) => (
              <li
                key={project.id}
                className="fade-up"
                style={{ "--delay": `${80 + index * 60}ms` }}
              >
                <div className="row-split">
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.description || "No description"}</p>
                    <div className="tag-row">
                      {(project.Users || []).map((member) => (
                        <span className="tag" key={member.id}>
                          {member.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      className="ghost danger"
                      type="button"
                      onClick={() => handleDeleteProject(project.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
            {!projects.length && <li className="empty">No projects yet.</li>}
          </ul>
          <div className="panel-footer">
            <div className="summary-row">
              <span>Projects: {projectStats.totalProjects}</span>
              <span>Members: {projectStats.totalMembers}</span>
              <span>Tasks: {projectStats.totalTasks}</span>
            </div>
            <p className="hint">
              Keep each project focused to avoid task sprawl.
            </p>
          </div>
        </Panel>

        <Panel title="Tasks" className="tasks-panel">
          <ul className="list">
            {tasks.map((task, index) => {
              const isOverdue =
                task.dueDate &&
                task.status !== "completed" &&
                new Date(task.dueDate) < new Date();
              const canDelete = isAdmin || task.UserId === auth.user.id;
              return (
                <li
                  key={task.id}
                  className={`task-row fade-up ${isOverdue ? "overdue" : ""}`}
                  style={{ "--delay": `${80 + index * 60}ms` }}
                >
                  <div>
                    <div className="row-split">
                      <h3>{task.title}</h3>
                      {isOverdue && <span className="pill warn">Overdue</span>}
                    </div>
                    <p>{task.description || "No details"}</p>
                    <div className="meta">
                      <span>{task.Project?.name || "Unassigned project"}</span>
                      <span>
                        Due:{" "}
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString()
                          : "TBD"}
                      </span>
                      <span className={`pill ${task.status}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                  <div className="task-actions">
                    <select
                      value={task.status}
                      onChange={(evt) =>
                        handleStatusChange(task.id, evt.target.value)
                      }
                      disabled={loading}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    {canDelete && (
                      <button
                        className="ghost danger"
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {!tasks.length && <li className="empty">No tasks yet.</li>}
          </ul>
        </Panel>
      </section>

      <section className="content-grid">
        {isAdmin && (
          <Panel
            title="Create project"
            className="form-panel fade-up"
            id="create-project"
          >
            <form className="stack" onSubmit={handleCreateProject}>
              <label>
                Project name
                <input name="name" type="text" required />
              </label>
              <label>
                Description
                <textarea name="description" rows="3" />
              </label>
              <button className="primary" type="submit" disabled={loading}>
                Create project
              </button>
            </form>
          </Panel>
        )}

        {isAdmin && (
          <Panel title="Add members" className="fade-up">
            <form className="stack" onSubmit={handleAddMember}>
              <label>
                Project
                <select name="projectId" required>
                  <option value="">Select project</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Member
                <select name="userId" required>
                  <option value="">Select user</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" type="submit" disabled={loading}>
                Add member
              </button>
            </form>
          </Panel>
        )}

        <Panel title="Create task" className="fade-up">
          <form className="stack" onSubmit={handleCreateTask}>
            <label>
              Title
              <input name="title" type="text" required />
            </label>
            <label>
              Description
              <textarea name="description" rows="3" />
            </label>
            <label>
              Project
              <select name="projectId" required>
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assign to
              <select name="userId">
                <option value="">Unassigned</option>
                {assigneeOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid-two">
              <label>
                Status
                <select name="status" defaultValue="pending">
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input name="dueDate" type="date" />
              </label>
            </div>
            <button className="primary" type="submit" disabled={loading}>
              Create task
            </button>
          </form>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children, className, action, id }) {
  return (
    <section className={`panel ${className || ""}`.trim()} id={id}>
      <header className="panel-header">
        <h2>{title}</h2>
        {action && <div className="panel-actions">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <article className={`stat-card fade-up ${tone || ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}
