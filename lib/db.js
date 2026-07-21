import mongoose from 'mongoose';
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

const isPostgres = () => {
  const dbType = (process.env.DB_TYPE || '').toLowerCase();
  return dbType === 'postgres' || dbType === 'postgresql';
};

// --- MONGODB IMPLEMENTATION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://kohartist_app:LAoBM7+uoiRvFFZ+iP5HFseH@127.0.0.1:27017/kohartist?authSource=kohartist';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabaseMongo() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

const ArtistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  artistName: { type: String, trim: true },
  password: { type: String },
  uniqueCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  totalTips: { type: Number, default: 0 },
  tipCount: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  tokenExpiry: { type: Date },
  liveStatus: { type: String, default: 'Offline' },
  activeEvent: { type: String, default: null }
});

export const ArtistMongo = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);


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

export async function connectToDatabasePostgres() {
  const p = getPool();
  await p.query('SELECT 1;');
  return p;
}

// Keep in-memory maps for dynamic state that doesn't persist on-disk in the given schema
const inMemoryPasswords = new Map(); // artistId -> password
const inMemoryLiveStatus = new Map(); // artistId -> status ('Offline' | 'Live')
const inMemoryActiveEvents = new Map(); // artistId -> eventId
const inMemoryTokens = new Map(); // token -> { email, expiry }
const inMemoryVerified = new Map(); // artistId -> boolean

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
    this._id = row.id || null;
    this.id = row.id || null;
    
    this._email = row.contact || '';
    this._artistName = row.name || '';
    this._uniqueCode = row.artist_code || '';
    
    // Loaded dynamically or kept in-memory
    this._totalTips = 0;
    this._tipCount = 0;
    
    this._isNew = !row.id;
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
    return inMemoryPasswords.get(this.id) || '';
  }
  set password(val) {
    if (this.id) inMemoryPasswords.set(this.id, val);
  }

  get isVerified() {
    return inMemoryVerified.get(this.id) ?? true; // Default to true if not specified
  }
  set isVerified(val) {
    if (this.id) inMemoryVerified.set(this.id, !!val);
  }

  get verificationToken() {
    // Return token if there is an in-memory token pointing to this email
    for (const [token, data] of inMemoryTokens.entries()) {
      if (data.email === this.email) return token;
    }
    return '';
  }
  set verificationToken(val) {
    if (val) {
      inMemoryTokens.set(val, { email: this.email, expiry: new Date(Date.now() + 24 * 3600 * 1000) });
    }
  }

  get tokenExpiry() {
    for (const [token, data] of inMemoryTokens.entries()) {
      if (data.email === this.email) return data.expiry;
    }
    return null;
  }
  set tokenExpiry(val) {
    // Handled via verificationToken setter
  }

  get liveStatus() {
    return inMemoryLiveStatus.get(this.id) || 'Offline';
  }
  set liveStatus(val) {
    if (this.id) inMemoryLiveStatus.set(this.id, val);
  }

  get activeEvent() {
    return inMemoryActiveEvents.get(this.id) || null;
  }
  set activeEvent(val) {
    if (this.id) inMemoryActiveEvents.set(this.id, val);
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
        INSERT INTO artist (id, name, contact, artist_code)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const params = [this.id, name, this.email, artist_code];
      const res = await p.query(sql, params);
      
      // Save password and other states in memory
      if (this.password) {
        inMemoryPasswords.set(this.id, this.password);
      }
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
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      const params = [this.id, name, this.email, artist_code];
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
    // Support token query in-memory
    const tokenData = inMemoryTokens.get(query.verificationToken);
    if (tokenData && (!query.tokenExpiry || tokenData.expiry > new Date())) {
      const artistRow = await findOnePostgres({ email: tokenData.email });
      return artistRow;
    }
    return null;
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
      // If liveStatus filter is requested, filter the on-disk list using in-memory state
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
  
  if (update.liveStatus !== undefined) artist.liveStatus = update.liveStatus;
  if (update.activeEvent !== undefined) artist.activeEvent = update.activeEvent;
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
  if (isPostgres()) {
    return connectToDatabasePostgres();
  } else {
    return connectToDatabaseMongo();
  }
}

const ArtistProxy = function(data) {
  if (isPostgres()) {
    return new ArtistDocument(data);
  } else {
    return new ArtistMongo(data);
  }
};

ArtistProxy.findOne = async (query) => {
  if (isPostgres()) {
    return findOnePostgres(query);
  } else {
    return ArtistMongo.findOne(query);
  }
};

ArtistProxy.find = (query) => {
  if (isPostgres()) {
    return findPostgres(query);
  } else {
    return ArtistMongo.find(query);
  }
};

ArtistProxy.findOneAndUpdate = async (filter, update, options) => {
  if (isPostgres()) {
    return findOneAndUpdatePostgres(filter, update, options);
  } else {
    return ArtistMongo.findOneAndUpdate(filter, update, options);
  }
};

export { ArtistProxy as Artist };
