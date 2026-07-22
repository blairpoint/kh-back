import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import { cookies } from 'next/headers';

export async function GET(request) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    cookiesDetected: {},
    databaseState: {},
    mismatches: [],
    recommendations: []
  };

  try {
    // 1. Check cookies in request
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('kohartist_session');
    
    if (sessionCookie) {
      diagnostics.cookiesDetected.kohartist_session = {
        present: true,
        rawLength: sessionCookie.value.length
      };
      
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie.value));
        diagnostics.cookiesDetected.kohartist_session.parsed = parsed;
        
        // Check token
        if (parsed.sessionToken) {
          diagnostics.cookiesDetected.sessionToken = parsed.sessionToken;
        } else {
          diagnostics.mismatches.push("Cookie is present but lacks a 'sessionToken' field.");
        }
      } catch (e) {
        diagnostics.cookiesDetected.kohartist_session.parsed = null;
        diagnostics.mismatches.push(`Failed to parse 'kohartist_session' cookie JSON: ${e.message}`);
      }
    } else {
      diagnostics.cookiesDetected.kohartist_session = { present: false };
      diagnostics.mismatches.push("No 'kohartist_session' cookie was sent in the request headers.");
    }

    // 2. Query Database State
    const p = getPool();
    const sessionToken = diagnostics.cookiesDetected.sessionToken;
    
    if (sessionToken) {
      const res = await p.query(`
        SELECT s.id as session_id, s.expires_at, a.id as artist_id, a.name, a.contact, a.artist_code, a.live_status
        FROM artist_session s
        JOIN artist a ON s.artist_id = a.id
        WHERE s.session_token = $1
      `, [sessionToken]);

      if (res.rows.length > 0) {
        const sessionRow = res.rows[0];
        const expiresAt = new Date(sessionRow.expires_at);
        const isExpired = expiresAt <= new Date();
        
        diagnostics.databaseState = {
          sessionFound: true,
          isExpired,
          expiresAt: expiresAt.toISOString(),
          artist: {
            id: sessionRow.artist_id,
            name: sessionRow.name,
            contact: sessionRow.contact,
            artistCode: sessionRow.artist_code,
            liveStatus: sessionRow.live_status
          }
        };

        if (isExpired) {
          diagnostics.mismatches.push(`The session token exists in PostgreSQL but has expired (expired at ${expiresAt.toISOString()}).`);
        }

        // Check for client-server sync mismatches
        const parsedCookie = diagnostics.cookiesDetected.kohartist_session?.parsed;
        if (parsedCookie) {
          if (parsedCookie.uniqueCode !== sessionRow.artist_code) {
            diagnostics.mismatches.push(`Artist code mismatch! Cookie expects '${parsedCookie.uniqueCode}', but database maps this session to '${sessionRow.artist_code}'.`);
          }
          if (parsedCookie.email !== sessionRow.contact) {
            diagnostics.mismatches.push(`Email mismatch! Cookie expects '${parsedCookie.email}', but database maps this session to '${sessionRow.contact}'.`);
          }
        }
      } else {
        diagnostics.databaseState = { sessionFound: false };
        diagnostics.mismatches.push(`The cookie session token '${sessionToken}' does not match any active record in the PostgreSQL 'artist_session' table.`);
      }
    } else {
      diagnostics.databaseState = { sessionFound: false, reason: "No session token supplied in request cookie." };
    }

    // 3. Generate actionable recommendations
    if (diagnostics.mismatches.length === 0) {
      diagnostics.status = "HEALTHY";
      diagnostics.recommendations.push("No session mismatches detected. The client state is perfectly in sync with PostgreSQL database records!");
    } else {
      diagnostics.status = "DEGRADED";
      diagnostics.mismatches.forEach(m => {
        if (m.includes("No 'kohartist_session' cookie")) {
          diagnostics.recommendations.push("Instruct the user to log in again to generate a fresh cookie session.");
        } else if (m.includes("does not match any active record")) {
          diagnostics.recommendations.push("The session was invalidated on the backend (or database was wiped). Clear browser cookies and log in again.");
        } else if (m.includes("expired")) {
          diagnostics.recommendations.push("The 7-day rolling window has passed. Perform a fresh login to clear expired states.");
        } else if (m.includes("mismatch")) {
          diagnostics.recommendations.push("Stale data in cookie detected. Clear browser cookies and re-authenticate.");
        }
      });
    }

    return NextResponse.json(diagnostics);
  } catch (err) {
    console.error("Diagnostic endpoint exception:", err);
    return NextResponse.json({ error: err.message, status: "ERROR" }, { status: 500 });
  }
}
