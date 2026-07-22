import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('kohartist_session');
    
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie.value));
        if (parsed.sessionToken) {
          // Explicitly delete session row from database
          const p = getPool();
          await p.query('DELETE FROM artist_session WHERE session_token = $1', [parsed.sessionToken]);
        }
      } catch (e) {
        console.error("Logout session parsing error:", e);
      }
    }
    
    // Create clean response and set cookies deletion header
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', 'kohartist_session=; path=/; max-age=0; SameSite=Lax');
    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json({ error: 'Logout process failed.' }, { status: 500 });
  }
}
