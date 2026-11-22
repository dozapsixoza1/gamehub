import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

const QUESTS = [
  { code: "play_one", title: "Первая партия", description: "Сыграй хотя бы один матч сегодня", target: 1, rewardXp: 30, rewardCoins: 75, kind: "games" },
  { code: "play_three", title: "Игровой марафон", description: "Сыграй три матча за день", target: 3, rewardXp: 75, rewardCoins: 150, kind: "games" },
  { code: "win_one", title: "Первая победа", description: "Одержи одну победу сегодня", target: 1, rewardXp: 50, rewardCoins: 100, kind: "wins" },
];

function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

async function getUser(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token || !initData) return null;
  const auth = validateTelegramWebAppData(initData, token);
  if (!auth.valid || !auth.user) return null;
  return prisma.user.findUnique({
    where: { telegramId: BigInt(auth.user.id) },
    select: { id: true, xp: true, coins: true, isBanned: true },
  });
}

function utcDay() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateKey: start.toISOString().slice(0, 10), start, end };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req.headers.get("x-init-data") || req.nextUrl.searchParams.get("initData") || "");
    if (!user || user.isBanned) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

    const { dateKey, start, end } = utcDay();
    const [games, wins, claims] = await Promise.all([
      prisma.matchHistory.count({ where: { userId: user.id, playedAt: { gte: start, lt: end } } }),
      prisma.matchHistory.count({ where: { userId: user.id, result: "WIN", playedAt: { gte: start, lt: end } } }),
      prisma.questClaim.findMany({ where: { userId: user.id, dateKey }, select: { questCode: true } }),
    ]);
    const claimed = new Set(claims.map((claim) => claim.questCode));
    const quests = QUESTS.map((quest) => {
      const progress = quest.kind === "wins" ? wins : games;
      return { ...quest, progress: Math.min(progress, quest.target), completed: progress >= quest.target, claimed: claimed.has(quest.code) };
    });
    return NextResponse.json({ dateKey, quests });
  } catch (error) {
    console.error("Quests GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить задания" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getUser(String(body.initData || ""));
    if (!user || user.isBanned) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

    const quest = QUESTS.find((item) => item.code === String(body.questCode || ""));
    if (!quest) return NextResponse.json({ error: "Задание не найдено" }, { status: 404 });

    const { dateKey, start, end } = utcDay();
    const progress = quest.kind === "wins"
      ? await prisma.matchHistory.count({ where: { userId: user.id, result: "WIN", playedAt: { gte: start, lt: end } } })
      : await prisma.matchHistory.count({ where: { userId: user.id, playedAt: { gte: start, lt: end } } });

    if (progress < quest.target) {
      return NextResponse.json({ error: "Сначала выполни задание", progress, target: quest.target }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.questClaim.create({
        data: { userId: user.id, questCode: quest.code, dateKey, rewardXp: quest.rewardXp, rewardCoins: quest.rewardCoins },
      });
      const nextXp = user.xp + quest.rewardXp;
      await tx.user.update({
        where: { id: user.id },
        data: { xp: { increment: quest.rewardXp }, coins: { increment: quest.rewardCoins }, level: levelForXp(nextXp) },
      });
      await tx.xpTransaction.create({
        data: { userId: user.id, amount: quest.rewardXp, balanceAfter: nextXp, source: "DAILY_QUEST", reason: "Ежедневное задание: " + quest.title },
      });
      await tx.appNotification.create({
        data: { userId: user.id, type: "QUEST_REWARD", title: "Задание выполнено", body: "+" + quest.rewardXp + " XP · +" + quest.rewardCoins + " монет" },
      });
    });

    return NextResponse.json({ success: true, rewardXp: quest.rewardXp, rewardCoins: quest.rewardCoins });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Награда за это задание уже получена" }, { status: 409 });
    }
    console.error("Quests POST:", error);
    return NextResponse.json({ error: "Не удалось получить награду" }, { status: 500 });
  }
}
