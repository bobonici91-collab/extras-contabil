import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signToken } from '@/lib/auth/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email si parola sunt obligatorii.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Email sau parola incorecta.' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Email sau parola incorecta.' }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login',
        detail: 'Autentificare reusita',
      },
    });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, companyName: user.companyName },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Eroare interna. Incercati din nou.' }, { status: 500 });
  }
}
