import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/config';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.startsWith('sk_test_your')) {
      return NextResponse.json({
        error: 'Sistemul de plati nu este configurat. Contactati administratorul.',
      }, { status: 503 });
    }

    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 14,
      },
      customer_email: user.email,
      metadata: { userId: user.userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({
      error: 'Eroare la crearea sesiunii de plata.',
    }, { status: 500 });
  }
}
