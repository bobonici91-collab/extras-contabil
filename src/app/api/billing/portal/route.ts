import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/config';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.startsWith('sk_test_your')) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.userId },
    });

    if (!subscription?.stripeCustomerId || subscription.stripeCustomerId.startsWith('trial_')) {
      return NextResponse.json({
        error: 'Nu exista un abonament activ. Activati mai intai un abonament.',
      }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'Eroare la deschiderea portalului.' }, { status: 500 });
  }
}
