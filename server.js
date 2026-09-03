const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const app = express();
const db = new Database(process.env.DB_FILE || "award.sqlite");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CHANGE-ME-NOW";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.use(express.json({limit:"100kb"}));
app.use(express.urlencoded({extended:true}));

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  event_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  gender TEXT,
  department TEXT NOT NULL,
  ready TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);
`);

function now(){ return new Date().toISOString(); }
function sign(value){
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}
function makeToken(){
  const payload = Buffer.from(JSON.stringify({u:ADMIN_USER, exp:Date.now()+8*60*60*1000})).toString("base64url");
  return payload + "." + sign(payload);
}
function validToken(token){
  if(!token) return false;
  const [payload, sig] = token.split(".");
  if(!payload || !sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload,"base64url").toString());
    return data.u === ADMIN_USER && data.exp > Date.now();
  } catch { return false; }
}
function auth(req,res,next){
  const token = req.headers.authorization?.replace(/^Bearer\s+/,"") || req.cookies?.admin;
  if(!validToken(token)) return res.status(401).json({error:"Administrator login required."});
  next();
}

app.get("/api/settings", (req,res)=>{
  const row = db.prepare("SELECT event_at, updated_at FROM settings WHERE id=1").get();
  res.json({eventAt: row?.event_at || null, updatedAt: row?.updated_at || null});
});

app.post("/api/register", (req,res)=>{
  const {fullName,email,phone,gender,department,ready,comment} = req.body || {};
  if(!fullName || !email || !department || !ready)
    return res.status(400).json({error:"Please complete all required fields."});
  if(String(fullName).length>120 || String(email).length>160 || String(comment||"").length>1000)
    return res.status(400).json({error:"One or more fields are too long."});
  db.prepare(`
    INSERT INTO registrations(full_name,email,phone,gender,department,ready,comment,created_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(fullName,email,phone||"",gender||"",department,ready,comment||"",now());
  res.json({ok:true});
});

app.post("/api/admin/login",(req,res)=>{
  const {username,password}=req.body || {};
  const a=Buffer.from(String(password||""));
  const b=Buffer.from(ADMIN_PASSWORD);
  const good=username===ADMIN_USER && a.length===b.length && crypto.timingSafeEqual(a,b);
  if(!good) return res.status(401).json({error:"Invalid administrator credentials."});
  res.json({ok:true,token:makeToken()});
});

app.get("/api/admin/settings",auth,(req,res)=>{
  const row=db.prepare("SELECT event_at,updated_at FROM settings WHERE id=1").get();
  res.json({eventAt:row?.event_at||null,updatedAt:row?.updated_at||null});
});

app.post("/api/admin/settings",auth,(req,res)=>{
  const {eventAt}=req.body || {};
  if(!eventAt || Number.isNaN(new Date(eventAt).getTime()))
    return res.status(400).json({error:"Enter a valid event date and time."});
  db.prepare(`
    INSERT INTO settings(id,event_at,updated_at) VALUES(1,?,?)
    ON CONFLICT(id) DO UPDATE SET event_at=excluded.event_at,updated_at=excluded.updated_at
  `).run(new Date(eventAt).toISOString(),now());
  res.json({ok:true,eventAt:new Date(eventAt).toISOString()});
});

app.get("/api/admin/registrations",auth,(req,res)=>{
  const rows=db.prepare(`
    SELECT id,full_name AS fullName,email,phone,gender,department,ready,comment,created_at AS createdAt
    FROM registrations ORDER BY id DESC LIMIT 500
  `).all();
  res.json(rows);
});

app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`Head of State Award site running on port ${PORT}`));
