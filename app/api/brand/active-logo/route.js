import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import fs from 'fs';
import path from 'path';

const STATE_FILE = '/var/www/tools/active-logo-state.json';

const DEFAULT_BRAND_STATE = {
  prefix: "k",
  suffix: "hartist",
  fontFamily: "Space Grotesk",
  layout: "horizontal",
  pulseSpeed: "slow",
  colorHeart: "#f05a28",
  colorRing: "#e2e8f0",
  colorInnerBg: "#080a0f",
  colorGlow: "#f05a28",
  colorText: "#ffffff",
  letterSpacing: 2
};

async function readLogoStateFromDB() {
  try {
    const p = getPool();
    const res = await p.query("SELECT value FROM global_branding WHERE key = 'active_logo'");
    if (res.rows.length > 0) {
      return res.rows[0].value;
    }
  } catch (err) {
    console.error("Error reading logo state from PostgreSQL:", err);
  }
  
  // Fallback to reading file if DB fails
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error("Error reading logo state from file:", err);
  }
  
  return DEFAULT_BRAND_STATE;
}

async function writeLogoStateToDB(state) {
  try {
    const p = getPool();
    await p.query(`
      INSERT INTO global_branding (key, value, updated_at)
      VALUES ('active_logo', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW();
    `, [JSON.stringify(state)]);
    return true;
  } catch (err) {
    console.error("Error writing logo state to PostgreSQL:", err);
  }
  return false;
}

// Backup file write for compatibility
function writeLogoStateToFile(state) {
  try {
    const parentDir = path.dirname(STATE_FILE);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Error writing logo state file backup:", err);
  }
  return false;
}

export async function GET() {
  const state = await readLogoStateFromDB();
  return NextResponse.json(state);
}

export async function POST(request) {
  try {
    const state = await request.json();
    if (!state || !state.prefix) {
      return NextResponse.json({ error: 'Invalid brand state config' }, { status: 400 });
    }
    
    // Save to Database permanently
    await writeLogoStateToDB(state);
    
    // Backup writes to file system
    writeLogoStateToFile(state);
    
    const publicToolsFile = '/home/blair/kh-front/public/tools/active-logo-state.json';
    try {
      fs.writeFileSync(publicToolsFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {}

    return NextResponse.json({ success: true, state });
  } catch (err) {
    console.error("Save logo state error:", err);
    return NextResponse.json({ error: 'Failed to save logo state' }, { status: 500 });
  }
}
