/**
 * NirogAI — Node.js Backend Entry Point
 * =======================================
 * File: backend/server.js
 *
 * Install dependencies (run once in /backend folder):
 *   npm install express axios pg dotenv jsonwebtoken bcryptjs cors
 *
 * Create a .env file in /backend with:
 *   PORT=5000
 *   PG_HOST=localhost
 *   PG_PORT=5432
 *   PG_DB=nirogai
 *   PG_USER=postgres
 *   PG_PASSWORD=yourpassword
 *   JWT_SECRET=your_super_secret_key_min_32_chars
 *   ML_SERVICE_URL=http://localhost:8000
 *   NODE_ENV=development
 *
 * Run: node server.js
 */

const express  = require('express');
const cors     = require('cors');
const dotenv   = require('dotenv');
dotenv.config();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',  // React dev server
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ── Routes ────────────────────────────────────────────────────────────────────
const authRoute     = require('./routes/auth');
const diabetesRoute = require('./routes/diabetes');
// const anemiaRoute   = require('./routes/anemia');   ← uncomment when ready
// const skinRoute     = require('./routes/skin');     ← uncomment when ready

app.use('/api/auth',            authRoute);
app.use('/api/screen/diabetes', diabetesRoute);
// app.use('/api/screen/anemia', anemiaRoute);
// app.use('/api/screen/skin',   skinRoute);


// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status:  'ok',
        service: 'NirogAI Backend',
        time:    new Date().toISOString()
    });
});


// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});


// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});


// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ NirogAI Backend running on port ${PORT}`);
    console.log(`   ML Service URL: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);
    console.log(`   Environment:    ${process.env.NODE_ENV || 'development'}`);
});
