const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL (Neon) connected'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err.message));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// Make pool accessible to routes
app.locals.pool = pool;

// Routes
app.use('/api/policies', require('./src/routes/policies'));
app.use('/api/approvals', require('./src/routes/approvals'));
app.use('/api/rules', require('./src/routes/rules'));
app.use('/api/scoring', require('./src/routes/scoring'));
app.use('/api/decision-tree', require('./src/routes/decisionTree'));
app.use('/api/clauses', require('./src/routes/clauses'));
app.use('/api/simulation', require('./src/routes/simulation'));
app.use('/api/versions', require('./src/routes/versions'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
