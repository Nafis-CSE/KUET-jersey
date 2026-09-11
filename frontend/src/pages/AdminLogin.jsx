import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api.js";

export default function AdminLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api.login({ username, password });
      setToken(res.token);
      nav("/admin", { replace: true });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page center">
      <form className="card form slim" onSubmit={submit}>
        <h2>Admin login</h2>
        <p className="hint">Only organizers can manage jersey and orders.</p>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err && <p className="alert bad">{err}</p>}
        <button className="btn" disabled={busy}>
          {busy ? "Checking..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
