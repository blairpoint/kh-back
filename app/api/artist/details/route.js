import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../../lib/db';

export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Missing artist code.' }, { status: 400 });
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
