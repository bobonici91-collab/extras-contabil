import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/config';
import { prisma } from '@/lib/db';

// Admin emails — adauga emailul tau aici
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export async function GET(request: Request) {
  try {
    const userToken = getUserFromRequest(request);
    if (!userToken) {
      return NextResponse.json({ error: 'Autentificare necesara.' }, { status: 401 });
    }

    // Verifica daca e admin
    if (!ADMIN_EMAILS.includes(userToken.email.toLowerCase())) {
      return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 });
    }

    // Fetch all users with subscription and counts
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            plan: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        },
        _count: {
          select: {
            uploads: true,
            auditLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute stats
    const totalUsers = users.length;
    const activeSubscriptions = users.filter(u => u.subscription?.status === 'active').length;
    const trialing = users.filter(u => u.subscription?.status === 'trialing').length;
    const totalUploads = users.reduce((sum, u) => sum + u._count.uploads, 0);

    return NextResponse.json({
      users,
      stats: {
        totalUsers,
        activeSubscriptions,
        trialing,
        totalUploads,
        estimatedMRR: activeSubscriptions * 500,
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Eroare interna.' }, { status: 500 });
  }
}
