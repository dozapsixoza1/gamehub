import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTelegramWebAppData } from "@/lib/telegram";

const PREMIUM_PRICE = 400;
const MAX_TIER = 50;
const XP_PER_TIER = 100;

type Reward = { key: string; label: string; type: "coins" | "gems" | "badge" | "frame"; amount: number };

function rewardsForTier(tier: number): { free: Reward; premium: Reward } {
  const free: Reward = {
    key: `free-${tier}-coins`,
    label: `+${75 + tier * 15} монет`,
    type: "coins",
    amount: 75 + tier * 15,
  };
  if (tier === 25) {
    return {
      free,
      premium: { key: "premium-25-badge", label: "Эксклюзивный значок «Элита»", type: "badge", amount: 0 },
    };
  }
  if (tier === 50) {
    return {
      free,
      premium: { key: "premium-50-frame", label: "Рамка профиля «Легенда сезона»", type: "frame", amount: 0 },
    };
  }
  if (tier % 10 === 0) {
    const amount = tier / 2;
    return {
      free,
      premium: { key: `premium-${tier}-gems`, label: `+${amount} гемов`, type: "gems", amount },
    };
  }
  return {
    free,
    premium: {
      key: `premium-${tier}-coins`,
      label: `+${150 + tier * 30} монет`,
      type: "coins",
      amount: 150 + tier * 30,
    },
  };
}

async function getUser(initData: string) {
  const token = process.env.BOT_TOKEN;
  if (!token || !initData) return null;
  const auth = validateTelegramWebAppData(initData, token);
  if (!auth.valid || !auth.user) return null;
  return prisma.user.findUnique({
    where: { telegramId: BigInt(auth.user.id) },
    select: { id: true, coins: true, gems: true, isBanned: true },
  });
}

async function getActiveSeason() {
  const now = new Date();
  return prisma.season.findFirst({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: "desc" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req.headers.get("x-init-data") || req.nextUrl.searchParams.get("initData") || "");
    if (!user || user.isBanned) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

    const season = await getActiveSeason();
    if (!season) return NextResponse.json({ season: null, tiers: [], passXp: 0, maxTier: MAX_TIER, premiumPrice: PREMIUM_PRICE });

    const [ledgerXp, matchXp, dailyXp, claims, unlock] = await Promise.all([
      prisma.xpTransaction.aggregate({
        where: { userId: user.id, amount: { gt: 0 }, createdAt: { gte: season.startsAt, lte: new Date() } },
        _sum: { amount: true },
      }),
      prisma.matchHistory.aggregate({
        where: { userId: user.id, playedAt: { gte: season.startsAt, lte: new Date() } },
        _sum: { xpEarned: true },
      }),
      prisma.dailyReward.aggregate({
        where: { userId: user.id, createdAt: { gte: season.startsAt, lte: new Date() } },
        _sum: { xp: true },
      }),
      prisma.battlePassClaim.findMany({
        where: { seasonId: season.id, userId: user.id },
        select: { tier: true, track: true },
      }),
      prisma.battlePassUnlock.findUnique({
        where: { seasonId_userId: { seasonId: season.id, userId: user.id } },
        select: { id: true },
      }),
    ]);

    const earnedXp = (ledgerXp._sum.amount || 0) + (matchXp._sum.xpEarned || 0) + (dailyXp._sum.xp || 0);
    const passXp = Math.min(MAX_TIER * XP_PER_TIER, Math.max(0, earnedXp));
    const claimed = new Set(claims.map((item) => `${item.tier}:${item.track}`));
    const tiers = Array.from({ length: MAX_TIER }, (_, index) => {
      const tier = index + 1;
      const rewards = rewardsForTier(tier);
      return {
        tier,
        requiredXp: tier * XP_PER_TIER,
        unlocked: passXp >= tier * XP_PER_TIER,
        free: { ...rewards.free, claimed: claimed.has(`${tier}:free`) },
        premium: { ...rewards.premium, claimed: claimed.has(`${tier}:premium`) },
      };
    });

    return NextResponse.json({
      season: { id: season.id, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt },
      passXp,
      maxTier: MAX_TIER,
      xpPerTier: XP_PER_TIER,
      premiumPrice: PREMIUM_PRICE,
      premiumUnlocked: Boolean(unlock),
      balances: { coins: user.coins, gems: user.gems },
      tiers,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Battle pass GET:", error);
    return NextResponse.json({ error: "Не удалось загрузить боевой пропуск" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getUser(String(body.initData || ""));
    if (!user || user.isBanned) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

    const season = await getActiveSeason();
    if (!season) return NextResponse.json({ error: "Сейчас нет активного сезона" }, { status: 404 });

    if (body.action === "unlock_premium") {
      const existing = await prisma.battlePassUnlock.findUnique({
        where: { seasonId_userId: { seasonId: season.id, userId: user.id } },
      });
      if (existing) return NextResponse.json({ success: true, alreadyUnlocked: true });
      const result = await prisma.$transaction(async (tx) => {
        const debit = await tx.user.updateMany({
          where: { id: user.id, gems: { gte: PREMIUM_PRICE } },
          data: { gems: { decrement: PREMIUM_PRICE } },
        });
        if (debit.count !== 1) throw new Error("NOT_ENOUGH_GEMS");
        await tx.battlePassUnlock.create({
          data: { seasonId: season.id, userId: user.id, priceGems: PREMIUM_PRICE },
        });
        await tx.appNotification.create({
          data: { userId: user.id, type: "BATTLE_PASS", title: "Премиум-пропуск открыт", body: "Теперь доступны премиальные награды сезона." },
        });
        return true;
      });
      return NextResponse.json({ success: result, premiumUnlocked: true });
    }

    if (body.action === "claim") {
      const tier = Number(body.tier);
      const track = String(body.track || "");
      if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIER || !["free", "premium"].includes(track)) {
        return NextResponse.json({ error: "Некорректная награда" }, { status: 400 });
      }
      const [ledgerXp, matchXp, dailyXp] = await Promise.all([
        prisma.xpTransaction.aggregate({
          where: { userId: user.id, amount: { gt: 0 }, createdAt: { gte: season.startsAt, lte: new Date() } },
          _sum: { amount: true },
        }),
        prisma.matchHistory.aggregate({
          where: { userId: user.id, playedAt: { gte: season.startsAt, lte: new Date() } },
          _sum: { xpEarned: true },
        }),
        prisma.dailyReward.aggregate({
          where: { userId: user.id, createdAt: { gte: season.startsAt, lte: new Date() } },
          _sum: { xp: true },
        }),
      ]);
      const passXp = Math.max(0, (ledgerXp._sum.amount || 0) + (matchXp._sum.xpEarned || 0) + (dailyXp._sum.xp || 0));
      if (passXp < tier * XP_PER_TIER) return NextResponse.json({ error: "Сначала открой этот уровень" }, { status: 409 });
      if (track === "premium") {
        const unlock = await prisma.battlePassUnlock.findUnique({
          where: { seasonId_userId: { seasonId: season.id, userId: user.id } },
        });
        if (!unlock) return NextResponse.json({ error: "Сначала открой премиум-пропуск" }, { status: 403 });
      }

      const reward = rewardsForTier(tier)[track as "free" | "premium"];
      await prisma.$transaction(async (tx) => {
        await tx.battlePassClaim.create({
          data: { seasonId: season.id, userId: user.id, tier, track, rewardKey: reward.key },
        });
        if (reward.type === "coins") {
          await tx.user.update({ where: { id: user.id }, data: { coins: { increment: reward.amount } } });
        } else if (reward.type === "gems") {
          await tx.user.update({ where: { id: user.id }, data: { gems: { increment: reward.amount } } });
        } else if (reward.type === "badge") {
          await tx.userSettings.upsert({
            where: { userId: user.id },
            create: { userId: user.id, profileBadge: "season-elite" },
            update: { profileBadge: "season-elite" },
          });
        } else if (reward.type === "frame") {
          await tx.userSettings.upsert({
            where: { userId: user.id },
            create: { userId: user.id, profileFrame: "season-legend" },
            update: { profileFrame: "season-legend" },
          });
        }
        await tx.appNotification.create({
          data: { userId: user.id, type: "BATTLE_PASS", title: "Награда боевого пропуска", body: `Уровень ${tier}: ${reward.label}`, href: "/battle-pass" },
        });
      });
      return NextResponse.json({ success: true, reward: reward.label });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Эта награда уже получена" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "NOT_ENOUGH_GEMS") {
      return NextResponse.json({ error: "Недостаточно гемов для премиум-пропуска" }, { status: 409 });
    }
    console.error("Battle pass POST:", error);
    return NextResponse.json({ error: "Не удалось выполнить действие" }, { status: 500 });
  }
}
