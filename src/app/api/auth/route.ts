import { NextRequest, NextResponse } from "next/server";
import { validateTelegramWebAppData } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();

    if (!initData) {
      return NextResponse.json({ error: "No initData" }, { status: 400 });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const { valid, user: tgUser } = validateTelegramWebAppData(initData, botToken);

    if (!valid || !tgUser) {
      return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
    }

    const telegramId = BigInt(tgUser.id);
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Boolean);

    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          languageCode: tgUser.language_code || "ru",
          photoUrl: tgUser.photo_url,
          isAdmin: adminIds.includes(tgUser.id),
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          photoUrl: tgUser.photo_url,
          lastActiveAt: new Date(),
          isAdmin: adminIds.includes(tgUser.id) || user.isAdmin,
        },
      });
    }

    if (user.isBanned) {
      return NextResponse.json({ error: "Banned" }, { status: 403 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        coins: user.coins,
        gems: user.gems,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
