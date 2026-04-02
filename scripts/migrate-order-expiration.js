#!/usr/bin/env node

const { Client } = require('pg');

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function run() {
  const dbHost = requiredEnv('DB_HOST');

  const client = new Client({
    host: dbHost,
    port: Number(process.env.DB_PORT || '5432'),
    user: requiredEnv('DB_USERNAME'),
    password: requiredEnv('DB_PASSWORD'),
    database: requiredEnv('DB_DATABASE'),
    ssl: dbHost !== 'localhost' ? { rejectUnauthorized: false } : false,
  });

  const startedAt = Date.now();

  await client.connect();

  try {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'orders_status_enum'
            AND n.nspname = current_schema()
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'orders_status_enum'
            AND e.enumlabel = 'EXPIRED'
            AND n.nspname = current_schema()
        ) THEN
          BEGIN
            ALTER TYPE orders_status_enum ADD VALUE 'EXPIRED';
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END
      $$;
    `);

    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS auto_expire_at TIMESTAMP NULL;
    `);

    const backfillResult = await client.query(`
      UPDATE orders
      SET auto_expire_at = created_at + INTERVAL '7 days'
      WHERE auto_expire_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_pending_auto_expire_at
      ON orders(auto_expire_at)
      WHERE status = 'PENDING';
    `);

    const durationMs = Date.now() - startedAt;

    console.log(
      JSON.stringify({
        message: 'Order expiration migration completed',
        backfilledRows: backfillResult.rowCount || 0,
        durationMs,
      }),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(
    JSON.stringify({
      message: 'Order expiration migration failed',
      error: error.message,
      stack: error.stack,
    }),
  );
  process.exit(1);
});
