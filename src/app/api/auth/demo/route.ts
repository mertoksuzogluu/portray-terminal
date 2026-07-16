import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";

const DEMO_EMAIL = "demo@yatirim.local";

export async function POST() {
  try {
    if (process.env.NEXT_PUBLIC_ENABLE_DEMO !== "true") {
      return jsonError(new Error("Demo girişi kapalı."), 403);
    }

    let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

    if (!user) {
      const passwordHash = await bcrypt.hash("demo1234", 10);
      user = await prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          name: "Demo Yatırımcı",
          passwordHash,
          isDemo: true,
          baseCurrency: "TRY",
          timezone: "Europe/Istanbul",
          portfolios: {
            create: {
              name: "Ana Portföy",
              baseCurrency: "TRY",
              isDefault: true,
              accounts: {
                create: {
                  name: "Midas",
                  institution: "Midas",
                  accountType: "BROKERAGE",
                  currency: "TRY",
                },
              },
            },
          },
        },
      });
    }

    await createSession(user.id);

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.baseCurrency,
        timezone: user.timezone,
        riskFreeRateAnnual: user.riskFreeRateAnnual.toString(),
        isDemo: user.isDemo,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
