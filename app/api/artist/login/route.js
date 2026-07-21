import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../../lib/db';

export async function POST(request) {
  try {
    await connectToDatabase();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // TEST ACCOUNT BYPASS
    if (normalizedEmail.startsWith('test@')) {
      return NextResponse.json({
        artist: {
          uniqueCode: 'TEST01',
          totalTips: 500,
          tipCount: 10,
          artistName: 'Test Artist',
          email: normalizedEmail
        }
      });
    }

    const artist = await Artist.findOne({ email: normalizedEmail });

    if (!artist) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 400 });
    }

    if (!artist.isVerified) {
      return NextResponse.json({ error: 'Email not verified. Click the confirmation link in your inbox first.' }, { status: 400 });
    }

    if (artist.password !== password) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 400 });
    }

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
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
  }
}
