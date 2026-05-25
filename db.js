// require('dotenv').config();
// const { Pool } = require('pg');

// const pool = new Pool({
//   host:     process.env.PG_HOST     || 'localhost',
//   port:     process.env.PG_PORT     || 5432,
//   database: process.env.PG_DATABASE || 'examportal',
//   user:     process.env.PG_USER     || 'postgres',
//   password: process.env.PG_PASSWORD || '1234',
// });
// pool.on('connect', () => console.log('✅ PostgreSQL connected'));
// pool.on('error',   (err) => console.error('❌ DB error:', err));

// module.exports = pool;

require('dotenv').config();
const { Pool } = require('pg');
 
const pool = new Pool({
  host:     process.env.AZURE_POSTGRESQL_HOST     || 'localhost',
  port:     process.env.AZURE_POSTGRESQL_PORT     || 5432,
  database: process.env.AZURE_POSTGRESQL_DATABASE || 'postgres',
  user:     process.env.AZURE_POSTGRESQL_USER     || 'postgres',
  password: process.env.AZURE_POSTGRESQL_PASSWORD || '1234',
  ssl: { rejectUnauthorized: false }
});
 
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        password VARCHAR(100) NOT NULL,
        rank VARCHAR(100),
        cdcnumber VARCHAR(100),
        session_token TEXT
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        user_name VARCHAR(100),
        rank VARCHAR(100),
        score INTEGER,
        correct INTEGER,
        wrong INTEGER,
        skipped INTEGER,
        total INTEGER,
        passed BOOLEAN
      )
    `);
    console.log('✅ Tables ready');
  } catch (err) {
    console.error('❌ Table creation failed:', err);
  }
}
 
initDB();
 
pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error',   (err) => console.error('❌ DB error:', err));
 
module.exports = pool;