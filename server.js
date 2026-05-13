// ─────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const pool = require('./db');

const app = express();
const PORT = 3005;

// ─────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────
// ADMIN
// ─────────────────────────────────────

const ADMIN = {
  name: "admin",
  password: "1998"
};

// ─────────────────────────────────────
// TOKEN AUTH MIDDLEWARE
// ─────────────────────────────────────

async function requireAuth(req, res, next) {

  const token = req.headers['x-session-token'];
  const userId = req.headers['x-user-id'];

  if (!token || !userId) {

    return res.status(401).json({
      success: false,
      message: "Not authenticated"
    });

  }

  try {

    const result = await pool.query(

      `
      SELECT session_token
      FROM users
      WHERE id=$1
      `,

      [userId]

    );

    if (

      result.rows.length === 0 ||

      result.rows[0].session_token !== token

    ) {

      return res.status(401).json({

        success: false,
        message: "Session expired. Another login detected."

      });

    }

    next();

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });

  }

}

// ─────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────

app.post('/api/admin/login', (req, res) => {

  const { name, password } = req.body;

  if (

    name === ADMIN.name &&
    password === ADMIN.password

  ) {

    return res.json({
      success: true
    });

  }

  res.json({
    success: false,
    message: "Invalid credentials"
  });

});

// ─────────────────────────────────────
// USER LOGIN
// BLOCK SECOND ATTEMPT
// ─────────────────────────────────────

app.post('/api/login', async (req, res) => {

  try {

    const { name, password } = req.body;

    // CHECK USER

    const userResult = await pool.query(

      `
      SELECT *
      FROM users
      WHERE name=$1 AND password=$2
      `,

      [name, password]

    );

    if (userResult.rows.length === 0) {

      return res.json({

        success: false,
        message: 'Invalid login'

      });

    }

    const user = userResult.rows[0];

    // ─────────────────────────────
    // BLOCK SECOND ATTEMPT
    // ─────────────────────────────

    const attemptCheck = await pool.query(

      `
      SELECT id
      FROM results
      WHERE user_id=$1
      LIMIT 1
      `,

      [user.id]

    );

    if (attemptCheck.rows.length > 0) {

      return res.json({

        success: false,
        message: 'You already attended the exam'

      });

    }

    // ─────────────────────────────
    // REMOVE OLD SESSION
    // ─────────────────────────────

    if (user.session_token) {

      await pool.query(

        `
        UPDATE users
        SET session_token=NULL
        WHERE id=$1
        `,

        [user.id]

      );

    }

    // ─────────────────────────────
    // CREATE TOKEN
    // ─────────────────────────────

    const token = crypto.randomUUID();

    await pool.query(

      `
      UPDATE users
      SET session_token=$1
      WHERE id=$2
      `,

      [token, user.id]

    );

    // ─────────────────────────────
    // LOGIN SUCCESS
    // ─────────────────────────────

    res.json({

      success: true,

      user: {

        id: user.id,
        name: user.name,
        rank: user.rank,
        cdcNumber: user.cdcnumber,
        token: token

      }

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,
      message: "DB error"

    });

  }

});

// ─────────────────────────────────────
// SESSION PING
// ─────────────────────────────────────

app.get('/api/ping', requireAuth, (req, res) => {

  res.json({
    success: true
  });

});

// ─────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────

app.post('/api/logout', requireAuth, async (req, res) => {

  const userId = req.headers['x-user-id'];

  try {

    await pool.query(

      `
      UPDATE users
      SET session_token=NULL
      WHERE id=$1
      `,

      [userId]

    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });

  }

});

// ─────────────────────────────────────
// GET USERS
// ─────────────────────────────────────

app.get('/api/users', async (req, res) => {

  try {

    const result = await pool.query(

      `
      SELECT *
      FROM users
      ORDER BY id DESC
      `

    );

    res.json({

      success: true,
      users: result.rows

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });

  }

});

// ─────────────────────────────────────
// CREATE USER
// ─────────────────────────────────────

app.post('/api/users', async (req, res) => {

  const {
    name,
    password,
    rank,
    cdcNumber
  } = req.body;

  if (!name || !password || !cdcNumber) {

    return res.json({

      success: false,
      message: "Missing fields"

    });

  }

  try {

    const exists = await pool.query(

      `
      SELECT *
      FROM users
      WHERE LOWER(name)=LOWER($1)
      `,

      [name.trim()]

    );

    if (exists.rows.length > 0) {

      return res.json({

        success: false,
        message: "User already exists"

      });

    }

    await pool.query(

      `
      INSERT INTO users
      (
        name,
        password,
        rank,
        cdcnumber
      )
      VALUES ($1,$2,$3,$4)
      `,

      [
        name.trim(),
        password.trim(),
        rank || "default",
        cdcNumber.trim()
      ]

    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,
      message: err.message

    });

  }

});

// ─────────────────────────────────────
// DELETE USER
// ─────────────────────────────────────

app.delete('/api/users/:id', async (req, res) => {

  try {

    await pool.query(

      `
      DELETE FROM users
      WHERE id=$1
      `,

      [req.params.id]

    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });

  }

});

// ─────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────

app.patch('/api/users/:id/password', async (req, res) => {

  const adminName = req.headers['x-admin-name'];
  const adminPassword = req.headers['x-admin-password'];

  if (

    adminName !== ADMIN.name ||
    adminPassword !== ADMIN.password

  ) {

    return res.json({

      success: false,
      message: "Admin auth failed"

    });

  }

  const { newPassword } = req.body;

  if (!newPassword) {

    return res.json({

      success: false,
      message: "New password required"

    });

  }

  try {

    await pool.query(

  `
  UPDATE users
  SET password=$1,
      session_token=NULL
  WHERE id=$2
  `,

  [
    newPassword.trim(),
    req.params.id
  ]

);

// REMOVE OLD EXAM RESULT
// ALLOW NEW ATTEMPT

await pool.query(

  `
  DELETE FROM results
  WHERE user_id=$1
  `,

  [req.params.id]

);
    res.json({

      success: true,
      message: "Password updated"

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,
      message: "Server Error"

    });

  }

});

// ─────────────────────────────────────
// SAVE RESULT
// ─────────────────────────────────────

app.post('/api/result', requireAuth, async (req, res) => {

  const {
    user_id,
    user_name,
    rank,
    score,
    correct,
    wrong,
    skipped
  } = req.body;

  const total = correct + wrong + skipped;

  const passed = score >= 50;

  try {

    // BLOCK DUPLICATE RESULT

    const existing = await pool.query(

      `
      SELECT id
      FROM results
      WHERE user_id=$1
      LIMIT 1
      `,

      [user_id]

    );

    if (existing.rows.length > 0) {

      return res.json({

        success: false,
        message: "Second attempt not allowed"

      });

    }

    await pool.query(

      `
      INSERT INTO results
      (
        user_id,
        user_name,
        rank,
        score,
        correct,
        wrong,
        skipped,
        total,
        passed
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,

      [
        user_id,
        user_name,
        rank,
        score,
        correct,
        wrong,
        skipped,
        total,
        passed
      ]

    );

    // AUTO LOGOUT

    await pool.query(

      `
      UPDATE users
      SET session_token=NULL
      WHERE id=$1
      `,

      [user_id]

    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,
      message: err.message

    });

  }

});

// ─────────────────────────────────────
// GET RESULTS

// ─────────────────────────────────────
// GET RESULTS
// ─────────────────────────────────────

app.get('/api/results', async (req, res) => {

  try {

    const result = await pool.query(`

      SELECT 
        results.id,
        users.name AS user_name,
        users.rank,
        users.cdcnumber,
        results.score,
        results.correct,
        results.wrong,
        results.skipped,
        results.passed

      FROM results

      JOIN users
      ON results.user_id = users.id

      ORDER BY results.id DESC

    `);

    res.json({

      success: true,

      results: result.rows

    });

  } catch (err) {

    console.log(err);

    res.status(500).json({

      success: false,
      message: 'Server error'

    });

  }

});

// HOME
// ─────────────────────────────────────

app.get('/', (req, res) => {

  res.sendFile(

    path.join(__dirname, 'public', 'login.html')

  );

});

// ─────────────────────────────────────
// START SERVER
// ─────────────────────────────────────

app.listen(PORT, () => {

  console.log(`

=====================================
🚀 SERVER RUNNING
http://localhost:${PORT}
=====================================

`);

});