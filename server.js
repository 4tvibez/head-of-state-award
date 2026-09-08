const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

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


/* ================================
   UPLOAD DIRECTORY
================================ */

const uploadDir =
  path.join(__dirname, "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}


/* ================================
   PASSPORT PHOTO UPLOAD
================================ */

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {

    const extension =
      path.extname(file.originalname)
        .toLowerCase();

    const uniqueName =
      "passport-" +
      Date.now() +
      "-" +
      crypto.randomBytes(6).toString("hex") +
      extension;

    cb(null, uniqueName);
  }

});


const upload = multer({

  storage: storage,

  limits: {
    fileSize: 2 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    if (
      file.mimetype &&
      file.mimetype.startsWith("image/")
    ) {

      cb(null, true);

    } else {

      cb(
        new Error(
          "Only image files are allowed."
        )
      );

    }

  }

});


/* ================================
   BODY PARSING
================================ */

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);


/* ================================
   DATABASE
================================ */

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


/* ================================
   EXISTING DATABASE COLUMNS
================================ */

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

  const columns =
    db.prepare(
      "PRAGMA table_info(registrations)"
    ).all();

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


/* ================================
   HELPERS
================================ */

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

  const payload =
    Buffer.from(
      JSON.stringify({

        u: ADMIN_USER,

        exp:
          Date.now() +
          8 * 60 * 60 * 1000

      })
    ).toString("base64url");


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


  if (parts.length !== 2) {
    return false;
  }


  const [payload, sig] =
    parts;


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
        Buffer.from(
          payload,
          "base64url"
        ).toString()
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

    return res.status(401).json({

      error:
        "Administrator login required."

    });

  }


  next();

}


/* ================================
   PUBLIC SETTINGS
================================ */

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
        row?.event_at || null,

      updatedAt:
        row?.updated_at || null

    });

  }
);


/* ================================
   REGISTRATION
================================ */

app.post(
  "/api/register",
  upload.single("passportPhoto"),
  (req, res) => {

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
      consentDate

    } = req.body || {};


    /* REQUIRED FIELDS */

    if (
      !fullName ||
      !email ||
      !department ||
      !awardSelection ||
      !ready
    ) {

      if (req.file) {

        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}

      }

      return res.status(400).json({

        error:
          "Please complete all required fields."

      });

    }


    /* VALID AWARD */

    const validAwards = [
      "Bronze",
      "Silver",
      "Gold"
    ];


    if (
      !validAwards.includes(
        String(awardSelection)
      )
    ) {

      if (req.file) {

        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}

      }

      return res.status(400).json({

        error:
          "Please select a valid award."

      });

    }


    /* FIELD LENGTH PROTECTION */

    if (

      String(fullName).length > 120 ||

      String(email).length > 160 ||

      String(comment || "").length > 1000 ||

      String(address || "").length > 500 ||

      String(previousExperienceDetails || "").length > 1000 ||

      String(surname || "").length > 120 ||

      String(firstName || "").length > 120 ||

      String(guardianName || "").length > 160

    ) {

      if (req.file) {

        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}

      }

      return res.status(400).json({

        error:
          "One or more fields are too long."

      });

    }


    /* PHOTO PATH */

    const passportPhoto =
      req.file
        ? "/uploads/" + req.file.filename
        : "";


    /* SAVE REGISTRATION */

    try {

      db.prepare(`
        INSERT INTO registrations(

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

        VALUES(
          ?,
          ?,
          ?,
          ?,
          ?,

          ?,

          ?,
          ?,

          ?,

          ?,
          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          ?,

          ?
        )

      `).run(

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

        passportPhoto

      );


      res.json({

        ok: true,

        message:
          "Registration submitted successfully."

      });


    } catch (error) {

      console.error(
        "Registration database error:",
        error
      );


      if (req.file) {

        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}

      }


      res.status(500).json({

        error:
          "Could not save registration. Please try again."

      });

    }

  }
);


/* ================================
   ADMIN LOGIN
================================ */

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

      return res.status(401).json({

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


/* ================================
   ADMIN SETTINGS
================================ */

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
        row?.event_at || null,

      updatedAt:
        row?.updated_at || null

    });

  }
);


/* ================================
   SAVE EVENT DATE
================================ */

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

      return res.status(400).json({

        error:
          "Enter a valid event date and time."

      });

    }


    const iso =
      new Date(
        eventAt
      ).toISOString();


    db.prepare(`
      INSERT INTO settings(
        id,
        event_at,
        updated_at
      )

      VALUES(
        1,
        ?,
        ?
      )

      ON CONFLICT(id)
      DO UPDATE SET

        event_at =
          excluded.event_at,

        updated_at =
          excluded.updated_at

    `).run(

      iso,
      now()

    );


    res.json({

      ok: true,

      eventAt: iso

    });

  }
);


/* ================================
   ADMIN REGISTRATIONS
================================ */

app.get(
  "/api/admin/registrations",
  auth,
  (req, res) => {

    const rows =
      db.prepare(`
        SELECT

          id,

          full_name AS fullName,
          email,
          phone,
          gender,
          department,

          award_selection AS awardSelection,

          ready,
          comment,

          created_at AS createdAt,

          surname,

          first_name AS firstName,

          address,

          home_phone AS homePhone,
          mobile_phone AS mobilePhone,

          date_of_birth AS dateOfBirth,
          age,

          award_unit AS awardUnit,
          award_level AS awardLevel,

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

      `).all();


    res.json(rows);

  }
);


/* ================================
   STATIC WEBSITE
================================ */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


/* ================================
   ERROR HANDLER
================================ */

app.use(
  (error, req, res, next) => {

    console.error(
      "Server error:",
      error
    );


    if (
      error instanceof multer.MulterError
    ) {

      if (
        error.code === "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({

          error:
            "Passport photo is too large. Maximum size is 2MB."

        });

      }

    }


    if (
      error.message ===
      "Only image files are allowed."
    ) {

      return res.status(400).json({

        error:
          "Please select an image file for the passport photo."

      });

    }


    res.status(500).json({

      error:
        "Something went wrong. Please try again."

    });

  }
);


/* ================================
   WEBSITE FALLBACK
================================ */

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


/* ================================
   START SERVER
================================ */

app.listen(
  PORT,
  () => {

    console.log(
      `Head of State Award site running on port ${PORT}`
    );

  }
);
