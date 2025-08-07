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
router.get('/', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM context ORDER BY id DESC');
    res.render('index', { prompts: rows });
});

// Tampilkan form tambah context
router.get('/new', (req, res) => {
    res.render('form', { prompt: {}, action: '/crud/new' });
});

// Proses tambah context
router.post('/new', async (req, res) => {
    const { context, kategori } = req.body;
    await db.query('INSERT INTO context (context, kategori) VALUES (?, ?)', [context, kategori]);
    res.redirect('/crud');
});

// Tampilkan form edit context
router.get('/edit/:id', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM context WHERE id = ?', [req.params.id]);
    res.render('form', { prompt: rows[0], action: '/crud/edit/' + req.params.id });
});

// Proses update context
router.post('/edit/:id', async (req, res) => {
    const { context, kategori } = req.body;
    await db.query('UPDATE context SET context = ?, kategori = ? WHERE id = ?', [context, kategori, req.params.id]);
    res.redirect('/crud');
});

// Hapus context
router.get('/delete/:id', async (req, res) => {
    await db.query('DELETE FROM context WHERE id = ?', [req.params.id]);
    res.redirect('/crud');
});


// ======================
// CRUD untuk SYSTEM_PROMPT
// ======================

// Tampilkan semua data system_prompt
router.get('/system', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM system_prompt ORDER BY id DESC');
    res.render('system-index', { prompts: rows });
});


// Tampilkan form edit system_prompt
router.get('/system/edit/:id', async (req, res) => {
    const [rows] = await db.query('SELECT * FROM system_prompt WHERE id = ?', [req.params.id]);
    res.render('system-form', { prompt: rows[0], action: '/crud/system/edit/' + req.params.id });
});

// Proses update system_prompt
router.post('/system/edit/:id', async (req, res) => {
    const { prompt } = req.body;
    await db.query('UPDATE system_prompt SET prompt = ? WHERE id = ?', [prompt, req.params.id]);
    res.redirect('/crud/system');
});



module.exports = router;
