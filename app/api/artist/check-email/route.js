import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../../lib/db';

export async function POST(request) {
  try {
    await connectToDatabase();
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // TEST ACCOUNT BYPASS
    if (normalizedEmail.startsWith('test@')) {
      return NextResponse.json({ exists: true, artistName: 'Test Artist' });
    }

    let artist = await Artist.findOne({ email: normalizedEmail });

    if (!artist) {
      // Create pre-verified account immediately to bypass email confirmation
      artist = new Artist({
        email: normalizedEmail,
        isVerified: true
      });
      await artist.save();

      return NextResponse.json({ exists: false });
    }

    if (!artist.isVerified) {
      // Auto-verify any existing unverified accounts
      artist.isVerified = true;
      await artist.save();
      
      return NextResponse.json({ exists: false });
    }

    if (!artist.artistName) {
      // Verified but name not registered yet
      return NextResponse.json({ exists: false });
    }

    // Fully registered user
    return NextResponse.json({ exists: true, artistName: artist.artistName });

  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json({ error: 'System verification check failed.' }, { status: 500 });
  }
}
