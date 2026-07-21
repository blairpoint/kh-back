import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { amount, uniqueCode, artistName } = await request.json();

    if (!uniqueCode) {
      return NextResponse.json({ error: 'Missing active artist reference code.' }, { status: 400 });
    }

    // Direct Stripe payment link with dynamic prefilled query parameters
    const url = `https://give.kohartist.com/b/4gM28s7TC0919IKdiYa3u01?client_reference_id=${uniqueCode}&prefilled_custom_field[koha_recipient]=${encodeURIComponent(artistName || uniqueCode)}`;

    return NextResponse.json({ url });

  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json({ error: error.message || 'Payment Link generation failed.' }, { status: 500 });
  }
}
