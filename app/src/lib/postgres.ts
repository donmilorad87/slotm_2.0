import pg from "pg";

const MAX_POOL_SIZE = 10;
const IDLE_TIMEOUT_MS = 30000;
const CONNECTION_TIMEOUT_MS = 5000;

type QueryParam = string | number | boolean | Date | null;

export class PostgresClient {
  private readonly pool: pg.Pool;

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

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: QueryParam[] = [],
  ): Promise<pg.QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return result;
  }

  async getOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: QueryParam[] = [],
  ): Promise<T | null> {
    const result = await this.pool.query(sql, params);
    return (result.rows[0] as T | undefined) ?? null;
  }

  async getAll<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: QueryParam[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async run<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: QueryParam[] = [],
  ): Promise<{ rowCount: number; rows: T[] }> {
    const result = await this.pool.query(sql, params);
    return {
      rowCount: result.rowCount || 0,
      rows: result.rows as T[],
    };
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}
