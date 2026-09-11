const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const crypto = require("crypto");
const db = require("./db");

function uuid() {
  return crypto.randomUUID();
}

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "kuet-cse-2k24-jersey-secret";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error("Only JPG, PNG, WEBP or GIF images are allowed"), ok);
  },
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "kuet-jersey-api" });
});

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Admin login required" });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please login again." });
  }
}

function publicJersey(jersey) {
  return {
    title: jersey.title,
    description: jersey.description,
    currency: jersey.currency,
    types: jersey.types.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      description: t.description,
      images: t.images,
    })),
    sizes: jersey.sizes.map((s) => ({
      code: s.code,
      chest: s.chest,
      length: s.length,
    })),
    paymentMethod: jersey.paymentMethod,
    paymentNumber: jersey.paymentNumber,
    paymentNote: jersey.paymentNote,
    updatedAt: jersey.updatedAt,
  };
}

function findType(jersey, typeId) {
  return jersey.types.find((t) => t.id === typeId);
}

function findSize(jersey, code) {
  return jersey.sizes.find((s) => s.code === String(code).toUpperCase());
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/jersey", (_req, res) => {
  const data = db.read();
  res.json(publicJersey(data.jersey));
});

app.post("/api/orders", (req, res) => {
  const { name, roll, size, sleeveType, paymentRef } = req.body || {};
  const data = db.read();
  const jersey = data.jersey;

  const cleanName = String(name || "").trim();
  const cleanRoll = String(roll || "").trim().toUpperCase();
  const cleanSize = String(size || "").trim().toUpperCase();
  const cleanType = String(sleeveType || "").trim();
  const cleanRef = String(paymentRef || "").trim();

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: "Please enter your full name." });
  }
  if (!cleanRoll || !/^[A-Z0-9\-_]{2,20}$/.test(cleanRoll)) {
    return res.status(400).json({ error: "Enter a valid roll number." });
  }
  const type = findType(jersey, cleanType);
  if (!type) {
    return res.status(400).json({ error: "Please choose half sleeve or full sleeve." });
  }
  const sizeRow = findSize(jersey, cleanSize);
  if (!sizeRow) {
    return res.status(400).json({ error: "Please choose an available size." });
  }
  if (!cleanRef || cleanRef.length < 4) {
    return res.status(400).json({ error: "Enter the payment transaction reference." });
  }

  const duplicate = data.orders.find(
    (o) => o.roll === cleanRoll && o.status !== "cancelled"
  );
  if (duplicate) {
    return res.status(409).json({
      error: "An order already exists for this roll number.",
    });
  }

  const order = {
    id: uuid(),
    name: cleanName,
    roll: cleanRoll,
    size: cleanSize,
    sleeveType: type.id,
    sleeveName: type.name,
    chest: sizeRow.chest,
    length: sizeRow.length,
    paymentRef: cleanRef,
    amount: type.price,
    currency: jersey.currency,
    status: "pending",
    provided: false,
    createdAt: new Date().toISOString(),
  };

  data.orders.unshift(order);
  db.write(data);
  res.status(201).json({
    ok: true,
    message: "Order submitted. Admin will verify your payment.",
    order: {
      id: order.id,
      roll: order.roll,
      size: order.size,
      sleeveType: order.sleeveType,
      amount: order.amount,
    },
  });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const data = db.read();
  const userOk = String(username || "") === data.admin.username;
  const passOk = bcrypt.compareSync(String(password || ""), data.admin.passwordHash);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: "Invalid admin username or password." });
  }
  const token = jwt.sign({ role: "admin", username: data.admin.username }, JWT_SECRET, {
    expiresIn: "12h",
  });
  res.json({ token, username: data.admin.username });
});

app.get("/api/admin/me", auth, (req, res) => {
  res.json({ username: req.admin.username, role: "admin" });
});

app.put("/api/admin/jersey", auth, (req, res) => {
  const {
    title,
    description,
    currency,
    types,
    sizes,
    paymentMethod,
    paymentNumber,
    paymentNote,
  } = req.body || {};

  const data = db.read();
  const jersey = data.jersey;

  if (title != null) jersey.title = String(title).trim() || jersey.title;
  if (description != null) jersey.description = String(description);
  if (currency != null) jersey.currency = String(currency).trim() || "BDT";
  if (paymentMethod != null) jersey.paymentMethod = String(paymentMethod);
  if (paymentNumber != null) jersey.paymentNumber = String(paymentNumber);
  if (paymentNote != null) jersey.paymentNote = String(paymentNote);

  if (types != null) {
    if (!Array.isArray(types) || types.length < 1) {
      return res.status(400).json({ error: "Add at least one jersey type." });
    }
    jersey.types = types.map((t, i) => {
      const existing = jersey.types[i] || {};
      const price = Number(t.price);
      return {
        id: String(t.id || existing.id || (i === 0 ? "half" : "full")),
        name: String(t.name || existing.name || "").trim() || (i === 0 ? "Half Sleeve" : "Full Sleeve"),
        price: Number.isFinite(price) && price >= 0 ? price : existing.price || 0,
        description: String(t.description != null ? t.description : existing.description || ""),
        images: Array.isArray(existing.images) ? existing.images : [],
      };
    });
  }

  if (sizes != null) {
    if (!Array.isArray(sizes) || !sizes.length) {
      return res.status(400).json({ error: "Add at least one size." });
    }
    const seen = new Set();
    const next = [];
    for (const item of sizes) {
      const code = String(item.code || item)
        .trim()
        .toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      next.push({
        code,
        chest: String(item.chest ?? "").trim(),
        length: String(item.length ?? "").trim(),
      });
    }
    if (!next.length) return res.status(400).json({ error: "Add at least one size." });
    jersey.sizes = next;
  }

  jersey.updatedAt = new Date().toISOString();
  db.write(data);
  res.json(publicJersey(jersey));
});

app.post("/api/admin/jersey/images", auth, upload.array("images", 8), (req, res) => {
  const typeId = String(req.query.type || req.body?.type || "").trim();
  const data = db.read();
  const type = findType(data.jersey, typeId);
  if (!type) return res.status(400).json({ error: "Choose half or full sleeve for photos." });
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "No image uploaded." });

  const added = files.map((f) => `/uploads/${f.filename}`);
  type.images = [...type.images, ...added];
  data.jersey.updatedAt = new Date().toISOString();
  db.write(data);
  res.json({ typeId: type.id, images: type.images, types: publicJersey(data.jersey).types });
});

app.delete("/api/admin/jersey/images", auth, (req, res) => {
  const { url, type: typeId } = req.body || {};
  if (!url) return res.status(400).json({ error: "Image url required." });
  const data = db.read();
  const type = findType(data.jersey, String(typeId || ""));
  if (!type) return res.status(400).json({ error: "Choose half or full sleeve for photos." });
  type.images = type.images.filter((img) => img !== url);
  data.jersey.updatedAt = new Date().toISOString();
  db.write(data);
  res.json({ typeId: type.id, images: type.images, types: publicJersey(data.jersey).types });
});

app.get("/api/admin/orders", auth, (req, res) => {
  const data = db.read();
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim().toLowerCase();
  const size = String(req.query.size || "").trim().toUpperCase();
  const provided = String(req.query.provided || "").trim().toLowerCase();
  let list = data.orders.map((o) => ({ ...o, provided: !!o.provided }));
  if (status) list = list.filter((o) => o.status === status);
  if (size) list = list.filter((o) => String(o.size || "").toUpperCase() === size);
  if (provided === "yes") list = list.filter((o) => o.provided);
  if (provided === "no") list = list.filter((o) => !o.provided);
  if (q) {
    list = list.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.roll.toLowerCase().includes(q) ||
        o.paymentRef.toLowerCase().includes(q) ||
        o.size.toLowerCase().includes(q) ||
        String(o.sleeveName || "").toLowerCase().includes(q) ||
        String(o.sleeveType || "").toLowerCase().includes(q)
    );
  }

  const active = data.orders.filter((o) => o.status !== "cancelled");
  const sizeCounts = {};
  for (const s of data.jersey.sizes || []) {
    sizeCounts[s.code] = { total: 0, provided: 0, half: 0, full: 0 };
  }
  for (const o of active) {
    const code = String(o.size || "").toUpperCase();
    if (!sizeCounts[code]) sizeCounts[code] = { total: 0, provided: 0, half: 0, full: 0 };
    sizeCounts[code].total += 1;
    if (o.provided) sizeCounts[code].provided += 1;
    if (o.sleeveType === "full") sizeCounts[code].full += 1;
    else sizeCounts[code].half += 1;
  }

  res.json({
    total: data.orders.length,
    counts: {
      pending: data.orders.filter((o) => o.status === "pending").length,
      verified: data.orders.filter((o) => o.status === "verified").length,
      cancelled: data.orders.filter((o) => o.status === "cancelled").length,
      provided: data.orders.filter((o) => o.provided).length,
    },
    sizeCounts,
    orders: list,
  });
});

app.patch("/api/admin/orders/:id", auth, (req, res) => {
  const { status, provided } = req.body || {};
  const data = db.read();
  const order = data.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (status != null) {
    const allowed = ["pending", "verified", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    order.status = status;
  }
  if (provided != null) order.provided = !!provided;
  order.updatedAt = new Date().toISOString();
  db.write(data);
  res.json({ ...order, provided: !!order.provided });
});

app.post("/api/admin/password", auth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  const data = db.read();
  if (!bcrypt.compareSync(String(currentPassword || ""), data.admin.passwordHash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  data.admin.passwordHash = bcrypt.hashSync(String(newPassword), 10);
  db.write(data);
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Request failed." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jersey API listening on ${PORT}`);
});
