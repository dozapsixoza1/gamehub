import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

const LEVEL_STEP = 100;

function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / LEVEL_STEP)) + 1;
}

async function getAuthedUser(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return null;
  const auth = validateTelegramWebAppData(initData, token);
  if (!auth.valid || !auth.user) return null;
  return prisma.user.findUnique({ where: { telegramId: BigInt(auth.user.id) } });
}

const achievementDefinitions = [
  { id: "first_game", title: "Первый матч", description: "Сыграть первую партию", icon: "🎮", xpReward: 25, coinsReward: 25 },
  { id: "games_10", title: "Постоянный игрок", description: "Сыграть 10 матчей", icon: "🔥", xpReward: 75, coinsReward: 75 },
  { id: "wins_5", title: "Победитель", description: "Одержать 5 побед", icon: "🏆", xpReward: 100, coinsReward: 100 },
  { id: "games_50", title: "Ветеран", description: "Сыграть 50 матчей", icon: "⭐", xpReward: 250, coinsReward: 250 },
  { id: "wins_25", title: "Легенда", description: "Одержать 25 побед", icon: "👑", xpReward: 500, coinsReward: 500 },
];

async function ensureAchievements() {
  for (const item of achievementDefinitions) {
    await prisma.achievement.upsert({
      where: { id: item.id },
      create: item,
      update: {
        title: item.title,
        description: item.description,
        icon: item.icon,
        xpReward: item.xpReward,
        coinsReward: item.coinsReward,
      },
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const initData = req.nextUrl.searchParams.get("initData") || req.headers.get("x-init-data") || "";
    const user = await getAuthedUser(initData);
    if (!user || user.isBanned) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    }

    await ensureAchievements();

    const [achievements, history, leaderboard, referrals] = await Promise.all([
      prisma.userAchievement.findMany({
        where: { userId: user.id },
        include: { achievement: true },
        orderBy: { unlockedAt: "desc" },
      }),
      prisma.matchHistory.findMany({
        where: { userId: user.id },
        orderBy: { playedAt: "desc" },
        take: 20,
      }),
      prisma.user.findMany({
        orderBy: [{ xp: "desc" }, { gamesWon: "desc" }],
        take: 20,
        select: { id: true, username: true, firstName: true, photoUrl: true, xp: true, level: true, gamesPlayed: true, gamesWon: true },
      }),
      prisma.user.count({ where: { referredById: user.id } }),
    ]);

    const nextLevelXp = user.level * user.level * LEVEL_STEP;
    const currentLevelXp = (user.level - 1) * (user.level - 1) * LEVEL_STEP;

    return NextResponse.json({
      profile: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        coins: user.coins,
        gems: user.gems,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        xp: user.xp,
        level: user.level,
        currentLevelXp,
        nextLevelXp,
        dailyStreak: user.dailyStreak,
        referralCode: user.referralCode,
        referrals,
      },
      achievements,
      history,
      leaderboard,
    });
  } catch (error) {
    console.error("Progression GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить прогресс" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getAuthedUser(String(body.initData || ""));
    if (!user || user.isBanned) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    }

    if (body.action === "claim_daily") {
      const now = new Date();
      const dateKey = now.toISOString().slice(0, 10);
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);

      const already = await prisma.dailyReward.findUnique({
        where: { userId_dateKey: { userId: user.id, dateKey } },
      });
      if (already) {
        return NextResponse.json({ success: false, message: "Награда за сегодня уже получена" }, { status: 409 });
      }

      const streak = user.lastDailyAt?.toISOString().slice(0, 10) === yesterdayKey ? user.dailyStreak + 1 : 1;
      const coins = Math.min(1000, 100 + Math.min(streak - 1, 6) * 25);
      const xp = 20 + Math.min(streak - 1, 6) * 5;

      await prisma.$transaction([
        prisma.dailyReward.create({ data: { userId: user.id, dateKey, coins, xp } }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            coins: { increment: coins },
            xp: { increment: xp },
            dailyStreak: streak,
            lastDailyAt: now,
            level: levelForXp(user.xp + xp),
          },
        }),
      ]);
      return NextResponse.json({ success: true, coins, xp, streak });
    }

    if (body.action === "apply_referral") {
      const code = String(body.code || "").trim();
      if (!code || code === user.referralCode) {
        return NextResponse.json({ error: "Некорректный реферальный код" }, { status: 400 });
      }
      if (user.referredById) {
        return NextResponse.json({ error: "Реферальный код уже использован" }, { status: 409 });
      }
      const inviter = await prisma.user.findUnique({ where: { referralCode: code } });
      if (!inviter || inviter.id === user.id) {
        return NextResponse.json({ error: "Пользователь с таким кодом не найден" }, { status: 404 });
      }
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { referredById: inviter.id, coins: { increment: 100 }, xp: { increment: 50 }, level: levelForXp(user.xp + 50) },
        }),
        prisma.user.update({
          where: { id: inviter.id },
          data: { coins: { increment: 200 }, xp: { increment: 100 }, level: levelForXp(inviter.xp + 100) },
        }),
      ]);
      return NextResponse.json({ success: true, message: "Реферальный код применён. Вы оба получили награду!" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("Progression POST:", error);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
