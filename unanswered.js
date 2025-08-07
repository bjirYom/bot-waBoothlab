const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM unanswered_messages ORDER BY created_at DESC');
    res.render('unanswered', { messages: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Terjadi kesalahan saat mengambil data.');
  }
});

module.exports = router;
