const API_BASE = import.meta.env.VITE_API_URL || "";

const jsonHeaders = () => ({
  "Content-Type": "application/json",
});

export const loadToken = () => localStorage.getItem("ttm_token");

export const saveToken = (token) => {
  localStorage.setItem("ttm_token", token);
};

export const clearToken = () => {
  localStorage.removeItem("ttm_token");
};

const authHeaders = () => {
  const token = loadToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...jsonHeaders(),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.error || "Request failed";
    throw new Error(message);
  }

  return data;
};

export const api = {
  signup: (payload) =>
    request("/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) =>
    request("/login", { method: "POST", body: JSON.stringify(payload) }),
  getDashboard: () => request("/dashboard"),
  getProjects: () => request("/projects"),
  createProject: (payload) =>
    request("/projects", { method: "POST", body: JSON.stringify(payload) }),
  deleteProject: (projectId) =>
    request(`/projects/${projectId}`, { method: "DELETE" }),
  addMember: (projectId, payload) =>
    request(`/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getTasks: () => request("/tasks"),
  createTask: (payload) =>
    request("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  deleteTask: (taskId) => request(`/tasks/${taskId}`, { method: "DELETE" }),
  updateTaskStatus: (taskId, payload) =>
    request(`/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getUsers: () => request("/users"),
};
