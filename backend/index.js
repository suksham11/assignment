const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o)))
        return cb(null, true);
      cb(null, true); // allow all in prod for simplicity
    },
    credentials: true,
  }),
);
app.use(bodyParser.json());

const db = require("./models");
const { User, Project, Task } = db;

db.sequelize
  .authenticate()
  .then(() => db.sequelize.sync())
  .then(() => console.log("DB connected."))
  .catch((err) => console.error("DB error:", err));

// Middleware
const authRequired = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only" });
  next();
};

const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

// Auth
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Missing fields" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password min 6 chars" });
  try {
    if (await User.findOne({ where: { email } }))
      return res.status(409).json({ error: "Email in use" });
    const role = (await User.count()) === 0 ? "admin" : "member";
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
    });
    res.status(201).json({ message: "Created", user: safeUser(user) });
  } catch {
    res.status(500).json({ error: "Error creating user" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Missing credentials" });
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.json({ message: "Login successful", token, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: "Login error" });
  }
});

app.get("/me", authRequired, (req, res) => res.json(safeUser(req.user)));

// Users
app.get("/users", authRequired, requireAdmin, async (req, res) => {
  try {
    res.json(
      await User.findAll({ attributes: ["id", "name", "email", "role"] }),
    );
  } catch {
    res.status(500).json({ error: "Error fetching users" });
  }
});

// Projects
app.get("/projects", authRequired, async (req, res) => {
  try {
    const inc = [{ model: User, attributes: ["id", "name", "email", "role"] }];
    const projects =
      req.user.role === "admin"
        ? await Project.findAll({ include: inc })
        : await req.user.getProjects({ include: inc });
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Error fetching projects" });
  }
});

app.post("/projects", authRequired, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  try {
    res
      .status(201)
      .json({
        message: "Created",
        project: await Project.create({ name, description }),
      });
  } catch {
    res.status(500).json({ error: "Error creating project" });
  }
});

app.delete("/projects/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const p = await Project.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });
    await p.destroy();
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ error: "Error deleting project" });
  }
});

app.post(
  "/projects/:projectId/members",
  authRequired,
  requireAdmin,
  async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    try {
      const project = await Project.findByPk(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      await project.addUser(user);
      res.json({ message: "Member added" });
    } catch {
      res.status(500).json({ error: "Error adding member" });
    }
  },
);

app.delete(
  "/projects/:projectId/members/:userId",
  authRequired,
  requireAdmin,
  async (req, res) => {
    try {
      const project = await Project.findByPk(req.params.projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      await project.removeUser(req.params.userId);
      res.json({ message: "Member removed" });
    } catch {
      res.status(500).json({ error: "Error removing member" });
    }
  },
);

// Tasks
app.get("/tasks", authRequired, async (req, res) => {
  try {
    const opts = {
      include: [
        { model: Project, attributes: ["id", "name"] },
        { model: User, attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "DESC"]],
    };
    const tasks =
      req.user.role === "admin"
        ? await Task.findAll(opts)
        : await Task.findAll({ ...opts, where: { UserId: req.user.id } });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: "Error fetching tasks" });
  }
});

app.post("/tasks", authRequired, async (req, res) => {
  const { title, description, status, projectId, userId, dueDate } = req.body;
  if (!title || !projectId)
    return res.status(400).json({ error: "Title and projectId required" });
  try {
    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (req.user.role !== "admin") {
      if (!(await project.hasUser(req.user)))
        return res.status(403).json({ error: "Not a member" });
      if (userId && userId !== req.user.id)
        return res.status(403).json({ error: "Cannot assign to others" });
    }
    const task = await Task.create({
      title,
      description,
      status: status || "pending",
      dueDate: dueDate || null,
      ProjectId: projectId,
      UserId: userId || null,
    });
    res.status(201).json({ message: "Task created", task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating task" });
  }
});

app.patch("/tasks/:id/status", authRequired, async (req, res) => {
  const { status } = req.body;
  if (!["pending", "in-progress", "completed"].includes(status))
    return res.status(400).json({ error: "Invalid status" });
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "admin" && task.UserId !== req.user.id)
      return res.status(403).json({ error: "Not allowed" });
    await task.update({ status });
    res.json({ message: "Updated", task });
  } catch {
    res.status(500).json({ error: "Error updating task" });
  }
});

app.delete("/tasks/:id", authRequired, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "admin" && task.UserId !== req.user.id)
      return res.status(403).json({ error: "Not allowed" });
    await task.destroy();
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ error: "Error deleting task" });
  }
});

// Dashboard
app.get("/dashboard", authRequired, async (req, res) => {
  try {
    const now = new Date();
    const base = req.user.role === "admin" ? {} : { UserId: req.user.id };
    const [total, pending, inProgress, completed, overdue] = await Promise.all([
      Task.count({ where: base }),
      Task.count({ where: { ...base, status: "pending" } }),
      Task.count({ where: { ...base, status: "in-progress" } }),
      Task.count({ where: { ...base, status: "completed" } }),
      Task.count({
        where: {
          ...base,
          status: { [Op.ne]: "completed" },
          dueDate: { [Op.lt]: now },
        },
      }),
    ]);
    res.json({ total, pending, inProgress, completed, overdue });
  } catch {
    res.status(500).json({ error: "Dashboard error" });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.get("/", (_, res) => {
  res.json({
    name: "Team Task Manager API",
    status: "ok",
    health: "/health",
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
