require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');

const app = express();

// ─── Connect to Database ─────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// ─── Core Middleware ─────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Serve static UI ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/users', require('./routes/users'));

// ─── Health check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Social App API is running.',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Catch-all: Serve UI for non-API routes ──────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  });
});

// ─── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
