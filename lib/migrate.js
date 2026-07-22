import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || "postgres://kohartist:abc123@localhost:5432/kohartist_postgres";

const pool = new Pool({
  connectionString,
});

async function migrate() {
  console.log("Starting PostgreSQL schema updates...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Add password_hash to artist
    const resPassword = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='artist' AND column_name='password_hash';
    `);
    if (resPassword.rows.length === 0) {
      console.log("Adding column 'password_hash' to 'artist' table...");
      await client.query(`ALTER TABLE artist ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';`);
    } else {
      console.log("Column 'password_hash' already exists in 'artist' table.");
    }

    // 2. Add live_status to artist
    const resLiveStatus = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='artist' AND column_name='live_status';
    `);
    if (resLiveStatus.rows.length === 0) {
      console.log("Adding column 'live_status' to 'artist' table...");
      await client.query(`ALTER TABLE artist ADD COLUMN live_status VARCHAR(50) NOT NULL DEFAULT 'Offline';`);
    } else {
      console.log("Column 'live_status' already exists in 'artist' table.");
    }

    // 3. Add active_event_id to artist
    const resActiveEvent = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='artist' AND column_name='active_event_id';
    `);
    if (resActiveEvent.rows.length === 0) {
      console.log("Adding column 'active_event_id' to 'artist' table...");
      await client.query(`ALTER TABLE artist ADD COLUMN active_event_id UUID REFERENCES event(id) ON DELETE SET NULL;`);
    } else {
      console.log("Column 'active_event_id' already exists in 'artist' table.");
    }

    // 4. Add fan_name to payment
    const resFanName = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='payment' AND column_name='fan_name';
    `);
    if (resFanName.rows.length === 0) {
      console.log("Adding column 'fan_name' to 'payment' table...");
      await client.query(`ALTER TABLE payment ADD COLUMN fan_name VARCHAR(100);`);
    } else {
      console.log("Column 'fan_name' already exists in 'payment' table.");
    }

    // 5. Add message to payment
    const resMessage = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='payment' AND column_name='message';
    `);
    if (resMessage.rows.length === 0) {
      console.log("Adding column 'message' to 'payment' table...");
      await client.query(`ALTER TABLE payment ADD COLUMN message TEXT;`);
    } else {
      console.log("Column 'message' already exists in 'payment' table.");
    }

    // 6. Create artist_session table
    console.log("Creating 'artist_session' table if not exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS artist_session (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_token VARCHAR(255) UNIQUE NOT NULL,
        artist_id UUID NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query("COMMIT;");
    console.log("PostgreSQL schema updates complete!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed, transaction rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
