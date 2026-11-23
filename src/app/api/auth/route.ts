import { NextRequest, NextResponse } from "next/server";
import { validateTelegramWebAppData } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    if (!initData) return NextResponse.json({ error: "No initData" }, { status: 400 });
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    const { valid, user: tgUser } = validateTelegramWebAppData(initData, botToken);
    if (!valid || !tgUser) return NextResponse.json({ error: "Invalid initData" }, { status: 401 });

    const telegramId = BigInt(tgUser.id);
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter((id) => /^\d+$/.test(id));
    const isOwner = adminIds.includes(telegramId.toString());
    const isPrimaryOwner = adminIds[0] === telegramId.toString();
    const ownerXp = 990000;
    let user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      user = await prisma.user.create({ data: {
        telegramId, username: tgUser.username, firstName: tgUser.first_name,
        lastName: tgUser.last_name, languageCode: tgUser.language_code || "ru",
        photoUrl: tgUser.photo_url, isAdmin: isOwner,
        ...(isPrimaryOwner ? { xp: ownerXp, level: 100 } : {}),
      } });
    } else {
      user = await prisma.user.update({ where: { id: user.id }, data: {
        username: tgUser.username, firstName: tgUser.first_name, lastName: tgUser.last_name,
        photoUrl: tgUser.photo_url, lastActiveAt: new Date(), isAdmin: isOwner || user.isAdmin,
        ...(isPrimaryOwner && user.level < 100 ? { xp: Math.max(user.xp, ownerXp), level: 100 } : {}),
      } });
    }

    if (isPrimaryOwner && user.level < 100) {
      const nextXp = Math.max(user.xp, ownerXp);
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { xp: nextXp, level: 100 } }),
        prisma.xpTransaction.create({ data: { userId: user.id, amount: nextXp - user.xp, balanceAfter: nextXp, source: "OWNER_LEVEL", reason: "Стартовый 100-й уровень владельца" } }),
      ]);
      user = { ...user, xp: nextXp, level: 100 };
    }
    if (user.isBanned) return NextResponse.json({ error: "Banned" }, { status: 403 });

    const staff = await prisma.adminStaff.findUnique({ where: { userId: user.id }, select: { role: true } });
    return NextResponse.json({ user: {
      id: user.id, telegramId: user.telegramId.toString(), username: user.username,
      firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl,
      coins: user.coins, gems: user.gems, gamesPlayed: user.gamesPlayed, gamesWon: user.gamesWon,
      isAdmin: user.isAdmin, staffRole: staff?.role || null, isVerified: user.isVerified,
    } });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
