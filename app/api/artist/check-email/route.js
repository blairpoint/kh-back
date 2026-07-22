import { NextResponse } from 'next/server';
import { connectToDatabase, Artist } from '../../../../lib/db';
import { sendVerificationEmail } from '../../../../lib/mail';
import crypto from 'crypto';

export async function POST(request) {
  try {
    await connectToDatabase();
    const { email, triggerReset } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // TEST ACCOUNT BYPASS
    if (normalizedEmail.startsWith('test@')) {
      return NextResponse.json({ exists: true, artistName: 'Test Artist' });
    }

    let artist = await Artist.findOne({ email: normalizedEmail });

    if (!artist || !artist.artistName || triggerReset === true) {
      // Create or update artist profile with a unique verification token (Signup/Reset flows)
      if (!artist) {
        artist = new Artist({
          email: normalizedEmail,
          isVerified: false
        });
      }

      const token = crypto.randomBytes(32).toString('hex');
      artist.verificationToken = token;
      artist.tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour expiry
      await artist.save();

      // Dispatch verification email containing the unique setup link
      await sendVerificationEmail(normalizedEmail, token);

      return NextResponse.json({ exists: !!artist.artistName, emailSent: true });
    }

    // Fully registered user
    return NextResponse.json({ exists: true, artistName: artist.artistName });

  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json({ error: 'System verification check failed.' }, { status: 500 });
  }
}
