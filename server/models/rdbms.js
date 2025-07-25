import fs from 'fs';
import mysql from 'mysql2/promise';
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();  // ✅ Ensure environment variables are loaded

// Optional: Load additional config from config.json if needed
const configFile = fs.readFileSync('config.json', 'utf8');
const config = JSON.parse(configFile);

/**
 * Singleton pattern for managing database connections.
 */
let the_db = null;

class RelationalDB {
  conn = null;
  dbconfig = null;

  constructor() {
    this.dbconfig = {
      host: process.env.DATABASE_SERVER,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    };

    console.log('DB_USER:', this.dbconfig.user);
    console.log('DB_PASSWORD:', this.dbconfig.password ? '****' : 'MISSING');
  }

  setInfo(dbserver, dbname, dbuser, dbpassword) {
    this.dbconfig = config.database;
    this.dbconfig.host = dbserver;
    this.dbconfig.database = dbname;
    this.dbconfig.user = dbuser;
    this.dbconfig.password = dbpassword;
    return this;
  }

  async connect() {
    if (this.conn != null) {
      return this;
    }

    console.log("New connection request");
    try {
      this.conn = await mysql.createConnection(this.dbconfig);
      console.log("Database connection established.");
    } catch (err) {
      console.error(" Database connection failed:", err);
      throw err;  // Let the caller handle the error properly
    }
    return this;
  }

  close() {
    if (this.conn) {
      this.conn.end();
      this.conn = null;
      the_db = null;
      console.log("Database connection closed.");
    }
  }

  async send_sql(sql, params = []) {
    if (!this.conn) {
      throw new Error("Database connection not established. Call connect() first.");
    }
    return this.conn.query(sql, params);
  }

  async create_tables(query, params = []) {
    return this.send_sql(query, params);
  }

  async insert_items(query, params = []) {
    const [result] = await this.send_sql(query, params);
    return result.affectedRows;
  }
}

/**
 * For testing/mocking purposes.
 */
function set_db_connection(db) {
  the_db = db;
}

/**
 * Gets the singleton database connection object.
 */
function get_db_connection() {
  if (the_db) {
    return the_db;
  }
  the_db = new RelationalDB();
  return the_db;
}

export {
  get_db_connection,
  set_db_connection,
  RelationalDB
};
