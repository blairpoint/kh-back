import pg from 'pg';
import crypto from 'crypto';
import { sendStartupTestEmail } from './mail.js';

const { Pool } = pg;

// --- POSTGRESQL IMPLEMENTATION ---
let pool = null;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || "postgres://kohartist:abc123@localhost:5432/kohartist";
    pool = new Pool({
      connectionString,
    });
  }
  return pool;
}

let hasSentStartupEmail = false;

export async function connectToDatabasePostgres() {
  const p = getPool();
  await p.query('SELECT 1;');
  
  if (!hasSentStartupEmail) {
    hasSentStartupEmail = true;
    sendStartupTestEmail().catch(err => console.error("Startup email failed:", err));
    
    // Passively prune expired sessions to keep table size clean
    p.query('DELETE FROM artist_session WHERE expires_at < NOW()')
      .then(() => console.log("Database maintenance: Expired sessions successfully pruned."))
      .catch(err => console.error("Database maintenance error (session pruning):", err));
  }
  
  return p;
}

// Keep in-memory maps for dynamic state that doesn't persist on-disk in the given schema
const inMemoryTokens = new Map(); // token -> { email, expiry }
const inMemoryVerified = new Map(); // artistId -> boolean

// Secure PBKDF2 Password Hashing Helper
export function hashPassword(password) {
  if (!password) return '';
  return crypto.pbkdf2Sync(password, 'salt-kohartist-2026', 1000, 64, 'sha512').toString('hex');
}

async function fetchTipsForArtist(artistId) {
  const p = getPool();
  try {
    const res = await p.query(
      `SELECT COALESCE(SUM(amount_cents), 0) as total, COUNT(*) as count 
       FROM payment 
       WHERE artist_id = $1 AND status = 'succeeded'`,
      [artistId]
    );
    const row = res.rows[0] || { total: 0, count: 0 };
    return {
      totalTips: Number(row.total) / 100, // convert cents to dollars
      tipCount: Number(row.count)
    };
  } catch (err) {
    console.error('Error fetching tips:', err);
    return { totalTips: 0, tipCount: 0 };
  }
}

class ArtistDocument {
  constructor(row = {}) {
    this._id = row.id || row._id || null;
    this.id = row.id || row._id || null;
    
    this._email = row.contact || row.email || '';
    this._artistName = row.name || row.artistName || '';
    this._uniqueCode = row.artist_code || row.uniqueCode || '';
    
    // Loaded directly from columns or properties
    this._passwordHash = row.password_hash || row.password || '';
    this._liveStatus = row.live_status || row.liveStatus || 'Offline';
    this._activeEvent = row.active_event_id || row.activeEvent || null;
    this._verificationToken = row.verification_token || row.verificationToken || '';
    this._tokenExpiry = row.token_expiry || row.tokenExpiry ? new Date(row.token_expiry || row.tokenExpiry) : null;
    
    // Loaded dynamically or kept in-memory
    this._totalTips = 0;
    this._tipCount = 0;
    
    this._isNew = !this.id;
  }

  get email() { return this._email; }
  set email(val) { this._email = val ? val.toLowerCase().trim() : ''; }

  get artistName() { return this._artistName; }
  set artistName(val) { this._artistName = val ? val.trim() : ''; }

  get uniqueCode() { return this._uniqueCode; }
  set uniqueCode(val) { this._uniqueCode = val ? val.toUpperCase().trim() : ''; }

  get totalTips() { return this._totalTips; }
  set totalTips(val) { this._totalTips = Number(val || 0); }

  get tipCount() { return this._tipCount; }
  set tipCount(val) { this._tipCount = Number(val || 0); }

  get password() {
    return this._passwordHash;
  }
  set password(val) {
    if (val) {
      // Check if already hashed
      if (val.length === 128 && /^[0-9a-f]+$/.test(val)) {
        this._passwordHash = val;
      } else {
        this._passwordHash = hashPassword(val);
      }
    }
  }

  get isVerified() {
    return inMemoryVerified.get(this.id) ?? true; // Default to true if not specified
  }
  set isVerified(val) {
    if (this.id) inMemoryVerified.set(this.id, !!val);
  }

  get verificationToken() {
    return this._verificationToken;
  }
  set verificationToken(val) {
    this._verificationToken = val || '';
  }

  get tokenExpiry() {
    return this._tokenExpiry;
  }
  set tokenExpiry(val) {
    this._tokenExpiry = val ? new Date(val) : null;
  }

  get liveStatus() {
    return this._liveStatus || 'Offline';
  }
  set liveStatus(val) {
    this._liveStatus = val || 'Offline';
  }

  get activeEvent() {
    return this._activeEvent || null;
  }
  set activeEvent(val) {
    this._activeEvent = val || null;
  }

  async save() {
    const p = getPool();
    const name = this.artistName || 'Unnamed Artist';
    const artist_code = this.uniqueCode || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    if (this._isNew) {
      if (!this.id) {
        this.id = crypto.randomUUID();
        this._id = this.id;
      }
      
      const sql = `
        INSERT INTO artist (id, name, contact, artist_code, password_hash, live_status, active_event_id, verification_token, token_expiry)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      const params = [
        this.id, 
        name, 
        this.email, 
        artist_code, 
        this._passwordHash || '', 
        this.liveStatus || 'Offline', 
        this.activeEvent,
        this.verificationToken || '',
        this.tokenExpiry
      ];
      const res = await p.query(sql, params);
      
      inMemoryVerified.set(this.id, true); // Auto-verify on registration
      this._isNew = false;
      const doc = new ArtistDocument(res.rows[0]);
      await doc.loadTips();
      return doc;
    } else {
      const sql = `
        UPDATE artist SET
          name = $2,
          contact = $3,
          artist_code = $4,
          password_hash = $5,
          live_status = $6,
          active_event_id = $7,
          verification_token = $8,
          token_expiry = $9,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      const params = [
        this.id, 
        name, 
        this.email, 
        artist_code, 
        this._passwordHash || '', 
        this.liveStatus || 'Offline', 
        this.activeEvent,
        this.verificationToken || '',
        this.tokenExpiry
      ];
      const res = await p.query(sql, params);
      const doc = new ArtistDocument(res.rows[0]);
      await doc.loadTips();
      return doc;
    }
  }

  async loadTips() {
    if (this.id) {
      const tips = await fetchTipsForArtist(this.id);
      this._totalTips = tips.totalTips;
      this._tipCount = tips.tipCount;
    }
  }
}

async function findOnePostgres(query) {
  const p = getPool();
  let sql = 'SELECT * FROM artist WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (query.email) {
    sql += ` AND contact = $${paramIndex}`;
    params.push(query.email);
    paramIndex++;
  }
  if (query.uniqueCode) {
    sql += ` AND artist_code = $${paramIndex}`;
    params.push(query.uniqueCode);
    paramIndex++;
  }
  if (query.verificationToken) {
    sql += ` AND verification_token = $${paramIndex} AND token_expiry > NOW()`;
    params.push(query.verificationToken);
    paramIndex++;
  }

  const res = await p.query(sql, params);
  if (res.rows.length === 0) {
    return null;
  }
  const doc = new ArtistDocument(res.rows[0]);
  await doc.loadTips();
  return doc;
}

function findPostgres(query) {
  const promiseChain = {
    select: async function(fields) {
      const docs = await executeFind();
      const fieldList = fields.split(/\s+/);
      return docs.map(doc => {
        const selected = {};
        fieldList.forEach(f => {
          selected[f] = doc[f];
        });
        return selected;
      });
    },
    then: function(onSuccess, onFailure) {
      return executeFind().then(onSuccess, onFailure);
    }
  };

  async function executeFind() {
    const p = getPool();
    let sql = 'SELECT * FROM artist WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (query) {
      if (query.artistName) {
        if (query.artistName.$exists && query.artistName.$ne === "") {
          sql += " AND name IS NOT NULL AND name <> ''";
        }
      }
      if (query.uniqueCode) {
        if (query.uniqueCode.$exists && query.uniqueCode.$ne === "") {
          sql += " AND artist_code IS NOT NULL AND artist_code <> ''";
        }
      }
    }

    const res = await p.query(sql, params);
    const docs = res.rows.map(row => new ArtistDocument(row));
    
    // Load tips for all docs
    for (const doc of docs) {
      await doc.loadTips();
    }

    if (query && query.liveStatus) {
      return docs.filter(doc => doc.liveStatus === query.liveStatus);
    }

    return docs;
  }

  return promiseChain;
}

async function findOneAndUpdatePostgres(filter, update, options = {}) {
  const artist = await findOnePostgres(filter);
  if (!artist) {
    return null;
  }
  
  if (update.liveStatus !== undefined) {
    artist.liveStatus = update.liveStatus;
    if (update.liveStatus === 'Offline') {
      const p = getPool();
      await p.query('UPDATE event SET ends_at = NOW() WHERE artist_id = $1 AND ends_at IS NULL', [artist.id]);
    }
  }
  
  if (update.activeEvent !== undefined) {
    const val = update.activeEvent;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '');
    if (isUUID || val === null) {
      artist.activeEvent = val;
    } else if (val && val.trim() !== '') {
      // Input is a venue name text! Create a corresponding PostgreSQL event row containing artist name & location (venue name)
      const p = getPool();
      const eventId = crypto.randomUUID();
      await p.query(
        `INSERT INTO event (id, artist_id, venue_name, artist_name, latitude, longitude, starts_at) 
         VALUES ($1, $2, $3, $4, 0.0, 0.0, NOW())`,
        [eventId, artist.id, val.trim(), artist.artistName || 'Unnamed Artist']
      );
      artist.activeEvent = eventId;
    } else {
      artist.activeEvent = null;
    }
  }
  
  if (update.email !== undefined) artist.email = update.email;
  if (update.artistName !== undefined) artist.artistName = update.artistName;
  if (update.password !== undefined) artist.password = update.password;
  if (update.uniqueCode !== undefined) artist.uniqueCode = update.uniqueCode;
  if (update.totalTips !== undefined) artist.totalTips = update.totalTips;
  if (update.tipCount !== undefined) artist.tipCount = update.tipCount;
  if (update.isVerified !== undefined) artist.isVerified = update.isVerified;
  if (update.verificationToken !== undefined) artist.verificationToken = update.verificationToken;
  if (update.tokenExpiry !== undefined) artist.tokenExpiry = update.tokenExpiry;

  return await artist.save();
}


// --- UNIFIED DATABASE EXPORTS ---
export async function connectToDatabase() {
  return connectToDatabasePostgres();
}

const ArtistProxy = function(data) {
  return new ArtistDocument(data);
};

ArtistProxy.findOne = async (query) => {
  return findOnePostgres(query);
};

ArtistProxy.find = (query) => {
  return findPostgres(query);
};

ArtistProxy.findOneAndUpdate = async (filter, update, options) => {
  return findOneAndUpdatePostgres(filter, update, options);
};

export { ArtistProxy as Artist };

// Dynamic compliance session tracking (stored in database settings / backend memory)
export const activeSessions = new Map();

export async function createSession(uniqueCode) {
  const p = getPool();
  const sessionToken = `session_${crypto.randomBytes(16).toString('hex')}`;
  const artistRes = await p.query('SELECT id FROM artist WHERE artist_code = $1', [uniqueCode.toUpperCase().trim()]);
  if (artistRes.rows.length === 0) {
    throw new Error('Artist not found');
  }
  const artistId = artistRes.rows[0].id;
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await p.query(
    'INSERT INTO artist_session (session_token, artist_id, expires_at) VALUES ($1, $2, $3)',
    [sessionToken, artistId, expiresAt]
  );
  return sessionToken;
}

export async function validateSession(sessionToken) {
  const p = getPool();
  try {
    const res = await p.query(
      `SELECT a.artist_code 
       FROM artist_session s 
       JOIN artist a ON s.artist_id = a.id 
       WHERE s.session_token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    );
    if (res.rows.length > 0) {
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      await p.query('UPDATE artist_session SET expires_at = $2 WHERE session_token = $1', [sessionToken, newExpiresAt]);
      return res.rows[0].artist_code;
    }
  } catch (err) {
    console.error('Error validating session:', err);
  }
  return null;
}
