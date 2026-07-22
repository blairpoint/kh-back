import { NextResponse } from 'next/server';
import { connectToDatabase, Artist, validateSession } from '../../../../lib/db';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Missing artist code.' }, { status: 400 });
    }

    // Enforce active session token validation if we are in the artist space
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('kohartist_session');
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie.value));
        if (parsed.sessionToken) {
          const validCode = await validateSession(parsed.sessionToken);
          if (!validCode || validCode !== code.toUpperCase().trim()) {
            return NextResponse.json({ error: 'Session expired or invalidated by another concurrent login.' }, { status: 401 });
          }
        }
      } catch (e) {
        return NextResponse.json({ error: 'Invalid session structure.' }, { status: 401 });
      }
    }

    // TEST ACCOUNT BYPASS
    if (code.toUpperCase().trim() === 'TEST01') {
      return NextResponse.json({
        artistName: 'Test Artist',
        totalTips: 500,
        tipCount: 10
      });
    }

    const artist = await Artist.findOne({ uniqueCode: code.toUpperCase().trim() });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found.' }, { status: 404 });
    }

    return NextResponse.json({
      artistName: artist.artistName,
      totalTips: artist.totalTips,
      tipCount: artist.tipCount,
      liveStatus: artist.liveStatus || 'Offline',
      activeEvent: artist.activeEvent || null
    });

  } catch (error) {
    console.error('Details error:', error);
    return NextResponse.json({ error: 'Failed to fetch artist details.' }, { status: 500 });
  }
}
