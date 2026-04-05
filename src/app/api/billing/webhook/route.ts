import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const stripe = new Stripe(stripeKey);
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.customer) {
          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubId: session.subscription as string,
              status: 'active',
            },
            create: {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubId: session.subscription as string,
              status: 'active',
            },
          });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const paidSubId = (invoice as unknown as Record<string, unknown>).subscription as string | null;
        if (paidSubId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubId: paidSubId },
          });
          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                status: 'active',
                currentPeriodEnd: new Date((invoice.lines.data[0]?.period?.end || 0) * 1000),
              },
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedSubId = (failedInvoice as unknown as Record<string, unknown>).subscription as string | null;
        if (failedSubId) {
          const sub = await prisma.subscription.findFirst({
            where: { stripeSubId: failedSubId },
          });
          if (sub) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'past_due' },
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubId: subscription.id },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'canceled' },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
