require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     process.env.PG_PORT     || 5432,
  database: process.env.PG_DATABASE || 'examportal',
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || '1234',
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error',   (err) => console.error('❌ DB error:', err));

module.exports = pool;