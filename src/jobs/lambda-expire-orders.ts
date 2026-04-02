import { Handler } from 'aws-lambda';
import { Pool } from 'pg';

const DEFAULT_BATCH_SIZE = 1000;
const PENDING_STATUS = 'PENDING';
const EXPIRED_STATUS = 'EXPIRED';

let cachedPool: Pool | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPool(): Pool {
  if (cachedPool) {
    return cachedPool;
  }

  const host = getRequiredEnv('DB_HOST');
  const nodeEnv = getRequiredEnv('NODE_ENV');

  cachedPool = new Pool({
    host,
    port: Number(process.env.DB_PORT ?? '5432'),
    user: getRequiredEnv('DB_USERNAME'),
    password: getRequiredEnv('DB_PASSWORD'),
    database: getRequiredEnv('DB_DATABASE'),
    ssl: host !== 'localhost' ? { rejectUnauthorized: false } : false,
    max: nodeEnv === 'development' ? 4 : 2,
  });

  return cachedPool;
}

async function expirePendingOrdersByBatch(batchSize: number): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `
      WITH pending_batch AS (
        SELECT id
        FROM orders
        WHERE status = $1
          AND auto_expire_at IS NOT NULL
          AND auto_expire_at <= NOW()
        ORDER BY auto_expire_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE orders o
      SET status = $3,
          updated_at = NOW()
      FROM pending_batch pb
      WHERE o.id = pb.id
      RETURNING o.id
    `,
    [PENDING_STATUS, batchSize, EXPIRED_STATUS],
  );

  return result.rowCount ?? 0;
}

export const handler: Handler = async (_event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const startedAt = Date.now();
  let updatedCount = 0;
  let batchCount = 0;
  const batchSize = DEFAULT_BATCH_SIZE;

  while (true) {
    const updatedInBatch = await expirePendingOrdersByBatch(batchSize);

    if (updatedInBatch === 0) {
      break;
    }

    updatedCount += updatedInBatch;
    batchCount += 1;
  }

  const durationMs = Date.now() - startedAt;

  console.log(
    JSON.stringify({
      message: 'Expire pending orders job completed',
      updatedCount,
      batchCount,
      durationMs,
    }),
  );

  return {
    updatedCount,
    batchCount,
    durationMs,
  };
};
