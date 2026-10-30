const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

function configReady() {
  return SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && ADMIN_USER &&
    ADMIN_PASSWORD && ADMIN_PASSWORD !== "CHANGE-ME-NOW" &&
    SESSION_SECRET && SESSION_SECRET.length >= 32;
}
function dbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    ...extra
  };
}
async function dbRequest(path, options = {}) {
  const response = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
    ...options,
    headers: dbHeaders(options.headers || {})
  });
  const body = await response.text();
  if (!response.ok) {
    console.error("Supabase request failed:", response.status, body.slice(0, 500));
    throw new Error("Database request failed");
  }
  return body ? JSON.parse(body) : null;
}
function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}
function makeToken() {
  const payload = Buffer.from(JSON.stringify({
    u: ADMIN_USER, exp: Date.now() + 8 * 60 * 60 * 1000
  })).toString("base64url");
  return payload + "." + sign(payload);
}
function validToken(token) {
  if (!token || !SESSION_SECRET) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.u === ADMIN_USER && data.exp > Date.now();
  } catch { return false; }
}
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!validToken(token)) return res.status(401).json({ error: "Administrator login required." });
  next();
}
app.get("/api/health", (req, res) => {
  res.json({ ok: true, configured: Boolean(configReady()) });
});
app.get("/api/settings", async (req, res) => {
  if (!configReady()) return res.status(503).json({ error: "The registration service is not configured yet." });
  try {
    const rows = await dbRequest("award_settings?select=event_at&id=eq.1");
    res.json({ eventAt: rows[0]?.event_at || null, updatedAt: rows[0]?.updated_at || null });
  } catch { res.status(503).json({ error: "Could not load event settings." }); }
});
app.post("/api/register", async (req, res) => {
  if (!configReady()) return res.status(503).json({ error: "The registration service is not configured yet." });
  try {
    const data = { ...(req.body || {}) };
    const required = ["fullName", "email", "department", "awardSelection", "ready"];
    if (required.some(key => !String(data[key] || "").trim())) {
      return res.status(400).json({ error: "Please complete all required fields." });
    }
    if (String(data.fullName).length > 120 || String(data.email).length > 160 ||
        String(data.comment || "").length > 1000 || String(data.address || "").length > 500 ||
        String(data.previousExperienceDetails || "").length > 1000) {
      return res.status(400).json({ error: "One or more fields are too long." });
    }
    if (data.passportPhoto && (!/^data:image\/(jpeg|png|webp);base64,/i.test(data.passportPhoto) ||
        data.passportPhoto.length > 1400000)) {
      return res.status(400).json({ error: "Please upload a JPG, PNG or WEBP passport photo under 1 MB." });
    }
    await dbRequest("award_registrations", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ data })
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({ error: "Could not save registration. Please try again." });
  }
});
app.post("/api/admin/login", (req, res) => {
  if (!configReady()) return res.status(503).json({ error: "Administrator service is not configured." });
  const { username, password } = req.body || {};
  const a = Buffer.from(String(password || ""));
  const b = Buffer.from(ADMIN_PASSWORD);
  const good = username === ADMIN_USER && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!good) return res.status(401).json({ error: "Invalid administrator credentials." });
  res.json({ ok: true, token: makeToken() });
});
app.get("/api/admin/settings", auth, async (req, res) => {
  try {
    const rows = await dbRequest("award_settings?select=event_at,updated_at&id=eq.1");
    res.json({ eventAt: rows[0]?.event_at || null, updatedAt: rows[0]?.updated_at || null });
  } catch { res.status(500).json({ error: "Could not load settings." }); }
});
app.post("/api/admin/settings", auth, async (req, res) => {
  const eventAt = req.body?.eventAt;
  if (!eventAt || Number.isNaN(new Date(eventAt).getTime())) {
    return res.status(400).json({ error: "Enter a valid event date and time." });
  }
  try {
    const value = new Date(eventAt).toISOString();
    await dbRequest("award_settings?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: 1, event_at: value, updated_at: new Date().toISOString() })
    });
    res.json({ ok: true, eventAt: value });
  } catch { res.status(500).json({ error: "Could not save countdown." }); }
});
app.get("/api/admin/registrations", auth, async (req, res) => {
  try {
    const rows = await dbRequest("award_registrations?select=id,data,created_at&order=id.desc&limit=500");
    res.json(rows.map(row => ({ id: row.id, ...row.data, createdAt: row.created_at })));
  } catch { res.status(500).json({ error: "Could not load registrations." }); }
});
app.use(express.static("public"));
app.get("*", (req, res) => res.sendFile(require("path").join(process.cwd(), "public", "index.html")));

module.exports = app;
