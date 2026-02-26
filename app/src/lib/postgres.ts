import pg from "pg";

const MAX_POOL_SIZE = 10;
const IDLE_TIMEOUT_MS = 30000;
const CONNECTION_TIMEOUT_MS = 5000;

export class PostgresClient {
  constructor() {
    this.pool = new pg.Pool({
      host: process.env.POSTGRES_HOST || "127.0.0.1",
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || "slotm",
      password: process.env.POSTGRES_PASSWORD || "",
      database: process.env.POSTGRES_DB || "slotm",
      max: MAX_POOL_SIZE,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    });
  }

  async query(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result;
  }

  async getOne(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows[0] || null;
  }

  async getAll(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async run(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return {
      rowCount: result.rowCount || 0,
      rows: result.rows,
    };
  }

  async end() {
    await this.pool.end();
  }
}
