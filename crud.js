const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});


// ======================
// CRUD untuk CONTEXT
// ======================

// Tampilkan semua data context
router.get('/context', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM context ORDER BY id DESC');
    res.render('index', { prompts: rows });
});

// Tampilkan form tambah context
router.get('/context/new', (req, res) => {
    res.render('form', { prompt: {}, action: '/context/new' });
});

// Proses tambah context
router.post('/context/new', async (req, res) => {
    const { context, kategori } = req.body;
    await db.query('INSERT INTO context (context, kategori) VALUES (?, ?)', [context, kategori]);
    res.redirect('/context');
});

// Tampilkan form edit context
router.get('/context/edit/:id', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM context WHERE id = ?', [req.params.id]);
    res.render('form', { prompt: rows[0], action: '/context/edit/' + req.params.id });
});

// Proses update context
router.post('/context/edit/:id', async (req, res) => {
    const { context, kategori } = req.body;
    await db.query('UPDATE context SET context = ?, kategori = ? WHERE id = ?', [context, kategori, req.params.id]);
    res.redirect('/context');
});

// Hapus context
router.get('/context/delete/:id', async (req, res) => {
    await db.query('DELETE FROM context WHERE id = ?', [req.params.id]);
    res.redirect('/context');
});


// ======================
// CRUD untuk SYSTEM_PROMPT
// ======================

// Tampilkan semua data system_prompt
router.get('/system_prompt', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM system_prompt ORDER BY id DESC');
    res.render('system-index', { prompts: rows });
});

// Tampilkan form edit system_prompt
router.get('/system_prompt/edit/:id', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM system_prompt WHERE id = ?', [req.params.id]);
    res.render('system-form', { prompt: rows[0], action: '/system_prompt/edit/' + req.params.id });
});

// Proses update system_prompt
router.post('/system_prompt/edit/:id', async (req, res) => {
    const { prompt } = req.body;
    await db.query('UPDATE system_prompt SET prompt = ? WHERE id = ?', [prompt, req.params.id]);
    res.redirect('/system_prompt');
});

// ======================
// CRUD untuk USERS
// ======================

const bcrypt = require('bcryptjs');

// Tampilkan semua user
router.get('/users', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users ORDER BY id DESC');
        res.render('users-index', { users: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengambil data users');
    }
});

// Form tambah user
router.get('/users/add', (req, res) => {
    res.render('users-form', { 
        user: {}, 
        action: '/users/add' 
    });
});

// Proses tambah user
router.post('/users/add', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Pastikan password tidak kosong
        if (!password || password.trim() === "") {
            return res.status(400).send('Password wajib diisi');
        }

        // Simpan password dalam bentuk hash
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            'INSERT INTO users (username, password) VALUES (?, ?)', 
            [username, hashedPassword]
        );

        res.redirect('/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menambahkan user');
    }
});

// Form edit user
router.get('/users/edit/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE id = ?', 
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).send('User tidak ditemukan');
        }

        res.render('users-form', { 
            user: rows[0], 
            action: '/users/edit/' + req.params.id 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengambil data user');
    }
});

// Proses update user
router.post('/users/edit/:id', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (password && password.trim() !== "") {
            // Update dengan password baru
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE users SET username = ?, password = ? WHERE id = ?', 
                [username, hashedPassword, req.params.id]
            );
        } else {
            // Update tanpa mengubah password
            await db.query(
                'UPDATE users SET username = ? WHERE id = ?', 
                [username, req.params.id]
            );
        }

        res.redirect('/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengupdate user');
    }
});

// Hapus user
router.get('/users/delete/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.redirect('/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menghapus user');
    }
});




module.exports = router;
