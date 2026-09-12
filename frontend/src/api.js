const TOKEN_KEY = "kuet_jersey_admin_token";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function assetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  jersey: () => request("/api/jersey"),
  submitOrder: (body) =>
    request("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  login: (body) =>
    request("/api/admin/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/api/admin/me"),
  saveJersey: (body) =>
    request("/api/admin/jersey", { method: "PUT", body: JSON.stringify(body) }),
  uploadImages: (files, typeId) => {
    const form = new FormData();
    [...files].forEach((f) => form.append("images", f));
    return request(`/api/admin/jersey/images?type=${encodeURIComponent(typeId)}`, {
      method: "POST",
      body: form,
    });
  },
  deleteImage: (url, typeId) =>
    request("/api/admin/jersey/images", {
      method: "DELETE",
      body: JSON.stringify({ url, type: typeId }),
    }),
  orders: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/admin/orders${q ? `?${q}` : ""}`);
  },
  updateOrder: (id, body) =>
    request(`/api/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteOrder: (id) =>
    request(`/api/admin/orders/${id}`, {
      method: "DELETE",
    }),
  changePassword: (body) =>
    request("/api/admin/password", { method: "POST", body: JSON.stringify(body) }),
};
