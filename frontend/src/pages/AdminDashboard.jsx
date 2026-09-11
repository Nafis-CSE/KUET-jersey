import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api.js";

const blankSize = { code: "", chest: "", length: "" };

export default function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState("orders");
  const [jersey, setJersey] = useState(null);
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [providedFilter, setProvidedFilter] = useState("");
  const [sizeCounts, setSizeCounts] = useState({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [newSize, setNewSize] = useState(blankSize);

  async function loadJersey() {
    const j = await api.jersey();
    setJersey(j);
  }

  async function loadOrders(next = {}) {
    const nextQ = next.q ?? q;
    const nextStatus = next.status ?? status;
    const nextSize = next.size ?? sizeFilter;
    const nextProvided = next.provided ?? providedFilter;
    const data = await api.orders({
      q: nextQ,
      status: nextStatus,
      size: nextSize,
      provided: nextProvided,
    });
    setOrders(data.orders);
    setCounts(data.counts || {});
    setSizeCounts(data.sizeCounts || {});
  }

  useEffect(() => {
    api
      .me()
      .then(() => Promise.all([loadJersey(), loadOrders()]))
      .catch(() => {
        setToken("");
        nav("/admin/login", { replace: true });
      });
  }, []);

  function logout() {
    setToken("");
    nav("/admin/login", { replace: true });
  }

  function setType(id, patch) {
    setJersey((j) => ({
      ...j,
      types: j.types.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function setSizeRow(code, patch) {
    setJersey((j) => ({
      ...j,
      sizes: j.sizes.map((s) => (s.code === code ? { ...s, ...patch } : s)),
    }));
  }

  async function saveJersey(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      const saved = await api.saveJersey({
        title: jersey.title,
        description: jersey.description,
        currency: jersey.currency,
        types: jersey.types,
        sizes: jersey.sizes,
        paymentMethod: jersey.paymentMethod,
        paymentNumber: jersey.paymentNumber,
        paymentNote: jersey.paymentNote,
      });
      setJersey(saved);
      setMsg("Jersey details saved.");
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function onUpload(e, typeId) {
    const files = e.target.files;
    if (!files?.length) return;
    setErr("");
    try {
      const res = await api.uploadImages(files, typeId);
      setJersey((j) => ({ ...j, types: res.types }));
    } catch (ex) {
      setErr(ex.message);
    }
    e.target.value = "";
  }

  async function removeImg(url, typeId) {
    const res = await api.deleteImage(url, typeId);
    setJersey((j) => ({ ...j, types: res.types }));
  }

  function addSize(e) {
    e.preventDefault();
    const code = newSize.code.trim().toUpperCase();
    if (!code) return;
    if (jersey.sizes.some((s) => s.code === code)) {
      setErr("That size already exists.");
      return;
    }
    setJersey((j) => ({
      ...j,
      sizes: [...j.sizes, { code, chest: newSize.chest.trim(), length: newSize.length.trim() }],
    }));
    setNewSize(blankSize);
    setErr("");
  }

  function removeSize(code) {
    setJersey((j) => ({ ...j, sizes: j.sizes.filter((s) => s.code !== code) }));
  }

  async function setOrderStatus(id, nextStatus) {
    await api.updateOrder(id, { status: nextStatus });
    await loadOrders();
  }

  async function toggleProvided(id, provided) {
    await api.updateOrder(id, { provided });
    await loadOrders();
  }

  async function changePw(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api.changePassword(pw);
      setMsg("Password updated.");
      setPw({ currentPassword: "", newPassword: "" });
    } catch (ex) {
      setErr(ex.message);
    }
  }

  if (!jersey) return <main className="page">Loading admin...</main>;

  return (
    <main className="page admin">
      <div className="admin-head">
        <h1>Admin panel</h1>
        <button className="ghost" onClick={logout} type="button">
          Logout
        </button>
      </div>

      <div className="tabs">
        <button className={tab === "orders" ? "on" : ""} onClick={() => setTab("orders")}>
          Orders ({counts.pending || 0} pending)
        </button>
        <button className={tab === "jersey" ? "on" : ""} onClick={() => setTab("jersey")}>
          Jersey
        </button>
        <button className={tab === "security" ? "on" : ""} onClick={() => setTab("security")}>
          Security
        </button>
      </div>

      {err && <p className="alert bad">{err}</p>}
      {msg && <p className="alert ok">{msg}</p>}

      {tab === "jersey" && (
        <form className="card form" onSubmit={saveJersey}>
          <h2>Jersey details</h2>
          <label>
            Title
            <input value={jersey.title} onChange={(e) => setJersey({ ...jersey, title: e.target.value })} />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={jersey.description}
              onChange={(e) => setJersey({ ...jersey, description: e.target.value })}
            />
          </label>
          <label>
            Currency
            <input
              value={jersey.currency}
              onChange={(e) => setJersey({ ...jersey, currency: e.target.value })}
            />
          </label>

          <h3>Sleeve types and prices</h3>
          <div className="type-admin">
            {(jersey.types || []).map((t) => (
              <div className="type-box" key={t.id}>
                <label>
                  Name
                  <input value={t.name} onChange={(e) => setType(t.id, { name: e.target.value })} />
                </label>
                <label>
                  Price ({jersey.currency})
                  <input
                    type="number"
                    min="0"
                    value={t.price}
                    onChange={(e) => setType(t.id, { price: e.target.value })}
                  />
                </label>
                <label>
                  Note
                  <input
                    value={t.description}
                    onChange={(e) => setType(t.id, { description: e.target.value })}
                  />
                </label>
                <p className="hint">Photos for {t.name}</p>
                <input type="file" accept="image/*" multiple onChange={(e) => onUpload(e, t.id)} />
                <div className="thumbs admin-thumbs">
                  {(t.images || []).map((src) => (
                    <div key={src} className="img-chip">
                      <img src={src} alt="" />
                      <button type="button" onClick={() => removeImg(src, t.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3>Size chart (chest and length)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Chest</th>
                  <th>Length</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(jersey.sizes || []).map((s) => (
                  <tr key={s.code}>
                    <td>{s.code}</td>
                    <td>
                      <input
                        value={s.chest}
                        placeholder="e.g. 38 inch"
                        onChange={(e) => setSizeRow(s.code, { chest: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={s.length}
                        placeholder="e.g. 27 inch"
                        onChange={(e) => setSizeRow(s.code, { length: e.target.value })}
                      />
                    </td>
                    <td>
                      <button type="button" onClick={() => removeSize(s.code)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row filters">
            <input
              placeholder="Size code e.g. S"
              value={newSize.code}
              onChange={(e) => setNewSize({ ...newSize, code: e.target.value })}
            />
            <input
              placeholder="Chest"
              value={newSize.chest}
              onChange={(e) => setNewSize({ ...newSize, chest: e.target.value })}
            />
            <input
              placeholder="Length"
              value={newSize.length}
              onChange={(e) => setNewSize({ ...newSize, length: e.target.value })}
            />
            <button className="btn sm" type="button" onClick={addSize}>
              Add size
            </button>
          </div>

          <label>
            Payment method
            <input
              value={jersey.paymentMethod}
              onChange={(e) => setJersey({ ...jersey, paymentMethod: e.target.value })}
            />
          </label>
          <label>
            Payment number
            <input
              value={jersey.paymentNumber}
              onChange={(e) => setJersey({ ...jersey, paymentNumber: e.target.value })}
            />
          </label>
          <label>
            Payment note
            <input
              value={jersey.paymentNote}
              onChange={(e) => setJersey({ ...jersey, paymentNote: e.target.value })}
            />
          </label>
          <button className="btn">Save jersey</button>
        </form>
      )}

      {tab === "orders" && (
        <section className="card">
          <div className="stats">
            <span>Pending {counts.pending || 0}</span>
            <span>Verified {counts.verified || 0}</span>
            <span>Provided {counts.provided || 0}</span>
            <span>Cancelled {counts.cancelled || 0}</span>
          </div>
          <div className="size-stats">
            {Object.entries(sizeCounts).map(([code, c]) => (
              <button
                type="button"
                key={code}
                className={sizeFilter === code ? "size-stat on" : "size-stat"}
                onClick={() => {
                  const next = sizeFilter === code ? "" : code;
                  setSizeFilter(next);
                  loadOrders({ size: next });
                }}
              >
                <strong>{code}</strong>
                <em>{c.total} ordered</em>
                <small>
                  H {c.half || 0} · F {c.full || 0} · given {c.provided || 0}
                </small>
              </button>
            ))}
          </div>
          <div className="row filters">
            <input
              placeholder="Search name, roll, TrxID, sleeve"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadOrders()}
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                loadOrders({ status: e.target.value });
              }}
            >
              <option value="">All status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={sizeFilter}
              onChange={(e) => {
                setSizeFilter(e.target.value);
                loadOrders({ size: e.target.value });
              }}
            >
              <option value="">All sizes</option>
              {(jersey.sizes || []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
            <select
              value={providedFilter}
              onChange={(e) => {
                setProvidedFilter(e.target.value);
                loadOrders({ provided: e.target.value });
              }}
            >
              <option value="">All delivery</option>
              <option value="no">Not given yet</option>
              <option value="yes">Jersey given</option>
            </select>
            <button className="btn sm" type="button" onClick={() => loadOrders()}>
              Search
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Given</th>
                  <th>Name</th>
                  <th>Roll</th>
                  <th>Sleeve</th>
                  <th>Size</th>
                  <th>Chest / Length</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="10">No orders yet.</td>
                  </tr>
                )}
                {orders.map((o) => (
                  <tr key={o.id} className={o.provided ? "given-row" : ""}>
                    <td>
                      <label className="tick">
                        <input
                          type="checkbox"
                          checked={!!o.provided}
                          onChange={(e) => toggleProvided(o.id, e.target.checked)}
                        />
                        <span>{o.provided ? "Yes" : ""}</span>
                      </label>
                    </td>
                    <td>{o.name}</td>
                    <td>{o.roll}</td>
                    <td>{o.sleeveName || o.sleeveType || "—"}</td>
                    <td>{o.size}</td>
                    <td>
                      {o.chest || "—"} / {o.length || "—"}
                    </td>
                    <td>{o.paymentRef}</td>
                    <td>
                      {o.currency} {o.amount}
                    </td>
                    <td>
                      <span className={`st ${o.status}`}>{o.status}</span>
                    </td>
                    <td className="acts">
                      {o.status !== "verified" && (
                        <button type="button" onClick={() => setOrderStatus(o.id, "verified")}>
                          Verify
                        </button>
                      )}
                      {o.status !== "cancelled" && (
                        <button type="button" onClick={() => setOrderStatus(o.id, "cancelled")}>
                          Cancel
                        </button>
                      )}
                      {o.status !== "pending" && (
                        <button type="button" onClick={() => setOrderStatus(o.id, "pending")}>
                          Pending
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "security" && (
        <form className="card form slim" onSubmit={changePw}>
          <h2>Change admin password</h2>
          <label>
            Current password
            <input
              type="password"
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            />
          </label>
          <button className="btn">Update password</button>
        </form>
      )}
    </main>
  );
}
