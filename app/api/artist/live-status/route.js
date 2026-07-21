import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../../lib/db';

export async function POST(request) {
  try {
    await connectToDatabase();
    const { uniqueCode, liveStatus, activeEvent } = await request.json();

    if (!uniqueCode) {
      return NextResponse.json({ error: 'Artist unique code is required.' }, { status: 400 });
    }

    if (!['Offline', 'Live'].includes(liveStatus)) {
      return NextResponse.json({ error: 'Invalid live status.' }, { status: 400 });
    }

    const artist = await Artist.findOneAndUpdate(
      { uniqueCode: uniqueCode.toUpperCase().trim() },
      { liveStatus, activeEvent: liveStatus === 'Live' ? activeEvent : null },
      { new: true }
    );

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      liveStatus: artist.liveStatus,
      activeEvent: artist.activeEvent
    });
  } catch (error) {
    console.error('Update live status error:', error);
    return NextResponse.json({ error: 'Failed to update status.' }, { status: 500 });
  }
}
