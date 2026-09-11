const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const DEFAULT_ADMIN_USER = process.env.ADMIN_USER || "admin";
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASS || "kuet2k24jersey";

const DEFAULT_SIZES = [
  { code: "S", chest: "", length: "" },
  { code: "M", chest: "", length: "" },
  { code: "L", chest: "", length: "" },
  { code: "XL", chest: "", length: "" },
  { code: "XXL", chest: "", length: "" },
  { code: "XXXL", chest: "", length: "" },
];

function defaultTypes(legacyPrice, legacyImages) {
  const price = Number.isFinite(Number(legacyPrice)) ? Number(legacyPrice) : 650;
  const images = Array.isArray(legacyImages) ? legacyImages : [];
  return [
    {
      id: "half",
      name: "Half Sleeve",
      price,
      description: "Short sleeve batch jersey.",
      images: [...images],
    },
    {
      id: "full",
      name: "Full Sleeve",
      price: price + 100,
      description: "Full sleeve batch jersey.",
      images: [],
    },
  ];
}

function emptyDb() {
  return {
    admin: {
      username: DEFAULT_ADMIN_USER,
      passwordHash: bcrypt.hashSync(DEFAULT_ADMIN_PASS, 10),
    },
    jersey: {
      title: "KUET CSE 2k24 Batch Jersey",
      description:
        "Official batch jersey for KUET CSE 2k24. Choose half or full sleeve, pick your size from the chart, pay, and drop the transaction reference.",
      currency: "BDT",
      types: defaultTypes(650, []),
      sizes: DEFAULT_SIZES.map((s) => ({ ...s })),
      paymentMethod: "bKash / Nagad",
      paymentNumber: "",
      paymentNote: "Send money and paste the TrxID as payment reference.",
      updatedAt: null,
    },
    orders: [],
  };
}

function normalizeSize(item, fallbackCode) {
  if (typeof item === "string") {
    return { code: item.toUpperCase(), chest: "", length: "" };
  }
  return {
    code: String(item.code || fallbackCode || "")
      .trim()
      .toUpperCase(),
    chest: String(item.chest ?? "").trim(),
    length: String(item.length ?? "").trim(),
  };
}

function migrate(data) {
  if (!data.jersey) data.jersey = emptyDb().jersey;
  const j = data.jersey;

  if (!Array.isArray(j.types) || !j.types.length) {
    j.types = defaultTypes(j.price, j.images);
  } else {
    j.types = j.types.map((t, i) => ({
      id: String(t.id || (i === 0 ? "half" : "full")),
      name: String(t.name || (i === 0 ? "Half Sleeve" : "Full Sleeve")),
      price: Number.isFinite(Number(t.price)) ? Number(t.price) : 0,
      description: String(t.description || ""),
      images: Array.isArray(t.images) ? t.images : [],
    }));
  }

  if (Array.isArray(j.sizes) && j.sizes.length) {
    const seen = new Set();
    j.sizes = j.sizes
      .map((s) => normalizeSize(s))
      .filter((s) => {
        if (!s.code || seen.has(s.code)) return false;
        seen.add(s.code);
        return true;
      });
    for (const extra of DEFAULT_SIZES) {
      if (!seen.has(extra.code)) {
        j.sizes.push({ ...extra });
        seen.add(extra.code);
      }
    }
  } else {
    j.sizes = DEFAULT_SIZES.map((s) => ({ ...s }));
  }

  if (!j.currency) j.currency = "BDT";
  if (!Array.isArray(data.orders)) data.orders = [];
  return data;
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(emptyDb(), null, 2));
  }
}

function read() {
  ensure();
  const data = migrate(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
  return data;
}

function write(db) {
  ensure();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = { read, write, DATA_DIR };
