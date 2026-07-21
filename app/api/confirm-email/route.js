import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../lib/db';

export async function GET(request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token parameter.' }, { status: 400 });
    }

    const artist = await Artist.findOne({
      verificationToken: token,
      tokenExpiry: { $gt: new Date() }
    });

    if (!artist) {
      return NextResponse.json({ error: 'Invalid or expired confirmation link.' }, { status: 400 });
    }

    return NextResponse.json({ email: artist.email });

  } catch (error) {
    console.error('Verify token error:', error);
    return NextResponse.json({ error: 'System token validation failed.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const { token, password, artistName } = await request.json();

    if (!token || !password || !artistName) {
      return NextResponse.json({ error: 'Token, secure password, and Artist/Stage Name are required.' }, { status: 400 });
    }

    const artist = await Artist.findOne({
      verificationToken: token,
      tokenExpiry: { $gt: new Date() }
    });

    if (!artist) {
      return NextResponse.json({ error: 'Confirmation link has expired or is invalid.' }, { status: 400 });
    }

    // Generate unique short code for the artist
    let uniqueCode = '';
    let isUnique = false;
    while (!isUnique) {
      uniqueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existing = await Artist.findOne({ uniqueCode });
      if (!existing) {
        isUnique = true;
      }
    }

    artist.password = password;
    artist.artistName = artistName.trim();
    artist.uniqueCode = uniqueCode;
    artist.isVerified = true;
    artist.verificationToken = undefined;
    artist.tokenExpiry = undefined;
    await artist.save();

    return NextResponse.json({ 
      success: true, 
      uniqueCode: artist.uniqueCode,
      artistName: artist.artistName
    });

  } catch (error) {
    console.error('Verify submit error:', error);
    return NextResponse.json({ error: 'Confirmation submission failed.' }, { status: 500 });
  }
}
