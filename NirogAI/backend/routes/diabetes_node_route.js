/**
 * NirogAI — Node.js Backend
 * ==========================
 * File: backend/routes/diabetes.js
 *
 * What this file does:
 *   1. Receives form data from React frontend
 *   2. Calls FastAPI ML service to get prediction
 *   3. Saves result to PostgreSQL
 *   4. Returns result to React frontend
 *
 * Install dependencies (run once):
 *   npm install express axios pg dotenv jsonwebtoken bcryptjs cors
 */

const express = require('express');
const axios   = require('axios');
const { Pool } = require('pg');
const router  = express.Router();

// ── PostgreSQL connection pool ─────────────────────────────────────────────────
// Put your actual credentials in backend/.env — NEVER hardcode them
const pool = new Pool({
    host:     process.env.PG_HOST     || 'localhost',
    port:     process.env.PG_PORT     || 5432,
    database: process.env.PG_DB       || 'nirogai',
    user:     process.env.PG_USER     || 'postgres',
    password: process.env.PG_PASSWORD || 'yourpassword',
    ssl:      process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ML service URL — FastAPI running locally or on HuggingFace Spaces
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ── Auth middleware (checks JWT token) ────────────────────────────────────────
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;   // { id, email, name }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}


// ══════════════════════════════════════════════════════════════════════════════
// POST /api/screen/diabetes
// ── Main endpoint: predict + save to DB ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post('/predict', authMiddleware, async (req, res) => {
    try {
        const userId    = req.user.id;
        const inputData = req.body;     // raw form data from React

        // ── 1. Validate required fields ───────────────────────────────────────
        const required = ['BMI', 'Age', 'GenHlth', 'PhysActivity'];
        const missing  = required.filter(f => inputData[f] === undefined || inputData[f] === null);
        if (missing.length > 0) {
            return res.status(400).json({
                error:   'Missing required fields',
                missing: missing
            });
        }

        // ── 2. Call FastAPI ML service ─────────────────────────────────────────
        let mlResult;
        try {
            const mlResponse = await axios.post(
                `${ML_SERVICE_URL}/diabetes/predict`,
                { ...inputData, mode: inputData.mode || 'screening' },
                { timeout: 15000 }    // 15 second timeout
            );
            mlResult = mlResponse.data;
        } catch (mlError) {
            // If ML service is down, return hardcoded mock for demo purposes
            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️  ML service unreachable — returning mock response');
                mlResult = {
                    disease:          'diabetes',
                    risk_probability: 45.0,
                    risk_level:       'medium',
                    key_factors:      ['ML service offline — mock response'],
                    recommendation:   'Please consult a doctor.',
                    threshold_used:   0.22,
                    threshold_type:   'screening',
                    model_confidence: { mock: 45.0 },
                    disclaimer:       'Screening only. Does not replace medical diagnosis.'
                };
            } else {
                return res.status(503).json({ error: 'ML service unavailable. Please try again.' });
            }
        }

        // ── 3. Save to PostgreSQL ──────────────────────────────────────────────
        const insertQuery = `
            INSERT INTO screenings
                (user_id, disease, risk_level, risk_probability, key_factors,
                 recommendation, model_confidence, input_data, threshold_type, disclaimer)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, created_at
        `;

        const dbResult = await pool.query(insertQuery, [
            userId,
            mlResult.disease,
            mlResult.risk_level,
            mlResult.risk_probability,
            JSON.stringify(mlResult.key_factors),
            mlResult.recommendation,
            JSON.stringify(mlResult.model_confidence),
            JSON.stringify(inputData),         // save raw input for audit trail
            mlResult.threshold_type,
            mlResult.disclaimer
        ]);

        const savedRecord = dbResult.rows[0];

        // ── 4. Return to React frontend ────────────────────────────────────────
        return res.status(200).json({
            success:     true,
            screening_id: savedRecord.id,
            created_at:  savedRecord.created_at,
            result:      mlResult
        });

    } catch (error) {
        console.error('Diabetes predict error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// ══════════════════════════════════════════════════════════════════════════════
// GET /api/screen/diabetes/history
// ── Get user's past diabetes screenings ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get('/history', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit  = parseInt(req.query.limit) || 10;

        const result = await pool.query(
            `SELECT id, risk_level, risk_probability, key_factors,
                    recommendation, created_at
             FROM   screenings
             WHERE  user_id = $1 AND disease = 'diabetes'
             ORDER  BY created_at DESC
             LIMIT  $2`,
            [userId, limit]
        );

        return res.status(200).json({
            success:  true,
            count:    result.rows.length,
            history:  result.rows
        });

    } catch (error) {
        console.error('History fetch error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// ══════════════════════════════════════════════════════════════════════════════
// GET /api/screen/diabetes/result/:id
// ── Get one specific screening result ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get('/result/:id', authMiddleware, async (req, res) => {
    try {
        const userId      = req.user.id;
        const screeningId = req.params.id;

        const result = await pool.query(
            `SELECT * FROM screenings WHERE id = $1 AND user_id = $2`,
            [screeningId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Screening not found' });
        }

        return res.status(200).json({ success: true, result: result.rows[0] });

    } catch (error) {
        console.error('Result fetch error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;


// ══════════════════════════════════════════════════════════════════════════════
// backend/server.js — Your main Express server entry point
// ══════════════════════════════════════════════════════════════════════════════
/*
const express  = require('express');
const cors     = require('cors');
const dotenv   = require('dotenv');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
const diabetesRoute = require('./routes/diabetes');
const authRoute     = require('./routes/auth');

app.use('/api/auth',              authRoute);
app.use('/api/screen/diabetes',   diabetesRoute);
// app.use('/api/screen/anemia',  anemiaRoute);    ← add when ready
// app.use('/api/screen/skin',    skinRoute);      ← add when ready

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'NirogAI Backend' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ NirogAI Backend running on port ${PORT}`));
*/
