import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

const COOKIE_NAME = "yp_session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET ortam değişkeni tanımlı değil.");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  baseCurrency: string;
  timezone: string;
  riskFreeRateAnnual: string;
  role: "ADMIN" | "MEMBER";
  riskProfile: "CONSERVATIVE" | "BALANCED" | "GROWTH" | "AGGRESSIVE";
  isDemo: boolean;
}

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(COOKIE_NAME);
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.sub;
    if (!userId) return null;

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      return null;
    }

    const user = session.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      baseCurrency: user.baseCurrency,
      timezone: user.timezone,
      riskFreeRateAnnual: user.riskFreeRateAnnual.toString(),
      role: user.role,
      riskProfile: user.riskProfile,
      isDemo: user.isDemo,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("Oturum gerekli. Lütfen giriş yapın.");
  }
  return user;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.passwordHash) {
    throw new AuthError("E-posta veya şifre hatalı.");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AuthError("E-posta veya şifre hatalı.");
  }
  await createSession(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    baseCurrency: user.baseCurrency,
    timezone: user.timezone,
    riskFreeRateAnnual: user.riskFreeRateAnnual.toString(),
    role: user.role,
    riskProfile: user.riskProfile,
    isDemo: user.isDemo,
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<SessionUser> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) {
    throw new AuthError("Bu e-posta zaten kayıtlı.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      passwordHash,
      role: "MEMBER",
      riskProfile: "BALANCED",
      baseCurrency: "TRY",
      timezone: "Europe/Istanbul",
      portfolios: {
        create: {
          name: "Ana Portföy",
          baseCurrency: "TRY",
          isDefault: true,
          accounts: {
            create: {
              name: "Varsayılan Hesap",
              institution: "Manuel",
              accountType: "BROKERAGE",
              currency: "TRY",
            },
          },
        },
      },
    },
  });

  await createSession(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    baseCurrency: user.baseCurrency,
    timezone: user.timezone,
    riskFreeRateAnnual: user.riskFreeRateAnnual.toString(),
    role: user.role,
    riskProfile: user.riskProfile,
    isDemo: user.isDemo,
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new ForbiddenError("Bu işlem için yönetici yetkisi gerekir.");
  }
  return user;
}

export async function assertPortfolioOwnership(
  userId: string,
  portfolioId: string
): Promise<void> {
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    select: { id: true },
  });
  if (!portfolio) {
    throw new ForbiddenError("Bu portföye erişim yetkiniz yok.");
  }
}

export async function getDefaultPortfolioId(userId: string): Promise<string | null> {
  const portfolio = await prisma.portfolio.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return portfolio?.id ?? null;
}
