import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../../lib/db';

export async function POST(request) {
  try {
    await connectToDatabase();
    const { artistName, email, password } = await request.json();

    if (!artistName || !email || !password) {
      return NextResponse.json({ error: 'All registration parameters are required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const artist = await Artist.findOne({ email: normalizedEmail });

    if (!artist) {
      return NextResponse.json({ error: 'Account not found. Please enter your email and click proceed first.' }, { status: 400 });
    }

    if (!artist.isVerified) {
      return NextResponse.json({ error: 'Email not verified. Click the confirmation link in your inbox first.' }, { status: 400 });
    }

    if (artist.password && artist.password !== password) {
      return NextResponse.json({ error: 'Password does not match the password set during email confirmation.' }, { status: 400 });
    }

    if (artist.artistName) {
      return NextResponse.json({ error: 'Registration is already complete for this account.' }, { status: 400 });
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

    artist.password = password; // Save password entered on registration form
    artist.artistName = artistName.trim();
    artist.uniqueCode = uniqueCode;
    await artist.save();

    return NextResponse.json({
      artist: {
        uniqueCode: artist.uniqueCode,
        totalTips: artist.totalTips,
        tipCount: artist.tipCount,
        artistName: artist.artistName,
        email: artist.email
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Failed to complete registration.' }, { status: 500 });
  }
}
