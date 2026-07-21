import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../lib/db';

export async function GET() {
  try {
    await connectToDatabase();
    // Find all artists who are currently Live
    const artists = await Artist.find({ 
      artistName: { $exists: true, $ne: "" },
      uniqueCode: { $exists: true, $ne: "" },
      liveStatus: 'Live'
    }).select('artistName uniqueCode');

    return NextResponse.json(artists);
  } catch (error) {
    console.error('Fetch artists error:', error);
    return NextResponse.json({ error: 'Failed to fetch artists list.' }, { status: 500 });
  }
}
