// instalite-backend/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DATABASE_SERVER || 'localhost',
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: 'instagram_clone_db_1',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
