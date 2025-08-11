const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config(); // supaya bisa pakai env di sini juga

// Buat koneksi pool di sini
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.get('/', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
    const username = req.body.username?.trim();
    const password = req.body.password?.trim();

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.send('Login gagal, username tidak ditemukan!');
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.send('Login gagal, password salah!');
        }

        // ✅ Simpan ke session
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        res.redirect('/context');
    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).send('Terjadi kesalahan server');
    }
});


router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});


module.exports = router;
