import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth/config';

// Configurare perioada de proba (zile)
const TRIAL_DAYS = 3;
// Numar maxim de fisiere in perioada de proba
export const TRIAL_MAX_FILES = 3;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, companyName, cui } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Toate campurile obligatorii trebuie completate.' }, { status: 400 });
    }

    if (!companyName || !cui) {
      return NextResponse.json({ error: 'Numele firmei si CUI-ul sunt obligatorii.' }, { status: 400 });
    }

    // Validare format CUI (RO + cifre sau doar cifre, 2-10 cifre)
    const cuiClean = cui.replace(/^RO/i, '').replace(/\s/g, '');
    if (!/^\d{2,10}$/.test(cuiClean)) {
      return NextResponse.json({ error: 'CUI invalid. Introduceti un CUI valid (ex: RO12345678 sau 12345678).' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Parola trebuie sa aiba minim 8 caractere.' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Exista deja un cont cu aceasta adresa de email.' }, { status: 409 });
    }

    // Check if CUI already used (prevent multiple trial accounts per company)
    const existingCui = await prisma.user.findFirst({ where: { cui: cuiClean } });
    if (existingCui) {
      return NextResponse.json({ error: 'Exista deja un cont inregistrat cu acest CUI. Contactati-ne daca aveti nevoie de acces.' }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user (store CUI without RO prefix, normalized)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        companyName: companyName || null,
        cui: cuiClean,
      },
    });

    // Create trial subscription
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

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
