import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const { initData, code } = await req.json();

    if (!initData || !code) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const botToken = process.env.BOT_TOKEN!;
    const { valid, user: tgUser } = validateTelegramWebAppData(initData, botToken);

    if (!valid || !tgUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(tgUser.id) },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promo || !promo.isActive) {
      return NextResponse.json({
        success: false,
        message: "Промокод не найден или недействителен",
      });
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return NextResponse.json({
        success: false,
        message: "Срок действия промокода истёк",
      });
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({
        success: false,
        message: "Промокод больше нельзя использовать",
      });
    }

    const existing = await prisma.promoRedemption.findUnique({
      where: {
        userId_promoId: { userId: user.id, promoId: promo.id },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        message: "Ты уже активировал этот промокод",
      });
    }

    await prisma.$transaction([
      prisma.promoRedemption.create({
        data: { userId: user.id, promoId: promo.id },
      }),
      prisma.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: promo.coins },
          gems: { increment: promo.gems },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Промокод активирован!",
      coins: promo.coins,
      gems: promo.gems,
    });
  } catch (error) {
    console.error("Promo error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
