require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const axios = require('axios');
const mysql = require('mysql2/promise');
const session = require('express-session');




let currentQR = null;
let isConnected = false;
let connectedNumber = null;

// ✅ Import route 
const authRoutes = require('./auth');
const crudRoutes = require('./crud');


// ✅ Database pool (lebih cepat)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ✅ Simpan session WA (tidak hapus auth)
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') })
});

// ✅ EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
    secret: 'rahasia-super-aman', // ganti dengan string random
    resave: false,
    saveUninitialized: false
}));

// Middleware untuk proteksi route
app.use((req, res, next) => {
    // Kalau sudah login, lanjut
    if (req.session.user) {
        return next();
    }

    // Boleh akses halaman login dan /
    if (req.path === '/login' || req.path === '/') {
        return next();
    }

    // Kalau belum login, redirect ke login
    res.redirect('/login');
});


app.use('/', authRoutes);
app.use('/', crudRoutes);






// ===============================
// SYSTEM PROMPT (pakai cache)
// ===============================
let promptCache = { data: null, lastUpdate: 0 };

async function getSystemPrompt() {
    const now = Date.now();
    if (promptCache.data && (now - promptCache.lastUpdate) < 60000) {
        return promptCache.data; // pakai cache 1 menit
    }

    const [introRows] = await db.query(`SELECT prompt FROM system_prompt ORDER BY id DESC LIMIT 1`);
    const [rows] = await db.query(`
        SELECT kategori, context FROM context 
        WHERE kategori IN ('pricelist', 'faq', 'tutorial') 
        ORDER BY kategori, id ASC
    `);

    let prompt = introRows.length > 0
        ? introRows[0].prompt + '\n\n'
        : `Kamu adalah asisten virtual resmi Boothlab...`;

    const grouped = rows.reduce((acc, row) => {
        if (!acc[row.kategori]) acc[row.kategori] = [];
        acc[row.kategori].push(`- ${row.context}`);
        return acc;
    }, {});

    for (const [kategori, items] of Object.entries(grouped)) {
        prompt += `📌 *${kategori.toUpperCase()}*\n${items.join('\n')}\n\n`;
    }

    promptCache = { data: prompt, lastUpdate: now };
    return prompt;
}

const chatHistory = {};
function ringkasJawaban(teks) {
    return teks.length > 1500 ? teks.substring(0, 1400) + '...' : teks;
}

// ===============================
// WHATSAPP BOT EVENTS
// ===============================
client.on('qr', async (qr) => {
    try {
        const qrImageDataUrl = await QRCode.toDataURL(qr);
        currentQR = qrImageDataUrl;
        isConnected = false;
        qrcodeTerminal.generate(qr, { small: true });
        console.log('✅ Scan QR code di atas untuk login WhatsApp.');
    } catch (err) {
        console.error('❌ Gagal buat QR image:', err.message);
    }
});

client.on('ready', async () => {
    isConnected = true;
    const info = await client.info;
    connectedNumber = info.wid.user;
    console.log(`🤖 Bot siap digunakan! Terhubung ke nomor: ${connectedNumber}`);
});

client.on('message', async (message) => {
    if (message.fromMe) return;

    const userId = message.from;
    const userMessage = message.body.trim();
    if (!userMessage) return;

    if (!chatHistory[userId]) chatHistory[userId] = [];
    chatHistory[userId].push({ role: 'user', content: userMessage });

    if (chatHistory[userId].length > 10) {
        chatHistory[userId] = chatHistory[userId].slice(-10);
    }

    try {
        const systemContent = await getSystemPrompt();
        const messages = [
            { role: "system", content: systemContent },
            ...chatHistory[userId]
        ];

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: "openai/gpt-3.5-turbo",
                messages
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const reply = response.data.choices?.[0]?.message?.content || '';
        const irrelevantTriggers = [
            'maaf',
            'saya hanya bisa membantu seputar layanan Boothlab',
            'bukan bagian dari layanan Boothlab',
            'silakan hubungi admin'
        ];

        const isIrrelevant = irrelevantTriggers.some(t => reply.toLowerCase().includes(t.toLowerCase()));

        const finalReply = isIrrelevant
            ? `😊 Untuk bantuan lebih lanjut, silakan hubungi admin: 👉 https://wa.me/6289516042702`
            : ringkasJawaban(reply);

        if (isIrrelevant) {
            try {
                const nomer = userId.replace('@c.us', '');
                await db.query('INSERT INTO unanswered_messages (nomer, message) VALUES (?, ?)', [
                    nomer,
                    userMessage
                ]);
                console.log('📝 Pesan tidak terjawab disimpan:', userMessage);
            } catch (err) {
                console.error('❌ Gagal simpan pesan tidak terjawab:', err.message);
            }
        }

        chatHistory[userId].push({ role: 'assistant', content: finalReply });
        await message.reply(finalReply);

    } catch (error) {
        console.error('❌ Error OpenRouter:', error.response?.data || error.message);
        await message.reply(`Untuk bantuan lebih lanjut, hubungi admin: 👉 https://wa.me/6289516042702`);
    }
});

client.initialize();

// ===============================
// ROUTES
// ===============================
app.get('/unanswered', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM unanswered_messages ORDER BY created_at DESC');
        res.render('unanswered', { messages: rows });
    } catch (err) {
        console.error('❌ Gagal ambil data unanswered_messages:', err.message);
        res.status(500).send('Terjadi kesalahan saat mengambil data.');
    }
});

app.get('/connect', (req, res) => {
    res.render('connect', {
        qr: currentQR,
        isConnected,
        connectedNumber
    });
});

const fs = require('fs');

app.post('/reset-auth', async (req, res) => {
    try {
        const authPath = path.join(__dirname, '.wwebjs_auth');

        // Stop dulu client
        await client.destroy();
        console.log('🛑 Client WhatsApp dimatikan.');

        // Hapus folder auth
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('🧹 Folder .wwebjs_auth berhasil dihapus.');
        }

        // Reset variabel status
        currentQR = null;
        isConnected = false;
        connectedNumber = null;

        // Start ulang client
        client.initialize();
        console.log('♻️ Client WhatsApp diinisialisasi ulang.');

        res.redirect('/connect');
    } catch (err) {
        console.error('❌ Gagal reset auth:', err.message);
        res.status(500).send('Gagal reset auth.');
    }
});



// ===============================
// START SERVER
// ===============================
app.listen(3000, () => {
    console.log('🌐 Server berjalan di http://localhost:3000');
});
