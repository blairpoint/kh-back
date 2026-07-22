import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { stripe } from '../../../lib/stripe'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get('session_id')

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items', 'payment_intent']
    })

    return NextResponse.json({
      status: session.status,
      customer_details: {
        email: session.customer_details?.email || null
      }
    })
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode || 500 }
    )
  }
}

export async function POST() {
  try {
    const headersList = await headers()
    const origin = headersList.get('origin')

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          // Provide the exact Price ID (for example, price_1234) of the product you want to sell
          price: '{{PRICE_ID}}',
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    });
    return NextResponse.redirect(session.url, 303)
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode || 500 }
    )
  }
}