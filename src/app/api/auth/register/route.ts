import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, companyName, cui } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Toate campurile obligatorii trebuie completate.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Parola trebuie sa aiba minim 8 caractere.' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Exista deja un cont cu aceasta adresa de email.' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        companyName: companyName || null,
        cui: cui || null,
      },
    });

    // Create trial subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeCustomerId: `trial_${user.id}`,
        status: 'trialing',
        trialEndsAt: trialEnd,
        currentPeriodEnd: trialEnd,
      },
    });

    // Generate token
    const token = signToken({ userId: user.id, email: user.email });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'register',
        detail: `Cont nou creat pentru ${companyName || email}`,
      },
    });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, companyName: user.companyName },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Eroare interna. Incercati din nou.' }, { status: 500 });
  }
}
