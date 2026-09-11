import { useEffect, useMemo, useState } from "react";
import { api, assetUrl } from "../api.js";

const empty = {
  name: "",
  roll: "",
  size: "",
  sleeveType: "half",
  paymentRef: "",
};

export default function Home() {
  const [jersey, setJersey] = useState(null);
  const [form, setForm] = useState(empty);
  const [activeImg, setActiveImg] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .jersey()
      .then((j) => {
        setJersey(j);
        const firstType = j.types?.[0]?.id || "half";
        const firstSize = j.sizes?.[0]?.code || "";
        setForm((f) => ({
          ...f,
          sleeveType: f.sleeveType || firstType,
          size: f.size || firstSize,
        }));
      })
      .catch(() => setErr("Could not load jersey details."));
  }, []);

  const selectedType = useMemo(
    () => jersey?.types?.find((t) => t.id === form.sleeveType) || jersey?.types?.[0],
    [jersey, form.sleeveType]
  );
  const selectedSize = useMemo(
    () => jersey?.sizes?.find((s) => s.code === form.size) || jersey?.sizes?.[0],
    [jersey, form.size]
  );
  const images = selectedType?.images || [];

  useEffect(() => {
    setActiveImg(0);
  }, [form.sleeveType]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const res = await api.submitOrder(form);
      setMsg(res.message);
      setForm({
        ...empty,
        sleeveType: jersey?.types?.[0]?.id || "half",
        size: jersey?.sizes?.[0]?.code || "",
      });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Khulna University of Engineering & Technology</p>
          <h1>{jersey?.title || "CSE 2k24 Jersey"}</h1>
          <p className="lede">{jersey?.description || "Loading jersey details..."}</p>
          <div className="type-prices">
            {(jersey?.types || []).map((t) => (
              <button
                type="button"
                key={t.id}
                className={selectedType?.id === t.id ? "type-card on" : "type-card"}
                onClick={() => setForm({ ...form, sleeveType: t.id })}
              >
                <span>{t.name}</span>
                <strong>
                  {jersey.currency} {t.price}
                </strong>
              </button>
            ))}
          </div>
        </div>

        <div className="gallery">
          {images.length ? (
            <>
              <img className="hero-img" src={assetUrl(images[activeImg])} alt={selectedType?.name || "Jersey"} />
              {images.length > 1 && (
                <div className="thumbs">
                  {images.map((src, i) => (
                    <button
                      key={src}
                      className={i === activeImg ? "on" : ""}
                      onClick={() => setActiveImg(i)}
                      type="button"
                    >
                      <img src={assetUrl(src)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="placeholder">
              <span>{selectedType?.name || "Jersey"} photo coming soon</span>
              <small>Admin will upload the official design</small>
            </div>
          )}
        </div>
      </section>

      <section className="grid-2">
        <form className="card form" onSubmit={submit}>
          <h2>Place your order</h2>
          <p className="hint">Choose sleeve type and size, pay the matching price, then paste the TrxID.</p>

          <label>
            Full name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
            />
          </label>
          <label>
            Roll number
            <input
              required
              value={form.roll}
              onChange={(e) => setForm({ ...form, roll: e.target.value })}
              placeholder="e.g. 2407001"
            />
          </label>
          <label>
            Sleeve type
            <div className="sizes">
              {(jersey?.types || []).map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={form.sleeveType === t.id ? "size on" : "size"}
                  onClick={() => setForm({ ...form, sleeveType: t.id })}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </label>
          <label>
            Size
            <div className="sizes">
              {(jersey?.sizes || []).map((s) => (
                <button
                  type="button"
                  key={s.code}
                  className={form.size === s.code ? "size on" : "size"}
                  onClick={() => setForm({ ...form, size: s.code })}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </label>

          {selectedSize && (
            <p className="measure">
              {selectedSize.code}: chest {selectedSize.chest || "—"} · length {selectedSize.length || "—"}
            </p>
          )}

          <p className="pay-now">
            Pay{" "}
            <strong>
              {jersey?.currency} {selectedType?.price ?? "—"}
            </strong>{" "}
            for {selectedType?.name || "jersey"}
          </p>

          <label>
            Payment reference / TrxID
            <input
              required
              value={form.paymentRef}
              onChange={(e) => setForm({ ...form, paymentRef: e.target.value })}
              placeholder="bKash / Nagad transaction ID"
            />
          </label>

          {err && <p className="alert bad">{err}</p>}
          {msg && <p className="alert ok">{msg}</p>}

          <button className="btn" disabled={busy || !jersey}>
            {busy ? "Submitting..." : "Submit order"}
          </button>
        </form>

        <aside className="card pay">
          <h2>Size chart</h2>
          <p className="hint">Measurements set by admin. Check chest and length before you order.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Chest</th>
                  <th>Length</th>
                </tr>
              </thead>
              <tbody>
                {(jersey?.sizes || []).map((s) => (
                  <tr key={s.code} className={form.size === s.code ? "row-on" : ""}>
                    <td>{s.code}</td>
                    <td>{s.chest || "—"}</td>
                    <td>{s.length || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>How to pay</h2>
          <ul>
            <li>
              Method: <strong>{jersey?.paymentMethod || "—"}</strong>
            </li>
            <li>
              Number: <strong>{jersey?.paymentNumber || "Will be posted by admin"}</strong>
            </li>
            <li>
              Half sleeve:{" "}
              <strong>
                {jersey?.currency} {jersey?.types?.find((t) => t.id === "half")?.price ?? "—"}
              </strong>
            </li>
            <li>
              Full sleeve:{" "}
              <strong>
                {jersey?.currency} {jersey?.types?.find((t) => t.id === "full")?.price ?? "—"}
              </strong>
            </li>
            <li>{jersey?.paymentNote}</li>
          </ul>
          <p className="note">One order per roll. Admin verifies payment. Only admin can see the response list.</p>
        </aside>
      </section>

      <footer className="foot">KUET CSE · Batch 2k24 · Jersey collection</footer>
    </main>
  );
}
