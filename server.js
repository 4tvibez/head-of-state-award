const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const app = express();

const db = new Database(
process.env.DB_FILE || "award.sqlite"
);

const PORT = Number(process.env.PORT || 3000);

const ADMIN_USER =
process.env.ADMIN_USER || "admin";

const ADMIN_PASSWORD =
process.env.ADMIN_PASSWORD || "CHANGE-ME-NOW";

const SESSION_SECRET =
process.env.SESSION_SECRET ||
crypto.randomBytes(32).toString("hex");

/* =========================
MIDDLEWARE
========================= */

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
DATABASE
========================= */

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

award_selection TEXT,

ready TEXT NOT NULL,
comment TEXT,

created_at TEXT NOT NULL
);
`);

/* =========================
ADD NEW COLUMNS SAFELY
========================= */

const newColumns = [
["award_selection", "TEXT"],

["surname", "TEXT"],
["first_name", "TEXT"],
["address", "TEXT"],
["home_phone", "TEXT"],
["mobile_phone", "TEXT"],
["date_of_birth", "TEXT"],
["age", "TEXT"],
["award_unit", "TEXT"],
["award_level", "TEXT"],

["previous_experience", "TEXT"],
["previous_experience_details", "TEXT"],

["guardian_name", "TEXT"],
["guardian_contact", "TEXT"],
["guardian_consent", "TEXT"],
["consent_date", "TEXT"],

["passport_photo", "TEXT"]
];

for (const [name, type] of newColumns) {

const columns = db
.prepare("PRAGMA table_info(registrations)")
.all();

if (
!columns.some(
column => column.name === name
)
) {

db.exec(
  `ALTER TABLE registrations ADD COLUMN ${name} ${type}`
);

}

}

/* =========================
HELPERS
========================= */

function now() {
return new Date().toISOString();
}

function sign(value) {

return crypto
.createHmac(
"sha256",
SESSION_SECRET
)
.update(value)
.digest("base64url");

}

function makeToken() {

const payload = Buffer
.from(
JSON.stringify({
u: ADMIN_USER,
exp:
Date.now() +
8 * 60 * 60 * 1000
})
)
.toString("base64url");

return (
payload +
"." +
sign(payload)
);

}

function validToken(token) {

if (!token) {
return false;
}

const parts =
token.split(".");

const payload = parts[0];
const sig = parts[1];

if (!payload || !sig) {
return false;
}

const expected =
sign(payload);

if (
sig.length !==
expected.length
) {

return false;

}

if (
!crypto.timingSafeEqual(
Buffer.from(sig),
Buffer.from(expected)
)
) {

return false;

}

try {

const data =
  JSON.parse(
    Buffer
      .from(
        payload,
        "base64url"
      )
      .toString()
  );


return (
  data.u === ADMIN_USER &&
  data.exp > Date.now()
);

} catch {

return false;

}

}

function auth(req, res, next) {

const token =
req.headers.authorization
?.replace(
/^Bearer\s+/,
""
);

if (!validToken(token)) {

return res
  .status(401)
  .json({
    error:
      "Administrator login required."
  });

}

next();

}

/* =========================
PUBLIC SETTINGS
========================= */

app.get(
"/api/settings",
(req, res) => {

const row =
  db.prepare(
    `
    SELECT
      event_at,
      updated_at
    FROM settings
    WHERE id=1
    `
  ).get();


res.json({

  eventAt:
    row?.event_at ||
    null,

  updatedAt:
    row?.updated_at ||
    null

});

}
);

/* =========================
REGISTRATION
========================= */

app.post(
"/api/register",
(req, res) => {

try {

  const {

    fullName,
    email,
    phone,
    gender,

    department,

    awardSelection,

    ready,
    comment,

    surname,
    firstName,
    address,
    homePhone,
    mobilePhone,

    dateOfBirth,
    age,

    awardUnit,
    awardLevel,

    previousExperience,
    previousExperienceDetails,

    guardianName,
    guardianContact,

    guardianConsent,
    consentDate,

    passportPhoto

  } = req.body || {};


  /* REQUIRED FIELDS */

  if (
    !fullName ||
    !email ||
    !department ||
    !awardSelection ||
    !ready
  ) {

    return res
      .status(400)
      .json({

        error:
          "Please complete all required fields."

      });

  }


  /* LENGTH CHECKS */

  if (
    String(fullName).length >
    120 ||

    String(email).length >
    160 ||

    String(comment || "").length >
    1000 ||

    String(address || "").length >
    500 ||

    String(
      previousExperienceDetails || ""
    ).length > 1000
  ) {

    return res
      .status(400)
      .json({

        error:
          "One or more fields are too long."

      });

  }


  /* PASSPORT PHOTO SIZE */

  if (
    passportPhoto &&
    String(passportPhoto).length >
    1400000
  ) {

    return res
      .status(400)
      .json({

        error:
          "Passport photo is too large. Please choose a smaller photo."

      });

  }


  /* SAVE REGISTRATION */

  db.prepare(
    `
    INSERT INTO registrations (

      full_name,
      email,
      phone,
      gender,
      department,

      award_selection,

      ready,
      comment,

      created_at,

      surname,
      first_name,
      address,
      home_phone,
      mobile_phone,

      date_of_birth,
      age,

      award_unit,
      award_level,

      previous_experience,
      previous_experience_details,

      guardian_name,
      guardian_contact,

      guardian_consent,
      consent_date,

      passport_photo

    )

    VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
    `
  ).run(

    fullName,
    email,

    phone || "",
    gender || "",

    department,

    awardSelection,

    ready,
    comment || "",

    now(),

    surname || "",
    firstName || "",
    address || "",
    homePhone || "",
    mobilePhone || "",

    dateOfBirth || "",
    age || "",

    awardUnit || "",
    awardLevel || "",

    previousExperience || "",
    previousExperienceDetails || "",

    guardianName || "",
    guardianContact || "",

    guardianConsent || "",
    consentDate || "",

    passportPhoto || ""

  );


  res.json({
    ok: true
  });


} catch (error) {

  console.error(
    "Registration error:",
    error
  );


  res
    .status(500)
    .json({

      error:
        "Could not save registration."

    });

}

}
);

/* =========================
ADMIN LOGIN
========================= */

app.post(
"/api/admin/login",
(req, res) => {

const {
  username,
  password
} = req.body || {};


const a =
  Buffer.from(
    String(password || "")
  );

const b =
  Buffer.from(
    ADMIN_PASSWORD
  );


const good =
  username === ADMIN_USER &&
  a.length === b.length &&
  crypto.timingSafeEqual(
    a,
    b
  );


if (!good) {

  return res
    .status(401)
    .json({

      error:
        "Invalid administrator credentials."

    });

}


res.json({

  ok: true,

  token:
    makeToken()

});

}
);

/* =========================
ADMIN SETTINGS
========================= */

app.get(
"/api/admin/settings",
auth,
(req, res) => {

const row =
  db.prepare(
    `
    SELECT
      event_at,
      updated_at
    FROM settings
    WHERE id=1
    `
  ).get();


res.json({

  eventAt:
    row?.event_at ||
    null,

  updatedAt:
    row?.updated_at ||
    null

});

}
);

/* =========================
SAVE EVENT DATE
========================= */

app.post(
"/api/admin/settings",
auth,
(req, res) => {

const {
  eventAt
} = req.body || {};


if (
  !eventAt ||
  Number.isNaN(
    new Date(eventAt).getTime()
  )
) {

  return res
    .status(400)
    .json({

      error:
        "Enter a valid event date and time."

    });

}


db.prepare(
  `
  INSERT INTO settings (
    id,
    event_at,
    updated_at
  )

  VALUES (1,?,?)

  ON CONFLICT(id)
  DO UPDATE SET

    event_at =
      excluded.event_at,

    updated_at =
      excluded.updated_at
  `
).run(

  new Date(
    eventAt
  ).toISOString(),

  now()

);


res.json({

  ok: true,

  eventAt:
    new Date(
      eventAt
    ).toISOString()

});

}
);

/* =========================
ADMIN REGISTRATIONS
========================= */

app.get(
"/api/admin/registrations",
auth,
(req, res) => {

try {

  const rows =
    db.prepare(
      `
      SELECT

        id,

        full_name AS fullName,

        email,
        phone,
        gender,

        department,

        award_selection
          AS awardSelection,

        ready,
        comment,

        created_at
          AS createdAt,

        surname,

        first_name
          AS firstName,

        address,

        home_phone
          AS homePhone,

        mobile_phone
          AS mobilePhone,

        date_of_birth
          AS dateOfBirth,

        age,

        award_unit
          AS awardUnit,

        award_level
          AS awardLevel,

        previous_experience
          AS previousExperience,

        previous_experience_details
          AS previousExperienceDetails,

        guardian_name
          AS guardianName,

        guardian_contact
          AS guardianContact,

        guardian_consent
          AS guardianConsent,

        consent_date
          AS consentDate,

        passport_photo
          AS passportPhoto

      FROM registrations

      ORDER BY id DESC

      LIMIT 500
      `
    ).all();


  res.json(rows);


} catch (error) {

  console.error(
    "Admin registrations error:",
    error
  );


  res
    .status(500)
    .json({

      error:
        "Could not load registrations."

    });

}

}
);

/* =========================
STATIC WEBSITE
========================= */

app.use(
express.static(
path.join(
__dirname,
"public"
)
)
);

app.get(
"*",
(req, res) => {

res.sendFile(
  path.join(
    __dirname,
    "public",
    "index.html"
  )
);

}
);

/* =========================
START SERVER
========================= */

app.listen(
PORT,
() => {

console.log(
  `Head of State Award site running on port ${PORT}`
);

}
);
